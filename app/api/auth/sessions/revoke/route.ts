import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import {
  AuthError,
  buildAuthOrNotFoundResponse,
  requireAuth,
} from '@/lib/auth/middleware';
import {
  RevokeSessionInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import { SESSION_AUDIT_COOKIE_NAME } from '@/lib/auth/errors';
import { verifySessionAuditToken } from '@/lib/auth/session-audit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthSessionRevoke');

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const body = await request.json().catch(() => null);

    const spoofed = findForbiddenClientOwnershipFields(body);
    if (spoofed.length > 0) {
      return apiError(
        'FORBIDDEN',
        'Client-supplied ownership fields are not permitted',
        403
      );
    }

    const parsed = RevokeSessionInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid session revocation request',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const rawAuditCookie = request.cookies.get(SESSION_AUDIT_COOKIE_NAME)?.value;
    const parsedAudit = verifySessionAuditToken(rawAuditCookie, auth.user.id);
    const currentAuditId = parsedAudit?.sessionRowId;
    const nowIso = new Date().toISOString();

    if (parsed.data.scope === 'others') {
      await supabase.auth.signOut({ scope: 'others' }).catch(() => {});

      if (currentAuditId) {
        await supabase
          .from('user_sessions')
          .update({ revoked_at: nowIso })
          .eq('user_id', auth.user.id)
          .neq('id', currentAuditId)
          .is('revoked_at', null);
      } else if (auth.session.authSessionId) {
        await supabase
          .from('user_sessions')
          .update({ revoked_at: nowIso })
          .eq('user_id', auth.user.id)
          .neq('auth_session_id', auth.session.authSessionId)
          .is('revoked_at', null);
      }

      const res = apiSuccess({
        message: 'All other device sessions were signed out.',
        scope: 'others',
      });
      return applyAuthResponseHeaders(res);
    }

    // Revoke single specific session strictly owned by auth.user.id
    const targetSessionId = parsed.data.sessionId!;
    if (targetSessionId === currentAuditId) {
      return apiError(
        'VALIDATION_FAILED',
        'Use Sign Out to terminate your current active session.',
        400
      );
    }

    const { data: updatedRows, error } = await supabase
      .from('user_sessions')
      .update({ revoked_at: nowIso })
      .eq('id', targetSessionId)
      .eq('user_id', auth.user.id)
      .is('revoked_at', null)
      .select('id');

    if (error || !updatedRows || updatedRows.length === 0) {
      return apiError('NOT_FOUND', 'Session not found', 404);
    }

    const res = apiSuccess({
      message: 'Selected session was revoked.',
      revokedSessionId: targetSessionId,
    });
    return applyAuthResponseHeaders(res);
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Session revoke error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'Unable to revoke session',
      500
    );
  }
}
