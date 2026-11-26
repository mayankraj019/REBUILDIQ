import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { getServerSession } from './server';

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = 'UNAUTHORIZED', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends Error {
  code: string;
  statusCode: number;

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
    this.statusCode = 404;
  }
}

export interface VerifiedAuthContext {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
  };
}

/**
 * Resolves the verified authenticated user from Supabase SSR cookies.
 * Returns null if unauthenticated or token verification fails.
 */
export async function getAuthenticatedUser(
  request?: NextRequest | null
): Promise<VerifiedAuthContext | null> {
  if (!request) {
    return getServerSession();
  }

  try {
    const { supabase } = createSupabaseRouteClient(request);
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
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

    return {
      session: {
        id: authUser.id,
        userId: authUser.id,
        expiresAt: new Date(Date.now() + 3600 * 1000),
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
  } catch {
    return null;
  }
}

/**
 * Requires a verified authenticated user session.
 * Throws AuthError (401) if unauthenticated.
 */
export async function requireAuth(
  request?: NextRequest | null
): Promise<VerifiedAuthContext> {
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    throw new AuthError('Authentication required to access this resource');
  }
  return auth;
}

/**
 * Strict Multi-Tenant Authorization Guard against Supabase Postgres (RLS + userId filter):
 * Returns NotFoundError (404) if job does not exist or belongs to another user.
 */
export async function requireJobOwnership(
  jobId: string,
  userId: string,
  request?: NextRequest | null
) {
  if (!jobId || !userId) {
    throw new NotFoundError('Analysis job not found');
  }

  const supabase = request
    ? createSupabaseRouteClient(request).supabase
    : await (await import('@/lib/supabase/server')).createSupabaseServerClient();

  const { data: job, error } = await supabase
    .from('analysis_jobs')
    .select(
      '*, page_evidence(*, visual_screenshots(*)), blueprint_artifacts(*)'
    )
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !job) {
    throw new NotFoundError('Analysis job not found');
  }

  return job;
}
