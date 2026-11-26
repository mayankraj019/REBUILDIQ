import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { Database } from './database.types';
import { getSupabaseConfig } from './config';

interface PendingCookie {
  name: string;
  value: string;
  options: CookieOptions;
}

/**
 * Route Handler Supabase client.
 * Reads cookies from NextRequest and queues Set-Cookie + Cache-Control security
 * headers to be attached directly onto any returned NextResponse (avoiding next/headers
 * request-store errors during isolated route tests).
 */
export function createSupabaseRouteClient(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map((c) => ({
          name: c.name,
          value: c.value,
        }));
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach((cookie) => {
          pendingCookies.push(cookie);
        });
        if (headersToSet) {
          Object.entries(headersToSet).forEach(([k, v]) => {
            pendingHeaders[k] = v;
          });
        }
      },
    },
  });

  /**
   * Attaches queued auth cookies and anti-caching headers onto the outgoing NextResponse.
   */
  function applyAuthResponseHeaders(response: NextResponse): NextResponse {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    for (const [key, value] of Object.entries(pendingHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  }

  return { supabase, applyAuthResponseHeaders };
}
