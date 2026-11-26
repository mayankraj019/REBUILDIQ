import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/server';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { Logo } from '@/components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
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

  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream-100 text-navy-500">
      <PublicHeader user={null} />

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md bg-white rounded-lg border border-cream-300 p-6 sm:p-8 shadow-sm">
          <div className="mb-7">
            <Logo variant="mark" size="md" className="mb-4" />
            <h1 className="text-2xl font-bold text-navy-500 tracking-tight">
              Create your RebuildIQ account
            </h1>
            <p className="text-sm text-navy-400 mt-1.5">
              Set up multi-tenant workspace access for website inspections and blueprints.
            </p>
          </div>

          <RegisterForm nextPath={nextPath} />
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-navy-400">
        Accounts and workspace data are stored in Supabase Postgres with Row-Level Security.
      </footer>
    </div>
  );
}
