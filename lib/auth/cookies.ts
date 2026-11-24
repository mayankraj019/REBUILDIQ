import { NextResponse, NextRequest } from 'next/server';
import { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';

export const SESSION_COOKIE_NAME = 'rebuildiq_session';

export function getSessionCookieOptions(expiresAt?: Date): Partial<ResponseCookie> {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  };
}

/**
 * Extracts the session token from cookies or Authorization Bearer header.
 */
export function getSessionToken(request?: NextRequest | null): string | null {
  if (!request) {
    return null;
  }

  // 1. Read from cookie in request
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (cookie?.value) {
    return cookie.value;
  }

  // 2. Fallback to Authorization Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

/**
 * Sets the session cookie on a NextResponse object.
 */
export function attachSessionCookie(
  response: NextResponse,
  rawToken: string,
  expiresAt: Date
): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: rawToken,
    ...getSessionCookieOptions(expiresAt),
  });
  return response;
}

/**
 * Clears the session cookie on a NextResponse object.
 */
export function removeSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    ...getSessionCookieOptions(new Date(0)),
    maxAge: 0,
  });
  return response;
}
