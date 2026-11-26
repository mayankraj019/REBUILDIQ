import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import {
  RegisterInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import { mapSupabaseAuthError } from '@/lib/auth/errors';
import {
  extractVerifiedJwtMetadata,
  recordLoginSessionAudit,
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

const log = logger.forContext('AuthRegister');

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request);
    const rateCheck = evaluateRateLimits([
      { policy: RATE_LIMIT_POLICIES.AUTH_REGISTER, identifier: clientIp },
    ]);
    if (!rateCheck.allowed) {
      log.warn('Registration rate limit triggered', { ip: clientIp });
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

    const parsed = RegisterInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid registration data',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, name, password } = parsed.data;
    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

    const origin = request.nextUrl?.origin || process.env.APP_URL || 'http://localhost:3000';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
        emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      },
    });

    if (error) {
      const mapped = mapSupabaseAuthError(error, 'register');
      log.warn('Supabase registration rejected', {
        code: mapped.code,
        status: mapped.statusCode,
      });
      return apiError(mapped.code, mapped.message, mapped.statusCode);
    }

    // Supabase obfuscates existing confirmed/unconfirmed duplicate emails with empty identities array
    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return apiError(
        'ACCOUNT_EXISTS',
        'An account with this email address already exists',
        409
      );
    }

    if (!data.user) {
      return apiError(
        'REGISTRATION_FAILED',
        'Account registration could not be completed',
        400
      );
    }

    const requiresEmailConfirmation = !data.session;
    const response = apiSuccess(
      {
        user: {
          id: data.user.id,
          email: data.user.email || email,
          name,
          role: 'USER',
          emailVerified: Boolean(data.user.email_confirmed_at),
          createdAt: data.user.created_at,
        },
        requiresEmailConfirmation,
      },
      201
    );

    if (data.session) {
      const jwtMeta = await extractVerifiedJwtMetadata(
        supabase,
        data.session.access_token,
        data.session.expires_at
      );

      await recordLoginSessionAudit({
        supabase,
        request,
        response,
        userId: data.user.id,
        authSessionId: jwtMeta.authSessionId,
        expiresAtIso: jwtMeta.expiresAt.toISOString(),
        authMethod: 'register',
      });
    }

    attachRateLimitHeaders(response, rateCheck);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Registration error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred during registration',
      500
    );
  }
}
