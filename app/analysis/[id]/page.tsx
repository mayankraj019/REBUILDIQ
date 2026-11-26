import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { loadAnalysisDetailOrNotFound } from '@/lib/analysis/loader';
import { AppShell } from '@/components/layout/AppShell';
import { AnalysisWorkspaceShell } from '@/components/analysis/AnalysisWorkspaceShell';
import { AnalysisOverviewView } from '@/components/analysis/AnalysisOverviewView';

export const dynamic = 'force-dynamic';

export default async function AnalysisDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireServerAuth(`/analysis/${id}`);
  const job = await loadAnalysisDetailOrNotFound(id, session.user.id);

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'History', href: '/history' },
        { label: job.normalizedDomain },
      ]}
    >
      <AnalysisWorkspaceShell job={job}>
        <AnalysisOverviewView job={job} />
      </AnalysisWorkspaceShell>
    </AppShell>
  );
}
