import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { ForgotPasswordInputSchema } from '@/lib/auth/schemas';
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

const log = logger.forContext('AuthForgotPassword');

const UNIFORM_RECOVERY_MESSAGE =
  'If an account matches this email address, password recovery instructions have been sent.';

export async function POST(request: NextRequest) {
  try {
    const clientIp = extractClientIp(request);
    const ipLimit = evaluateRateLimits([
      { policy: RATE_LIMIT_POLICIES.AUTH_RECOVERY_IP, identifier: clientIp },
    ]);
    if (!ipLimit.allowed) {
      return rateLimitExceededResponse(ipLimit);
    }

    const body = await request.json().catch(() => null);
    const parsed = ForgotPasswordInputSchema.safeParse(body);
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
      { policy: RATE_LIMIT_POLICIES.AUTH_RECOVERY_EMAIL, identifier: email },
    ]);
    if (!emailLimit.allowed) {
      return rateLimitExceededResponse(emailLimit);
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const origin = request.nextUrl?.origin || process.env.APP_URL || 'http://localhost:3000';

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/update-password`,
    });

    if (error) {
      const mapped = mapSupabaseAuthError(error, 'recovery');
      if (mapped.statusCode === 429) {
        return apiError(mapped.code, mapped.message, 429);
      }
      // Log internally without revealing account status or provider details to caller
      log.warn('Password recovery upstream notice', { code: error.code });
    }

    const response = apiSuccess({ message: UNIFORM_RECOVERY_MESSAGE });
    attachRateLimitHeaders(response, emailLimit);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Forgot password error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'Unable to process password recovery request',
      500
    );
  }
}
