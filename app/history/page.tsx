import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { getUserAnalysisJobs } from '@/lib/analysis/loader';
import { AppShell } from '@/components/layout/AppShell';
import { HistoryClient } from '@/components/history/HistoryClient';

export const dynamic = 'force-dynamic';

export default async function HistoryPage() {
  const session = await requireServerAuth('/history');
  const jobs = await getUserAnalysisJobs(session.user.id);

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Analysis History' },
      ]}
    >
      <HistoryClient jobs={jobs} />
    </AppShell>
  );
}
