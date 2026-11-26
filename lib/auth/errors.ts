import { NextRequest, NextResponse } from 'next/server';

export const SESSION_AUDIT_COOKIE_NAME = 'rebuildiq_sid';

export interface SanitizedAuthError {
  code: string;
  statusCode: number;
  message: string;
}

/**
 * Normalizes upstream Supabase Auth errors into sanitized, non-leaky client responses.
 * Prevents internal GoTrue details, SQL messages, or email-existence leaks from surfacing.
 */
export function mapSupabaseAuthError(
  error: { message?: string; code?: string; status?: number } | null | undefined,
  flow: 'login' | 'register' | 'recovery' | 'password_update' | 'resend' | 'otp'
): SanitizedAuthError {
  const code = (error?.code || '').toLowerCase();
  const message = (error?.message || '').toLowerCase();
  const status = error?.status;

  if (
    status === 429 ||
    code.includes('rate_limit') ||
    message.includes('rate limit') ||
    message.includes('security purposes') ||
    message.includes('too many requests')
  ) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      statusCode: 429,
      message: 'Too many authentication requests. Please wait a moment before trying again.',
    };
  }

  if (flow === 'login') {
    if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
      return {
        code: 'EMAIL_NOT_CONFIRMED',
        statusCode: 401,
        message:
          'Please verify your email address via the confirmation link sent to your inbox before signing in.',
      };
    }

    return {
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
      message: 'Invalid email or password',
    };
  }

  if (flow === 'register') {
    if (
      status === 422 ||
      code === 'user_already_exists' ||
      code === 'email_exists' ||
      message.includes('already registered') ||
      message.includes('already exists')
    ) {
      return {
        code: 'ACCOUNT_EXISTS',
        statusCode: 409,
        message: 'An account with this email address already exists',
      };
    }

    if (
      code === 'weak_password' ||
      message.includes('password') ||
      message.includes('pwned') ||
      message.includes('compromised')
    ) {
      return {
        code: 'WEAK_PASSWORD',
        statusCode: 400,
        message:
          'Password does not meet security requirements or appears in known breached password lists. Choose a stronger password.',
      };
    }

    if (code === 'signup_disabled') {
      return {
        code: 'SIGNUP_DISABLED',
        statusCode: 403,
        message: 'New account registration is currently disabled by administrator policy.',
      };
    }

    return {
      code: 'REGISTRATION_FAILED',
      statusCode: 400,
      message: 'Unable to complete registration with the provided information.',
    };
  }

  if (flow === 'password_update') {
    if (code === 'same_password' || message.includes('different from the old password')) {
      return {
        code: 'VALIDATION_FAILED',
        statusCode: 400,
        message: 'New password must differ from your current password.',
      };
    }

    if (
      code === 'weak_password' ||
      message.includes('weak') ||
      message.includes('pwned') ||
      message.includes('password')
    ) {
      return {
        code: 'WEAK_PASSWORD',
        statusCode: 400,
        message:
          'New password does not satisfy security policy requirements or has appeared in public breaches.',
      };
    }

    if (code === 'reauthentication_needed' || message.includes('reauthentication')) {
      return {
        code: 'REAUTHENTICATION_REQUIRED',
        statusCode: 401,
        message: 'Please sign in again recently before changing your password.',
      };
    }

    return {
      code: 'PASSWORD_UPDATE_FAILED',
      statusCode: 400,
      message: 'Unable to update your password. Verify your current credentials and try again.',
    };
  }

  if (flow === 'otp') {
    return {
      code: 'TOKEN_EXPIRED',
      statusCode: 401,
      message: 'Verification link is invalid or has expired.',
    };
  }

  // Recovery and resend flows intentionally avoid leaking internal error specifics
  return {
    code: 'AUTH_REQUEST_FAILED',
    statusCode: 400,
    message: 'Unable to process authentication request. Please try again shortly.',
  };
}

/**
 * Checks whether an incoming NextRequest carries any Supabase SSR auth cookies.
 */
export function hasSupabaseAuthCookies(request: NextRequest): boolean {
  return request.cookies.getAll().some(
    (c) =>
      (c.name.startsWith('sb-') && c.name.includes('-auth-token')) ||
      c.name === SESSION_AUDIT_COOKIE_NAME
  );
}

/**
 * Clears all Supabase SSR auth cookies and local session correlation cookies on a NextResponse.
 */
export function clearAllAuthCookies(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const isProd = process.env.NODE_ENV === 'production';

  for (const cookie of request.cookies.getAll()) {
    if (
      (cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token')) ||
      cookie.name === SESSION_AUDIT_COOKIE_NAME
    ) {
      response.cookies.set({
        name: cookie.name,
        value: '',
        path: '/',
        maxAge: 0,
        expires: new Date(0),
        httpOnly: cookie.name === SESSION_AUDIT_COOKIE_NAME,
        sameSite: 'lax',
        secure: isProd,
      });
    }
  }

  // Ensure session audit cookie is cleared even if omitted from incoming cookie list
  response.cookies.set({
    name: SESSION_AUDIT_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
  });

  response.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
  return response;
}
