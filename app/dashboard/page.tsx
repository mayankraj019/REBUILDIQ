import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { getUserAnalysisJobs } from '@/lib/analysis/loader';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardClient } from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireServerAuth('/dashboard');
  const jobs = await getUserAnalysisJobs(session.user.id);

  return (
    <AppShell
      user={session.user}
      pageTitle="Dashboard"
      breadcrumb={[{ label: 'Dashboard' }]}
    >
      <DashboardClient userName={session.user.name} jobs={jobs} />
    </AppShell>
  );
}
