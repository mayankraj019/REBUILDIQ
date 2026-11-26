import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import {
  AuthError,
  buildAuthOrNotFoundResponse,
  requireAuth,
} from '@/lib/auth/middleware';
import { SESSION_AUDIT_COOKIE_NAME } from '@/lib/auth/errors';
import { verifySessionAuditToken } from '@/lib/auth/session-audit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthSessionsList');

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

    const rawAuditCookie = request.cookies.get(SESSION_AUDIT_COOKIE_NAME)?.value;
    const parsedAudit = verifySessionAuditToken(rawAuditCookie, auth.user.id);
    const currentId = parsedAudit?.sessionRowId || auth.session.authSessionId || auth.session.id;

    let rows: any[] = [];
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id, auth_session_id, ip_address, user_agent, auth_method, logged_in_at, expires_at, revoked_at')
      .eq('user_id', auth.user.id)
      .is('revoked_at', null)
      .order('logged_in_at', { ascending: false })
      .limit(20);

    if (error) {
      const fb = await supabase
        .from('user_sessions')
        .select('id, ip_address, user_agent, auth_method, logged_in_at, expires_at, revoked_at')
        .eq('user_id', auth.user.id)
        .is('revoked_at', null)
        .order('logged_in_at', { ascending: false })
        .limit(20);

      rows = fb.data || [];
    } else {
      rows = data || [];
    }

    const nowMs = Date.now();
    const active = rows.filter(
      (r) => !r.expires_at || new Date(r.expires_at).getTime() > nowMs
    );

    const hasExactMatch = active.some(
      (r) => r.id === currentId || r.auth_session_id === currentId
    );

    const sessions = active.map((row, idx) => ({
      id: row.id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      authMethod: row.auth_method || 'password',
      createdAt: row.logged_in_at,
      expiresAt:
        row.expires_at ||
        new Date(new Date(row.logged_in_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isCurrent: hasExactMatch
        ? row.id === currentId || row.auth_session_id === currentId
        : idx === 0,
    }));

    const response = apiSuccess({ sessions });
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Session listing error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'Unable to list active user sessions',
      500
    );
  }
}
