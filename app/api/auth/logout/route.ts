import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { LogoutInputSchema } from '@/lib/auth/schemas';
import { clearAllAuthCookies, SESSION_AUDIT_COOKIE_NAME } from '@/lib/auth/errors';
import {
  extractVerifiedJwtMetadata,
  verifySessionAuditToken,
} from '@/lib/auth/session-audit';
import { apiSuccess } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthLogout');

export async function POST(request: NextRequest) {
  const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

  try {
    const rawBody = await request.json().catch(() => ({}));
    const parsed = LogoutInputSchema.safeParse(rawBody ?? {});
    const scope = parsed.success ? parsed.data.scope : 'local';

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const nowIso = new Date().toISOString();
      const rawAuditCookie = request.cookies.get(SESSION_AUDIT_COOKIE_NAME)?.value;
      const parsedAudit = verifySessionAuditToken(rawAuditCookie, user.id);
      const jwtMeta = await extractVerifiedJwtMetadata(supabase);

      try {
        if (scope === 'global') {
          await supabase
            .from('user_sessions')
            .update({ revoked_at: nowIso })
            .eq('user_id', user.id)
            .is('revoked_at', null);
        } else if (scope === 'others') {
          if (parsedAudit?.sessionRowId) {
            await supabase
              .from('user_sessions')
              .update({ revoked_at: nowIso })
              .eq('user_id', user.id)
              .neq('id', parsedAudit.sessionRowId)
              .is('revoked_at', null);
          } else if (jwtMeta.authSessionId) {
            await supabase
              .from('user_sessions')
              .update({ revoked_at: nowIso })
              .eq('user_id', user.id)
              .neq('auth_session_id', jwtMeta.authSessionId)
              .is('revoked_at', null);
          }
        } else {
          // Local scope: prefer exact current session row / auth_session_id if tracked; otherwise fall back safely
          if (parsedAudit?.sessionRowId) {
            await supabase
              .from('user_sessions')
              .update({ revoked_at: nowIso })
              .eq('id', parsedAudit.sessionRowId)
              .eq('user_id', user.id)
              .is('revoked_at', null);
          } else if (jwtMeta.authSessionId) {
            await supabase
              .from('user_sessions')
              .update({ revoked_at: nowIso })
              .eq('auth_session_id', jwtMeta.authSessionId)
              .eq('user_id', user.id)
              .is('revoked_at', null);
          } else {
            await supabase
              .from('user_sessions')
              .update({ revoked_at: nowIso })
              .eq('user_id', user.id)
              .is('revoked_at', null);
          }
        }
      } catch (revocationErr) {
        log.warn('Session audit revocation update failed cleanly', {
          reason: revocationErr instanceof Error ? revocationErr.message : String(revocationErr),
        });
      }
    }

    await supabase.auth.signOut({ scope });

    const response = apiSuccess({
      message:
        scope === 'global'
          ? 'Signed out from all devices successfully'
          : scope === 'others'
          ? 'Signed out from all other devices'
          : 'Signed out successfully',
      scope,
    });

    if (scope !== 'others') {
      clearAllAuthCookies(request, response);
    }
    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Logout error', error);
    const response = apiSuccess({ message: 'Signed out successfully', scope: 'local' });
    clearAllAuthCookies(request, response);
    return applyAuthResponseHeaders(response);
  }
}
