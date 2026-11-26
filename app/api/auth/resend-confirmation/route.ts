import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { ResendConfirmationInputSchema } from '@/lib/auth/schemas';
import { mapSupabaseAuthError } from '@/lib/auth/errors';
import {
  RATE_LIMIT_POLICIES,
  attachRateLimitHeaders,
  evaluateRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthResendConfirmation');

const UNIFORM_RESEND_MESSAGE =
  'If that account is pending email verification, a new confirmation link has been sent.';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request);
    const ipLimit = evaluateRateLimits([
      { policy: RATE_LIMIT_POLICIES.AUTH_RESEND_IP, identifier: clientIp },
    ]);
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(ipLimit);
    }

    const body = await request.json().catch(() => null);
    const parsed = ResendConfirmationInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Please provide a valid email address',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email } = parsed.data;
    const emailLimit = evaluateRateLimits([
      { policy: RATE_LIMIT_POLICIES.AUTH_RESEND_EMAIL, identifier: email },
    ]);
    if (!emailLimit.allowed) {
      return rateLimitExceededResponse(emailLimit);
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const origin = request.nextUrl?.origin || process.env.APP_URL || 'http://localhost:3000';

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${origin}/auth/confirm?next=/dashboard`,
      },
    });

    if (error) {
      const mapped = mapSupabaseAuthError(error, 'resend');
      if (mapped.statusCode === 429) {
        return apiError(mapped.code, mapped.message, 429);
      }
      log.warn('Resend confirmation upstream notice', { code: error.code });
    }

    const response = apiSuccess({ message: UNIFORM_RESEND_MESSAGE });
    attachRateLimitHeaders(response, emailLimit);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Resend confirmation error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'Unable to resend confirmation link right now',
      500
    );
  }
}
