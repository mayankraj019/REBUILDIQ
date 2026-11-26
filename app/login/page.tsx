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
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await getServerSession();
  const params = await searchParams;
  const nextPath =
    typeof params?.next === 'string' &&
    params.next.startsWith('/') &&
    !params.next.startsWith('//')
      ? params.next
      : '/dashboard';
  const authErrorParam = params?.error === 'verification_failed';

  if (session) {
    redirect(nextPath);
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

          {authErrorParam && (
            <div
              role="alert"
              className="mb-5 p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-900"
            >
              Email verification link was invalid or expired. Please try signing in or register again.
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
