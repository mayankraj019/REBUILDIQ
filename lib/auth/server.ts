import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export interface ServerSessionUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: Date;
}

export interface ServerAuthSession {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: ServerSessionUser;
}

export interface SafeSessionSummary {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

/**
 * Resolves the currently authenticated user in Server Components / Server Actions
 * by confirming identity directly with the Supabase Auth server (`getUser()`)
 * and fetching the synced `public.users` row enforced by Postgres RLS.
 */
export async function getServerSession(): Promise<ServerAuthSession | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    const { data: profile } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    const fallbackName =
      (typeof authUser.user_metadata?.full_name === 'string' &&
        authUser.user_metadata.full_name.trim()) ||
      (authUser.email ? authUser.email.split('@')[0] : 'User');

    const { data: sessionData } = await supabase.auth.getSession();
    const expiresAtSec = sessionData.session?.expires_at;

    return {
      session: {
        id: authUser.id,
        userId: authUser.id,
        expiresAt: expiresAtSec
          ? new Date(expiresAtSec * 1000)
          : new Date(Date.now() + 3600 * 1000),
      },
      user: {
        id: profile?.id || authUser.id,
        email: profile?.email || authUser.email || '',
        name: profile?.name || fallbackName,
        role: profile?.role || 'USER',
        createdAt: profile?.created_at
          ? new Date(profile.created_at)
          : new Date(authUser.created_at),
      },
    };
  } catch (err) {
    logger.debug('getServerSession lookup skipped or failed', {
      reason: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Guards protected App Router pages by verifying the server-side Supabase session.
 * Redirects unauthenticated visitors to /login with an optional return path.
 */
export async function requireServerAuth(
  returnPath = '/dashboard'
): Promise<ServerAuthSession> {
  const session = await getServerSession();

  if (!session) {
    const encodedNext = encodeURIComponent(returnPath);
    redirect(`/login?next=${encodedNext}`);
  }

  return session;
}

/**
 * Lists recorded login sessions owned by the authenticated user from
 * Supabase `public.user_sessions` (enforced by RLS `(select auth.uid()) = user_id`).
 */
export async function getUserActiveSessions(
  userId: string,
  _currentSessionId?: string
): Promise<SafeSessionSummary[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id, ip_address, user_agent, logged_in_at, expires_at, revoked_at')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('logged_in_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      return [];
    }

    return data.map((row, idx) => ({
      id: row.id,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      createdAt: row.logged_in_at,
      expiresAt:
        row.expires_at ||
        new Date(new Date(row.logged_in_at).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      isCurrent: idx === 0,
    }));
  } catch {
    return [];
  }
}
