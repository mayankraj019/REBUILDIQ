import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from './database.types';
import { getSupabaseConfig, hasSupabaseConfig } from './config';
import { clearAllAuthCookies, hasSupabaseAuthCookies } from '@/lib/auth/errors';

const PROTECTED_PAGE_PREFIXES = [
  '/dashboard',
  '/history',
  '/analysis',
  '/settings',
  '/update-password',
];

const PROTECTED_API_PREFIXES = [
  '/api/jobs',
  '/api/auth/me',
  '/api/auth/sessions',
  '/api/auth/update-password',
  '/api/auth/account',
];

export function isProtectedPagePath(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isProtectedApiPath(pathname: string): boolean {
  return PROTECTED_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Refreshes expiring Supabase Auth cookies across requests, propagates Cache-Control
 * headers, and enforces fail-closed guards on protected pages & APIs.
 */
export async function updateSupabaseSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!hasSupabaseConfig()) {
    return supabaseResponse;
  }

  const { url, publishableKey } = getSupabaseConfig();
  const hadAuthCookies = hasSupabaseAuthCookies(request);

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        }
      },
    },
  });

  // Always run getClaims() immediately after instantiation to verify JWT & refresh tokens.
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const nowSec = Math.floor(Date.now() / 1000);
  const isExpiredClaim = typeof claims?.exp === 'number' && claims.exp <= nowSec;
  const isAuthenticated = Boolean(!error && claims?.sub && !isExpiredClaim);
  const { pathname, search } = request.nextUrl;

  if (!isAuthenticated) {
    if (isProtectedApiPath(pathname)) {
      const code = hadAuthCookies ? 'SESSION_EXPIRED' : 'UNAUTHORIZED';
      const message = hadAuthCookies
        ? 'Your session has expired or is no longer valid. Please sign in again.'
        : 'Authentication required to access this resource';

      const jsonRes = NextResponse.json(
        {
          success: false,
          error: { code, message },
        },
        {
          status: 401,
          headers: {
            'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
          },
        }
      );

      if (hadAuthCookies) {
        clearAllAuthCookies(request, jsonRes);
      }
      return jsonRes;
    }

    if (isProtectedPagePath(pathname)) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      const fullReturnPath = `${pathname}${search || ''}`;
      loginUrl.search = '';
      loginUrl.searchParams.set('next', fullReturnPath);
      if (hadAuthCookies) {
        loginUrl.searchParams.set('reason', 'session_expired');
      }

      const redirectRes = NextResponse.redirect(loginUrl);
      if (hadAuthCookies) {
        clearAllAuthCookies(request, redirectRes);
      }
      return redirectRes;
    }

    if (hadAuthCookies) {
      clearAllAuthCookies(request, supabaseResponse);
    }
  }

  return supabaseResponse;
}
