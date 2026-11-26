import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import {
  LoginInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import { clearAllAuthCookies, mapSupabaseAuthError } from '@/lib/auth/errors';
import {
  extractVerifiedJwtMetadata,
  loadSafeUserProfile,
  recordLoginSessionAudit,
  resolveSafeDisplayName,
} from '@/lib/auth/session-audit';
import {
  RATE_LIMIT_POLICIES,
  attachRateLimitHeaders,
  evaluateRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthLogin');

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request);
    const ipRateCheck = evaluateRateLimits([
      { policy: RATE_LIMIT_POLICIES.AUTH_LOGIN_IP, identifier: clientIp },
    ]);
    if (!ipRateCheck.allowed) {
      log.warn('Login IP rate limit triggered', { ip: clientIp });
      return rateLimitExceededResponse(ipRateCheck);
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

    const parsed = LoginInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid login credentials provided',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, password } = parsed.data;
    const accountRateCheck = evaluateRateLimits([
      {
        policy: RATE_LIMIT_POLICIES.AUTH_LOGIN_ACCOUNT,
        identifier: `${clientIp}:${email}`,
      },
    ]);
    if (!accountRateCheck.allowed) {
      log.warn('Login account rate limit triggered', { ip: clientIp });
      return rateLimitExceededResponse(accountRateCheck);
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      const mapped = mapSupabaseAuthError(error, 'login');
      return apiError(mapped.code, mapped.message, mapped.statusCode);
    }

    // Load synced public.users row & reject soft-deleted accounts
    const loaded = await loadSafeUserProfile(supabase, data.user.id);
    if (loaded.deleted) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      const revokedResponse = apiError(
        'ACCOUNT_DELETED',
        'This account has been scheduled for deletion and can no longer be accessed.',
        403
      );
      clearAllAuthCookies(request, revokedResponse);
      return applyAuthResponseHeaders(revokedResponse);
    }

    const jwtMeta = await extractVerifiedJwtMetadata(
      supabase,
      data.session.access_token,
      data.session.expires_at
    );

    const profile = loaded.profile;
    const resolvedName = resolveSafeDisplayName(
      profile?.name,
      email,
      data.user.user_metadata as Record<string, unknown> | undefined
    );

    const response = apiSuccess({
      user: {
        id: profile?.id || data.user.id,
        email: profile?.email || data.user.email || email,
        name: resolvedName,
        role: profile?.role || 'USER',
        emailVerified: Boolean(data.user.email_confirmed_at),
        defaultPromptTarget: profile?.defaultPromptTarget || 'antigravity',
        createdAt: profile?.createdAt || data.user.created_at,
      },
    });

    await recordLoginSessionAudit({
      supabase,
      request,
      response,
      userId: data.user.id,
      authSessionId: jwtMeta.authSessionId,
      expiresAtIso: jwtMeta.expiresAt.toISOString(),
      authMethod: 'password',
    });

    attachRateLimitHeaders(response, accountRateCheck);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Login error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred during login',
      500
    );
  }
}
