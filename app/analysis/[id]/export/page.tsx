import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { loadAnalysisDetailOrNotFound } from '@/lib/analysis/loader';
import { AppShell } from '@/components/layout/AppShell';
import { AnalysisWorkspaceShell } from '@/components/analysis/AnalysisWorkspaceShell';
import { ExportInterfaceView } from '@/components/analysis/ExportInterfaceView';

export const dynamic = 'force-dynamic';

export default async function AnalysisExportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireServerAuth(`/analysis/${id}/export`);
  const job = await loadAnalysisDetailOrNotFound(id, session.user.id);

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: job.normalizedDomain, href: `/analysis/${id}` },
        { label: 'Export' },
      ]}
    >
      <AnalysisWorkspaceShell job={job}>
        <ExportInterfaceView job={job} />
      </AnalysisWorkspaceShell>
    </AppShell>
  );
}
