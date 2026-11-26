import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { RegisterInputSchema } from '@/lib/auth/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthRegister');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
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
        emailRedirectTo: `${origin}/auth/confirm`,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        error.status === 422 ||
        msg.includes('already registered') ||
        msg.includes('already exists')
      ) {
        return apiError(
          'ACCOUNT_EXISTS',
          'An account with this email address already exists',
          409
        );
      }

      log.warn('Supabase registration rejected', { code: error.code, status: error.status });
      return apiError(
        'REGISTRATION_FAILED',
        error.message || 'Unable to register account',
        error.status && error.status >= 400 && error.status < 500 ? error.status : 400
      );
    }

    // Supabase obfuscates existing unconfirmed/duplicate accounts with empty identities array
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

    // If session is issued immediately, record login event in public.user_sessions (RLS enforced)
    if (data.session) {
      const ipAddress = request.headers.get('x-forwarded-for') ?? null;
      const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;
      const expiresAt = data.session.expires_at
        ? new Date(data.session.expires_at * 1000).toISOString()
        : null;

      await supabase.from('user_sessions').insert({
        user_id: data.user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        auth_method: 'register',
        expires_at: expiresAt,
      });
    }

    const response = apiSuccess(
      {
        user: {
          id: data.user.id,
          email: data.user.email || email,
          name,
          role: 'USER',
          createdAt: data.user.created_at,
        },
        requiresEmailConfirmation,
      },
      201
    );

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
