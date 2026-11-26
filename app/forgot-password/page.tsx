import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/server';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';
import { Logo } from '@/components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function ForgotPasswordPage() {
  const session = await getServerSession();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream-100 text-navy-500">
      <PublicHeader user={null} />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-lg border border-cream-300 p-6 sm:p-8 shadow-sm">
          <div className="mb-7">
            <Logo variant="mark" size="md" className="mb-4" />
            <h1 className="text-2xl font-bold text-navy-500 tracking-tight">
              Reset your password
            </h1>
            <p className="text-sm text-navy-400 mt-1.5">
              Enter your registered email address to receive a secure PKCE password recovery link.
            </p>
          </div>

          <ForgotPasswordForm />
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-navy-400">
        Recovery tokens are single-use and verified server-side.
      </footer>
    </div>
  );
}
