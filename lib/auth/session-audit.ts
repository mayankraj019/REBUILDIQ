import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from '@/lib/supabase/database.types';
import { SESSION_AUDIT_COOKIE_NAME } from './errors';

export interface VerifiedJwtMetadata {
  authSessionId: string | null;
  expiresAt: Date;
}

export interface LoadedUserProfile {
  profile: {
    id: string;
    email: string;
    name: string;
    role: string;
    defaultPromptTarget: 'antigravity' | 'cursor' | 'claude';
    createdAt: string;
  } | null;
  deleted: boolean;
}

function getAuditCookieSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[session-audit] SESSION_SECRET environment variable is required in production. ' +
        'Set a random string of at least 32 characters.'
    );
  }
  // Dev/test fallback — ephemeral and non-sensitive
  return secret ?? 'rebuildiq-dev-session-audit-fallback-key';
}

export function signSessionAuditToken(sessionRowId: string, userId: string): string {
  const payload = `${sessionRowId}.${userId}`;
  const sig = crypto
    .createHmac('sha256', getAuditCookieSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifySessionAuditToken(
  rawCookie: string | null | undefined,
  expectedUserId: string
): { sessionRowId: string; userId: string } | null {
  if (!rawCookie || typeof rawCookie !== 'string') {
    return null;
  }

  const parts = rawCookie.split('.');
  if (parts.length !== 3) {
    return null;
  }

  const [sessionRowId, userId, signature] = parts;
  if (!sessionRowId || !userId || !signature || userId !== expectedUserId) {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', getAuditCookieSecret())
    .update(`${sessionRowId}.${userId}`)
    .digest('hex');

  const actualBuf = Buffer.from(signature, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (
    actualBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(actualBuf, expectedBuf)
  ) {
    return null;
  }

  return { sessionRowId, userId };
}

export function attachSessionAuditCookie(
  response: NextResponse,
  sessionRowId: string,
  userId: string,
  expiresAt: Date
): void {
  response.cookies.set({
    name: SESSION_AUDIT_COOKIE_NAME,
    value: signSessionAuditToken(sessionRowId, userId),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

function decodeJwtPayloadUnsafe(token: string | undefined): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extracts verified `session_id` and `exp` from Supabase `getClaims()` when available,
 * or from an already-verified access token issued during login/OTP exchange.
 */
export async function extractVerifiedJwtMetadata(
  supabase: SupabaseClient<Database> | any,
  verifiedAccessToken?: string,
  fallbackExpiresAtSec?: number
): Promise<VerifiedJwtMetadata> {
  const defaultExpiry = fallbackExpiresAtSec
    ? new Date(fallbackExpiresAtSec * 1000)
    : new Date(Date.now() + 3600 * 1000);

  try {
    if (typeof supabase?.auth?.getClaims === 'function') {
      const { data } = await supabase.auth.getClaims();
      const claims = data?.claims as Record<string, unknown> | undefined;
      if (claims) {
        const expSec = typeof claims.exp === 'number' ? claims.exp : undefined;
        const sessionId = typeof claims.session_id === 'string' ? claims.session_id : null;
        return {
          authSessionId: sessionId,
          expiresAt: expSec ? new Date(expSec * 1000) : defaultExpiry,
        };
      }
    }
  } catch {
    // Fall through safely to token payload extraction below
  }

  if (verifiedAccessToken) {
    const payload = decodeJwtPayloadUnsafe(verifiedAccessToken);
    if (payload) {
      const expSec = typeof payload.exp === 'number' ? payload.exp : undefined;
      const sessionId = typeof payload.session_id === 'string' ? payload.session_id : null;
      return {
        authSessionId: sessionId,
        expiresAt: expSec ? new Date(expSec * 1000) : defaultExpiry,
      };
    }
  }

  return {
    authSessionId: null,
    expiresAt: defaultExpiry,
  };
}

function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    msg.includes('column') ||
    msg.includes('schema cache')
  );
}

/**
 * Loads user profile from `public.users` enforcing deleted_at checks when present,
 * gracefully compatible with both 000001 and 000002 Supabase schemas.
 */
export async function loadSafeUserProfile(
  supabase: SupabaseClient<Database> | any,
  userId: string
): Promise<LoadedUserProfile> {
  if (typeof supabase?.from !== 'function') {
    return { profile: null, deleted: false };
  }

  try {
    const query = supabase
      .from('users')
      .select('id, email, name, role, created_at, deleted_at, default_prompt_target')
      .eq('id', userId);

    const { data, error } = await query.maybeSingle();

    if (error && isMissingColumnError(error)) {
      const fallbackRes = await supabase
        .from('users')
        .select('id, email, name, role, created_at')
        .eq('id', userId)
        .maybeSingle();

      if (fallbackRes.error || !fallbackRes.data) {
        return { profile: null, deleted: false };
      }

      const row = fallbackRes.data;
      return {
        deleted: false,
        profile: {
          id: row.id,
          email: row.email,
          name: row.name,
          role: row.role || 'USER',
          defaultPromptTarget: 'antigravity',
          createdAt: row.created_at,
        },
      };
    }

    if (error || !data) {
      return { profile: null, deleted: false };
    }

    if (data.deleted_at) {
      return { profile: null, deleted: true };
    }

    const target =
      data.default_prompt_target === 'cursor' || data.default_prompt_target === 'claude'
        ? data.default_prompt_target
        : 'antigravity';

    return {
      deleted: false,
      profile: {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role || 'USER',
        defaultPromptTarget: target,
        createdAt: data.created_at,
      },
    };
  } catch {
    return { profile: null, deleted: false };
  }
}

/**
 * Checks `public.user_sessions` to enforce immediate server-side revocation before JWT expiry.
 */
export async function verifySessionNotRevoked(params: {
  supabase: SupabaseClient<Database> | any;
  userId: string;
  authSessionId: string | null;
  rawAuditCookie?: string | null;
}): Promise<{ valid: boolean; auditSessionId: string | null; reason?: 'SESSION_EXPIRED' }> {
  const { supabase, userId, authSessionId, rawAuditCookie } = params;
  const parsedAudit = verifySessionAuditToken(rawAuditCookie, userId);

  if (rawAuditCookie && !parsedAudit) {
    // Client sent a tampered/corrupted/cross-user audit cookie
    return { valid: false, auditSessionId: null, reason: 'SESSION_EXPIRED' };
  }

  const auditSessionId = parsedAudit?.sessionRowId ?? null;

  if (!auditSessionId && !authSessionId) {
    return { valid: true, auditSessionId: null };
  }

  if (typeof supabase?.from !== 'function') {
    return { valid: true, auditSessionId };
  }

  try {
    const query = supabase.from('user_sessions');
    if (typeof query?.select !== 'function') {
      return { valid: true, auditSessionId };
    }

    if (auditSessionId) {
      const chain = query
        .select('id, revoked_at, expires_at')
        .eq('id', auditSessionId)
        .eq('user_id', userId);

      if (typeof chain?.maybeSingle === 'function') {
        const { data, error } = await chain.maybeSingle();
        if (!error && data) {
          if (data.revoked_at) {
            return { valid: false, auditSessionId, reason: 'SESSION_EXPIRED' };
          }
          if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
            return { valid: false, auditSessionId, reason: 'SESSION_EXPIRED' };
          }
        }
      }
    } else if (authSessionId) {
      const chain = query
        .select('id, revoked_at, expires_at')
        .eq('auth_session_id', authSessionId)
        .eq('user_id', userId);

      if (typeof chain?.maybeSingle === 'function') {
        const { data, error } = await chain.maybeSingle();
        if (!error && data) {
          if (data.revoked_at) {
            return { valid: false, auditSessionId: data.id, reason: 'SESSION_EXPIRED' };
          }
          if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) {
            return { valid: false, auditSessionId: data.id, reason: 'SESSION_EXPIRED' };
          }
          return { valid: true, auditSessionId: data.id };
        }
      }
    }
  } catch {
    // Graceful compatibility if mock client omits nested filter chains
  }

  return { valid: true, auditSessionId };
}

/**
 * Inserts a new `public.user_sessions` record and attaches an HMAC-bound session cookie.
 */
export async function recordLoginSessionAudit(params: {
  supabase: SupabaseClient<Database> | any;
  request: NextRequest;
  response: NextResponse;
  userId: string;
  authSessionId: string | null;
  expiresAtIso: string | null;
  authMethod: string;
}): Promise<string | null> {
  const { supabase, request, response, userId, authSessionId, expiresAtIso, authMethod } = params;
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  const fullRow = {
    user_id: userId,
    auth_session_id: authSessionId,
    ip_address: ipAddress,
    user_agent: userAgent,
    auth_method: authMethod,
    expires_at: expiresAtIso,
  };

  try {
    const table = supabase.from('user_sessions');
    const insertBuilder = table.insert(fullRow);

    if (typeof insertBuilder?.select === 'function') {
      const res = await insertBuilder.select('id').maybeSingle();
      if (res.error && isMissingColumnError(res.error)) {
        const fallbackRow = {
          user_id: userId,
          ip_address: ipAddress,
          user_agent: userAgent,
          auth_method: authMethod,
          expires_at: expiresAtIso,
        };
        const fbRes = await supabase.from('user_sessions').insert(fallbackRow).select('id').maybeSingle();
        if (!fbRes.error && fbRes.data?.id) {
          attachSessionAuditCookie(
            response,
            fbRes.data.id,
            userId,
            expiresAtIso ? new Date(expiresAtIso) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          );
          return fbRes.data.id;
        }
      } else if (!res.error && res.data?.id) {
        attachSessionAuditCookie(
          response,
          res.data.id,
          userId,
          expiresAtIso ? new Date(expiresAtIso) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        );
        return res.data.id;
      }
    } else {
      await insertBuilder;
    }
  } catch {
    // Non-fatal audit logging failure
  }

  return null;
}

export function resolveSafeDisplayName(
  profileName: string | null | undefined,
  email: string | undefined,
  userMetadata?: Record<string, unknown>
): string {
  if (profileName && profileName.trim()) {
    return profileName.trim();
  }
  const metaName =
    typeof userMetadata?.full_name === 'string' && userMetadata.full_name.trim()
      ? userMetadata.full_name.trim()
      : null;
  if (metaName) return metaName;
  return email ? email.split('@')[0] : 'User';
}
