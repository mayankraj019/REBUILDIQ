import { type EmailOtpType } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import {
  extractVerifiedJwtMetadata,
  loadSafeUserProfile,
  recordLoginSessionAudit,
} from '@/lib/auth/session-audit';
import { clearAllAuthCookies } from '@/lib/auth/errors';

/**
 * PKCE & Email OTP verification callback for Supabase signup confirmations,
 * email updates, and password recovery links (`/auth/confirm`).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const rawNext = searchParams.get('next') ?? '/dashboard';
  const safeNext =
    rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  const isRecoveryFlow = type === 'recovery' || safeNext.startsWith('/update-password');

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = safeNext;
  redirectTo.search = '';
  if (isRecoveryFlow) {
    redirectTo.searchParams.set('recovery', '1');
  }

  const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      const loaded = await loadSafeUserProfile(supabase, data.user.id);
      if (loaded.deleted) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        const blocked = request.nextUrl.clone();
        blocked.pathname = '/login';
        blocked.search = '?reason=account_deleted';
        const res = NextResponse.redirect(blocked);
        clearAllAuthCookies(request, res);
        return applyAuthResponseHeaders(res);
      }

      const jwtMeta = await extractVerifiedJwtMetadata(
        supabase,
        data.session?.access_token,
        data.session?.expires_at
      );

      const response = NextResponse.redirect(redirectTo);
      await recordLoginSessionAudit({
        supabase,
        request,
        response,
        userId: data.user.id,
        authSessionId: jwtMeta.authSessionId,
        expiresAtIso: jwtMeta.expiresAt.toISOString(),
        authMethod: isRecoveryFlow ? 'recovery_pkce' : 'pkce_confirm',
      });
      return applyAuthResponseHeaders(response);
    }
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error && data.user) {
      const loaded = await loadSafeUserProfile(supabase, data.user.id);
      if (loaded.deleted) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        const blocked = request.nextUrl.clone();
        blocked.pathname = '/login';
        blocked.search = '?reason=account_deleted';
        const res = NextResponse.redirect(blocked);
        clearAllAuthCookies(request, res);
        return applyAuthResponseHeaders(res);
      }

      const jwtMeta = await extractVerifiedJwtMetadata(
        supabase,
        data.session?.access_token,
        data.session?.expires_at
      );

      const response = NextResponse.redirect(redirectTo);
      await recordLoginSessionAudit({
        supabase,
        request,
        response,
        userId: data.user.id,
        authSessionId: jwtMeta.authSessionId,
        expiresAtIso: jwtMeta.expiresAt.toISOString(),
        authMethod: `otp_${type}`,
      });
      return applyAuthResponseHeaders(response);
    }
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = '/login';
  errorUrl.search = isRecoveryFlow
    ? '?error=recovery_expired'
    : '?error=verification_failed';
  return NextResponse.redirect(errorUrl);
}
