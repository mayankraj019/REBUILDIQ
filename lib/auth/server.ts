import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SESSION_AUDIT_COOKIE_NAME } from './errors';
import {
  extractVerifiedJwtMetadata,
  loadSafeUserProfile,
  resolveSafeDisplayName,
  verifySessionNotRevoked,
} from './session-audit';
import { logger } from '@/lib/logger';

export interface ServerSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
  defaultPromptTarget: 'antigravity' | 'cursor' | 'claude';
  createdAt: Date;
}

export interface ServerAuthSession {
  session: {
    id: string;
    authSessionId: string | null;
    userId: string;
    expiresAt: Date;
  };
  user: ServerSessionUser;
}

export type SessionLookupFailureReason =
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'ACCOUNT_DELETED';

export interface ServerSessionStatusResult {
  session: ServerAuthSession | null;
  failureReason?: SessionLookupFailureReason;
}

export interface SafeSessionSummary {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  authMethod?: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/**
 * Verifies the active user identity directly with Supabase Auth (`getUser()` + `getClaims()`),
 * confirms the account is active (not soft-deleted), and verifies session revocation state.
 */
export async function getServerSessionStatus(): Promise<ServerSessionStatusResult> {
  try {
    const cookieStore = await cookies();
    const hadAuthCookie = cookieStore
      .getAll()
      .some((c) => c.name.startsWith('sb-') && c.name.includes('-auth-token'));
    const rawAuditCookie = cookieStore.get(SESSION_AUDIT_COOKIE_NAME)?.value;

    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return {
        session: null,
        failureReason: hadAuthCookie ? 'SESSION_EXPIRED' : 'UNAUTHENTICATED',
      };
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const jwtMeta = await extractVerifiedJwtMetadata(
      supabase,
      sessionData?.session?.access_token,
      sessionData?.session?.expires_at
    );

    if (jwtMeta.expiresAt.getTime() <= Date.now()) {
      return {
        session: null,
        failureReason: 'SESSION_EXPIRED',
      };
    }

    const loaded = await loadSafeUserProfile(supabase, authUser.id);
    if (loaded.deleted) {
      return {
        session: null,
        failureReason: 'ACCOUNT_DELETED',
      };
    }

    const revocationCheck = await verifySessionNotRevoked({
      supabase,
      userId: authUser.id,
      authSessionId: jwtMeta.authSessionId,
      rawAuditCookie,
    });

    if (!revocationCheck.valid) {
      return {
        session: null,
        failureReason: 'SESSION_EXPIRED',
      };
    }

    const profile = loaded.profile;
    const email = profile?.email || authUser.email || '';

    return {
      session: {
        session: {
          id: revocationCheck.auditSessionId || jwtMeta.authSessionId || authUser.id,
          authSessionId: jwtMeta.authSessionId,
          userId: authUser.id,
          expiresAt: jwtMeta.expiresAt,
        },
        user: {
          id: profile?.id || authUser.id,
          email,
          name: resolveSafeDisplayName(
            profile?.name,
            email,
            authUser.user_metadata as Record<string, unknown> | undefined
          ),
          // Authorization role derives solely from public.users / app_metadata — NEVER user_metadata
          role: profile?.role || 'USER',
          emailVerified: Boolean(authUser.email_confirmed_at),
          defaultPromptTarget: profile?.defaultPromptTarget || 'antigravity',
          createdAt: profile?.createdAt
            ? new Date(profile.createdAt)
            : new Date(authUser.created_at),
        },
      },
    };
  } catch (err) {
    logger.debug('getServerSession lookup skipped or failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
    return {
      session: null,
      failureReason: 'UNAUTHENTICATED',
    };
  }
}

export async function getServerSession(): Promise<ServerAuthSession | null> {
  const result = await getServerSessionStatus();
  return result.session;
}

/**
 * Guards protected App Router pages by verifying the server-side Supabase session.
 * Redirects unauthenticated or expired visitors to `/login` with safe return path and reason.
 */
export async function requireServerAuth(
  returnPath = '/dashboard'
): Promise<ServerAuthSession> {
  const { session, failureReason } = await getServerSessionStatus();

  if (!session) {
    const safeReturn =
      returnPath.startsWith('/') && !returnPath.startsWith('//')
        ? returnPath
        : '/dashboard';
    const search = new URLSearchParams({ next: safeReturn });

    if (failureReason === 'SESSION_EXPIRED') {
      search.set('reason', 'session_expired');
    } else if (failureReason === 'ACCOUNT_DELETED') {
      search.set('reason', 'account_deleted');
    }

    redirect(`/login?${search.toString()}`);
  }

  return session;
}

/**
 * Lists active (non-revoked, unexpired) login sessions owned by the authenticated user
 * from `public.user_sessions` (enforced by RLS).
 */
export async function getUserActiveSessions(
  userId: string,
  currentSessionId?: string
): Promise<SafeSessionSummary[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id, auth_session_id, ip_address, user_agent, auth_method, logged_in_at, expires_at, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('logged_in_at', { ascending: false })
      .limit(20);

    let rows: Array<any> = data || [];

    // Graceful fallback if migration 000002 columns are not yet applied in Postgres
    if (error) {
      const fb = await supabase
        .from('user_sessions')
        .select('id, ip_address, user_agent, auth_method, logged_in_at, expires_at, revoked_at')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('logged_in_at', { ascending: false })
        .limit(20);

      if (fb.error || !fb.data) {
        return [];
      }
      rows = fb.data;
    }

    const nowMs = Date.now();
    const activeRows = rows.filter(
      (row) => !row.expires_at || new Date(row.expires_at).getTime() > nowMs
    );

    const hasExactMatch = activeRows.some(
      (r) =>
        currentSessionId &&
        (r.id === currentSessionId || r.auth_session_id === currentSessionId)
    );

    return activeRows.map((row, idx) => ({
      id: row.id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      authMethod: row.auth_method || 'password',
      createdAt: row.logged_in_at,
      expiresAt:
        row.expires_at ||
        new Date(new Date(row.logged_in_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isCurrent: hasExactMatch
        ? row.id === currentSessionId || row.auth_session_id === currentSessionId
        : idx === 0,
    }));
  } catch {
    return [];
  }
}
