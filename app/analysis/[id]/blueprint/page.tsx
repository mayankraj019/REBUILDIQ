import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { loadAnalysisDetailOrNotFound } from '@/lib/analysis/loader';
import { AppShell } from '@/components/layout/AppShell';
import { AnalysisWorkspaceShell } from '@/components/analysis/AnalysisWorkspaceShell';
import { BlueprintViewerView } from '@/components/analysis/BlueprintViewerView';

export const dynamic = 'force-dynamic';

export default async function AnalysisBlueprintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireServerAuth(`/analysis/${id}/blueprint`);
  const job = await loadAnalysisDetailOrNotFound(id, session.user.id);

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: job.normalizedDomain, href: `/analysis/${id}` },
        { label: 'Blueprint' },
      ]}
    >
      <AnalysisWorkspaceShell job={job}>
        <BlueprintViewerView job={job} />
      </AnalysisWorkspaceShell>
    </AppShell>
  );
}
