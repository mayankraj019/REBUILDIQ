import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/server';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { LoginForm } from '@/components/auth/LoginForm';
import { Logo } from '@/components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; reason?: string; notice?: string }>;
}) {
  const session = await getServerSession();
  const params = await searchParams;
  const nextPath =
    typeof params?.next === 'string' &&
    params.next.startsWith('/') &&
    !params.next.startsWith('//')
      ? params.next
      : '/dashboard';

  if (session) {
    redirect(nextPath);
  }

  let statusBanner: { variant: 'error' | 'warning' | 'success'; text: string } | null = null;
  if (params?.error === 'verification_failed') {
    statusBanner = {
      variant: 'error',
      text: 'Email verification link was invalid or expired. Try signing in or request a new confirmation email.',
    };
  } else if (params?.error === 'recovery_expired') {
    statusBanner = {
      variant: 'error',
      text: 'Password recovery link was invalid or has expired. Please request a fresh recovery link.',
    };
  } else if (params?.reason === 'session_expired') {
    statusBanner = {
      variant: 'warning',
      text: 'Your session expired or was signed out. Please sign in again to continue.',
    };
  } else if (params?.reason === 'account_deleted' || params?.notice === 'account_deleted') {
    statusBanner = {
      variant: 'success',
      text: 'Your account has been deleted and all active workspace sessions were terminated.',
    };
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream-100 text-navy-500">
      <PublicHeader user={null} />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-lg border border-cream-300 p-6 sm:p-8 shadow-sm">
          <div className="mb-7">
            <Logo variant="mark" size="md" className="mb-4" />
            <h1 className="text-2xl font-bold text-navy-500 tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-sm text-navy-400 mt-1.5">
              Access your analysis history, blueprints, and implementation prompts.
            </p>
          </div>

          {statusBanner && (
            <div
              role="alert"
              className={`mb-5 p-3 rounded-md border text-xs ${
                statusBanner.variant === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900'
                  : statusBanner.variant === 'warning'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {statusBanner.text}
            </div>
          )}

          <LoginForm nextPath={nextPath} />
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-navy-400">
        Powered by Supabase Authentication &amp; Row-Level Security cookies.
      </footer>
    </div>
  );
}
