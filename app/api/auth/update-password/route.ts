import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { verifyCurrentPasswordStateless } from '@/lib/supabase/verify-password';
import {
  AuthError,
  buildAuthOrNotFoundResponse,
  requireAuth,
} from '@/lib/auth/middleware';
import {
  UpdatePasswordInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import { SESSION_AUDIT_COOKIE_NAME, mapSupabaseAuthError } from '@/lib/auth/errors';
import { verifySessionAuditToken } from '@/lib/auth/session-audit';
import {
  RATE_LIMIT_POLICIES,
  attachRateLimitHeaders,
  evaluateRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthUpdatePassword');

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const clientIp = extractClientIp(request);
    const rateCheck = evaluateRateLimits([
      {
        policy: RATE_LIMIT_POLICIES.AUTH_PASSWORD_UPDATE,
        identifier: `${auth.user.id}:${clientIp}`,
      },
    ]);
    if (!rateCheck.allowed) {
      return rateLimitExceededResponse(rateCheck);
    }

    const body = await request.json().catch(() => null);
    const spoofedFields = findForbiddenClientOwnershipFields(body);
    if (spoofedFields.length > 0) {
      return apiError(
        'FORBIDDEN',
        'Client-supplied identity or authorization fields are not permitted',
        403
      );
    }

    const parsed = UpdatePasswordInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid password update submission',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { currentPassword, newPassword, mode } = parsed.data;

    if (mode === 'change') {
      if (!auth.user.email || !currentPassword) {
        return apiError(
          'INVALID_CREDENTIALS',
          'Current password verification is required',
          401
        );
      }

      const validCurrent = await verifyCurrentPasswordStateless(
        auth.user.email,
        currentPassword
      );
      if (!validCurrent) {
        return apiError(
          'INVALID_CURRENT_PASSWORD',
          'Current password is incorrect',
          401
        );
      }
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      const mapped = mapSupabaseAuthError(error, 'password_update');
      log.warn('Password update rejected by Supabase', { code: mapped.code });
      return apiError(mapped.code, mapped.message, mapped.statusCode);
    }

    // Security best practice: terminate all other active device sessions after credential rotation
    await supabase.auth.signOut({ scope: 'others' }).catch(() => {});

    const nowIso = new Date().toISOString();
    const rawAuditCookie = request.cookies.get(SESSION_AUDIT_COOKIE_NAME)?.value;
    const parsedAudit = verifySessionAuditToken(rawAuditCookie, auth.user.id);

    try {
      if (parsedAudit?.sessionRowId) {
        await supabase
          .from('user_sessions')
          .update({ revoked_at: nowIso })
          .eq('user_id', auth.user.id)
          .neq('id', parsedAudit.sessionRowId)
          .is('revoked_at', null);
      } else if (auth.session.authSessionId) {
        await supabase
          .from('user_sessions')
          .update({ revoked_at: nowIso })
          .eq('user_id', auth.user.id)
          .neq('auth_session_id', auth.session.authSessionId)
          .is('revoked_at', null);
      }
    } catch {
      // Non-fatal session audit cleanup
    }

    const response = apiSuccess({
      message: 'Password updated successfully. Other active sessions were signed out.',
    });
    attachRateLimitHeaders(response, rateCheck);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Update password error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while updating password',
      500
    );
  }
}
