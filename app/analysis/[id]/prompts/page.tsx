import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { loadAnalysisDetailOrNotFound } from '@/lib/analysis/loader';
import { AppShell } from '@/components/layout/AppShell';
import { AnalysisWorkspaceShell } from '@/components/analysis/AnalysisWorkspaceShell';
import { PromptEditorView } from '@/components/analysis/PromptEditorView';

export const dynamic = 'force-dynamic';

export default async function AnalysisPromptsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireServerAuth(`/analysis/${id}/prompts`);
  const job = await loadAnalysisDetailOrNotFound(id, session.user.id);

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: job.normalizedDomain, href: `/analysis/${id}` },
        { label: 'Prompt Editor' },
      ]}
    >
      <AnalysisWorkspaceShell job={job}>
        <PromptEditorView job={job} />
      </AnalysisWorkspaceShell>
    </AppShell>
  );
}
