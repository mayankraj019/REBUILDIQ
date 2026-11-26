import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';

/**
 * PKCE & Email OTP verification callback for Supabase confirmation & recovery links.
 * Supports both `?code=...` (default Supabase PKCE redirect) and `?token_hash=...&type=...`
 * (custom SSR email templates).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const safeNext =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = safeNext;
  redirectTo.searchParams.delete('code');
  redirectTo.searchParams.delete('token_hash');
  redirectTo.searchParams.delete('type');
  redirectTo.searchParams.delete('next');

  const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await supabase.from('user_sessions').insert({
        user_id: data.user.id,
        ip_address: request.headers.get('x-forwarded-for') ?? null,
        user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
        auth_method: 'pkce_confirm',
        expires_at: data.session?.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : null,
      });

      const response = NextResponse.redirect(redirectTo);
      return applyAuthResponseHeaders(response);
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error && data.user) {
      await supabase.from('user_sessions').insert({
        user_id: data.user.id,
        ip_address: request.headers.get('x-forwarded-for') ?? null,
        user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
        auth_method: `otp_${type}`,
        expires_at: data.session?.expires_at
          ? new Date(data.session.expires_at * 1000).toISOString()
          : null,
      });

      const response = NextResponse.redirect(redirectTo);
      return applyAuthResponseHeaders(response);
    }
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = '/login';
  errorUrl.search = '?error=verification_failed';
  return NextResponse.redirect(errorUrl);
}
