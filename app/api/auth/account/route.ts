import crypto from 'node:crypto';
import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from '@/lib/supabase/admin';
import { verifyCurrentPasswordStateless } from '@/lib/supabase/verify-password';
import { ARTIFACTS_BUCKET } from '@/lib/supabase/storage';
import {
  AuthError,
  buildAuthOrNotFoundResponse,
  requireAuth,
} from '@/lib/auth/middleware';
import {
  DeleteAccountInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import { clearAllAuthCookies } from '@/lib/auth/errors';
import {
  RATE_LIMIT_POLICIES,
  evaluateRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthAccountDeletion');

async function purgeUserStorageArtifacts(
  supabase: any,
  userId: string
): Promise<number> {
  if (!supabase?.storage) return 0;

  let removedCount = 0;
  const bucket = supabase.storage.from(ARTIFACTS_BUCKET);
  if (!bucket || typeof bucket.list !== 'function') {
    return 0;
  }

  try {
    const { data: topEntries } = await bucket.list(userId, { limit: 100 });
    if (!topEntries || topEntries.length === 0) {
      return 0;
    }

    const pathsToDelete: string[] = [];
    for (const entry of topEntries) {
      if (entry.id) {
        pathsToDelete.push(`${userId}/${entry.name}`);
      } else {
        // Folder per jobId
        const { data: nested } = await bucket.list(`${userId}/${entry.name}`, { limit: 100 });
        for (const child of nested || []) {
          pathsToDelete.push(`${userId}/${entry.name}/${child.name}`);
        }
      }
    }

    if (pathsToDelete.length > 0) {
      await bucket.remove(pathsToDelete);
      removedCount = pathsToDelete.length;
    }
  } catch (err) {
    log.warn('Storage artifact purge encountered an issue', {
      reason: err instanceof Error ? err.message : String(err),
    });
  }

  return removedCount;
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const clientIp = extractClientIp(request);
    const rateCheck = evaluateRateLimits([
      {
        policy: RATE_LIMIT_POLICIES.AUTH_ACCOUNT_DELETE,
        identifier: `${auth.user.id}:${clientIp}`,
      },
    ]);
    if (!rateCheck.allowed) {
      return rateLimitExceededResponse(rateCheck);
    }

    const body = await request.json().catch(() => null);
    const spoofed = findForbiddenClientOwnershipFields(body);
    if (spoofed.length > 0) {
      return apiError(
        'FORBIDDEN',
        'Client-supplied identity or ownership fields are not permitted',
        403
      );
    }

    const parsed = DeleteAccountInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Account deletion requires confirmation "DELETE" and your current password',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    if (!auth.user.email) {
      return apiError('BAD_REQUEST', 'Verified email required to confirm deletion', 400);
    }

    const passwordValid = await verifyCurrentPasswordStateless(
      auth.user.email,
      parsed.data.currentPassword
    );
    if (!passwordValid) {
      return apiError(
        'INVALID_CREDENTIALS',
        'Current password is incorrect. Account deletion aborted.',
        401
      );
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const userId = auth.user.id;
    const now = new Date();
    const nowIso = now.toISOString();
    const retentionDays = Number(process.env.ACCOUNT_RETENTION_DAYS || '30') || 30;
    const retentionUntilIso = new Date(
      now.getTime() + retentionDays * 24 * 60 * 60 * 1000
    ).toISOString();

    // 1. Delete user-owned Storage objects first (required by Supabase before auth.users removal)
    const storageClient = hasSupabaseAdminConfig() ? createSupabaseAdminClient() : supabase;
    const storageObjectsRemoved = await purgeUserStorageArtifacts(storageClient, userId);

    // 2. Delete all user-owned analyses (ON DELETE CASCADE removes evidence, screenshots, blueprints, audit logs)
    const { data: deletedJobs } = await supabase
      .from('analysis_jobs')
      .delete()
      .eq('user_id', userId)
      .select('id');
    const jobsPurged = Array.isArray(deletedJobs) ? deletedJobs.length : 0;

    // 3. Revoke all active session records immediately
    await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('user_id', userId)
      .is('revoked_at', null);

    // 4. Hard-delete auth identity if privileged server secret is configured; otherwise soft-delete + anonymize
    let authIdentityDeleted = false;
    if (hasSupabaseAdminConfig()) {
      const admin = createSupabaseAdminClient();
      const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
      if (deleteErr) {
        log.error('Admin deleteUser failed', deleteErr);
        return apiError(
          'ACCOUNT_DELETION_FAILED',
          'Unable to complete account removal. Please try again.',
          500
        );
      }
      authIdentityDeleted = true;
    } else {
      // Soft-delete & anonymize profile record; DB RLS + server auth check block all future access immediately
      const { error: softErr } = await supabase
        .from('users')
        .update({
          name: 'Deleted Account',
          deleted_at: nowIso,
          deletion_scheduled_at: retentionUntilIso,
          deletion_reason: parsed.data.reason || 'user_requested',
        })
        .eq('id', userId);

      if (softErr) {
        // Fallback when 000002 retention columns are not yet applied in Postgres
        await supabase
          .from('users')
          .update({ name: 'Deleted Account' })
          .eq('id', userId);
      }
    }

    // 5. Terminate all active GoTrue refresh tokens globally and clear client auth cookies
    await supabase.auth.signOut({ scope: 'global' }).catch(() => {});

    const userIdHash = crypto.createHash('sha256').update(userId).digest('hex');
    log.info('User account deletion processed', {
      userIdHash,
      authIdentityDeleted,
      jobsPurged,
      storageObjectsRemoved,
    });

    const response = apiSuccess({
      deleted: true,
      authIdentityDeleted,
      jobsPurged,
      storageObjectsRemoved,
      retentionPolicyDays: authIdentityDeleted ? 0 : retentionDays,
      message: authIdentityDeleted
        ? 'Your account, authentication identity, analyses, and stored artifacts have been permanently deleted.'
        : `All analyses, sessions, and stored artifacts were deleted and your profile was scheduled for permanent identity purge within ${retentionDays} days (configure SUPABASE_SECRET_KEY for immediate auth record removal).`,
    });

    clearAllAuthCookies(request, response);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Account deletion error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while deleting the account',
      500
    );
  }
}
