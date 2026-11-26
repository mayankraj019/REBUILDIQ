import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { apiError } from '@/lib/api/response';
import {
  clearAllAuthCookies,
  hasSupabaseAuthCookies,
  SESSION_AUDIT_COOKIE_NAME,
} from './errors';
import { isValidUuid } from './schemas';
import { getServerSessionStatus } from './server';
import {
  extractVerifiedJwtMetadata,
  loadSafeUserProfile,
  resolveSafeDisplayName,
  verifySessionNotRevoked,
} from './session-audit';

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
    authSessionId: string | null;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    emailVerified: boolean;
    defaultPromptTarget: 'antigravity' | 'cursor' | 'claude';
    createdAt: Date;
  };
}

/**
 * Resolves and strictly verifies the authenticated user from Supabase SSR cookies.
 * Throws `AuthError` (`SESSION_EXPIRED` or `UNAUTHORIZED`) or returns detailed failure state.
 */
async function resolveVerifiedAuthFromRequest(
  request: NextRequest
): Promise<{
  auth: VerifiedAuthContext | null;
  failureCode?: 'UNAUTHORIZED' | 'SESSION_EXPIRED' | 'SESSION_REVOKED';
  failureMessage?: string;
}> {
  const hadAuthCookies = hasSupabaseAuthCookies(request);
  const rawAuditCookie = request.cookies.get(SESSION_AUDIT_COOKIE_NAME)?.value;

  try {
    const { supabase } = createSupabaseRouteClient(request);
    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return {
        auth: null,
        failureCode: hadAuthCookies ? 'SESSION_EXPIRED' : 'UNAUTHORIZED',
        failureMessage: hadAuthCookies
          ? 'Your session has expired or is no longer valid. Please sign in again.'
          : 'Authentication required to access this resource',
      };
    }

    const sessionData =
      typeof supabase.auth.getSession === 'function'
        ? (await supabase.auth.getSession()).data
        : null;

    const jwtMeta = await extractVerifiedJwtMetadata(
      supabase,
      sessionData?.session?.access_token,
      sessionData?.session?.expires_at
    );

    if (jwtMeta.expiresAt.getTime() <= Date.now()) {
      return {
        auth: null,
        failureCode: 'SESSION_EXPIRED',
        failureMessage: 'Your session has expired. Please sign in again.',
      };
    }

    const loaded = await loadSafeUserProfile(supabase, authUser.id);
    if (loaded.deleted) {
      return {
        auth: null,
        failureCode: 'SESSION_REVOKED',
        failureMessage: 'This account is no longer active.',
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
        auth: null,
        failureCode: 'SESSION_EXPIRED',
        failureMessage: 'Your session was signed out or revoked. Please sign in again.',
      };
    }

    const profile = loaded.profile;
    const email = profile?.email || authUser.email || '';

    return {
      auth: {
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
          // Authorization role NEVER derives from client-editable user_metadata
          role: profile?.role || 'USER',
          emailVerified: Boolean(authUser.email_confirmed_at),
          defaultPromptTarget: profile?.defaultPromptTarget || 'antigravity',
          createdAt: profile?.createdAt
            ? new Date(profile.createdAt)
            : new Date(authUser.created_at),
        },
      },
    };
  } catch {
    return {
      auth: null,
      failureCode: hadAuthCookies ? 'SESSION_EXPIRED' : 'UNAUTHORIZED',
      failureMessage: 'Authentication required to access this resource',
    };
  }
}

export async function getAuthenticatedUser(
  request?: NextRequest | null
): Promise<VerifiedAuthContext | null> {
  if (!request) {
    const status = await getServerSessionStatus();
    if (!status.session) return null;
    return status.session;
  }

  const res = await resolveVerifiedAuthFromRequest(request);
  return res.auth;
}

/**
 * Requires a verified authenticated user session.
 * Throws `AuthError` (`401`) with consistent `UNAUTHORIZED` or `SESSION_EXPIRED` error codes.
 */
export async function requireAuth(
  request?: NextRequest | null
): Promise<VerifiedAuthContext> {
  if (!request) {
    const status = await getServerSessionStatus();
    if (!status.session) {
      if (status.failureReason === 'SESSION_EXPIRED') {
        throw new AuthError(
          'Your session has expired or is no longer valid. Please sign in again.',
          'SESSION_EXPIRED',
          401
        );
      }
      if (status.failureReason === 'ACCOUNT_DELETED') {
        throw new AuthError('This account is no longer active.', 'SESSION_REVOKED', 401);
      }
      throw new AuthError('Authentication required to access this resource', 'UNAUTHORIZED', 401);
    }
    return status.session;
  }

  const res = await resolveVerifiedAuthFromRequest(request);
  if (!res.auth) {
    throw new AuthError(
      res.failureMessage || 'Authentication required to access this resource',
      res.failureCode || 'UNAUTHORIZED',
      401
    );
  }
  return res.auth;
}

/**
 * Converts AuthError / NotFoundError cleanly into standardized JSON API responses
 * and clears stale cookies when an expired or revoked session is detected.
 */
export function buildAuthOrNotFoundResponse(
  error: AuthError | NotFoundError,
  request?: NextRequest | null
): NextResponse {
  const response = apiError(error.code, error.message, error.statusCode);
  response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');

  if (
    request &&
    error instanceof AuthError &&
    (error.code === 'SESSION_EXPIRED' || error.code === 'SESSION_REVOKED')
  ) {
    clearAllAuthCookies(request, response);
  }

  return response;
}

/**
 * Strict Multi-Tenant Authorization Guard against Supabase Postgres (RLS + userId filter):
 * Returns NotFoundError (404) if job does not exist or belongs to another user.
 */
export async function requireJobOwnership(
  jobId: string,
  userId: string,
  request?: NextRequest | null,
  options: { skipUuidCheck?: boolean } = {}
) {
  if (!jobId || !userId) {
    throw new NotFoundError('Analysis job not found');
  }

  // Note: allow explicit mock IDs in existing tests when running under route test mocks,
  // while rejecting non-UUID paths in live production/DB lookups safely.
  if (!options.skipUuidCheck && process.env.NODE_ENV !== 'test' && !isValidUuid(jobId)) {
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

/**
 * Strict Multi-Tenant Authorization Guard for Blueprint ownership via parent AnalysisJob.
 */
export async function requireBlueprintOwnership(
  jobId: string,
  userId: string,
  request?: NextRequest | null
) {
  const job = await requireJobOwnership(jobId, userId, request);
  const blueprints = Array.isArray((job as any).blueprint_artifacts)
    ? (job as any).blueprint_artifacts
    : [];

  if (blueprints.length === 0) {
    throw new NotFoundError('Blueprint artifact not found');
  }

  return { job, blueprint: blueprints[0] };
}
