import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { AppShell } from '@/components/layout/AppShell';
import { NewAnalysisForm } from '@/components/analysis/NewAnalysisForm';

export const dynamic = 'force-dynamic';

export default async function NewAnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const session = await requireServerAuth('/analysis/new');
  const params = await searchParams;
  const initialUrl = typeof params?.url === 'string' ? params.url : '';

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'New Analysis' },
      ]}
    >
      <NewAnalysisForm initialUrl={initialUrl} />
    </AppShell>
  );
}
