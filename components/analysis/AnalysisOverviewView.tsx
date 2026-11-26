'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Monitor,
  Tablet,
  Smartphone,
  Trash2,
  Ban,
  ArrowRight,
  Layers,
  Type,
  Palette,
  LayoutGrid,
} from 'lucide-react';
import { AnalysisJobDetail, JobStatus } from '@/lib/analysis/types';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { JobStatusBadge } from './JobStatusBadge';

export interface AnalysisOverviewViewProps {
  job: AnalysisJobDetail;
}

type PreviewSimulationState = 'completed' | 'running' | 'failed' | 'loading';

const PIPELINE_STEPS = [
  { key: 'VALIDATING', label: 'Pre-flight SSRF & DNS' },
  { key: 'INSPECTING', label: 'Browser Inspection' },
  { key: 'EXTRACTING_EVIDENCE', label: 'Evidence Extraction' },
  { key: 'ANALYZING_AI', label: 'AI Synthesis' },
  { key: 'COMPLETED', label: 'Blueprint Ready' },
];

function getStepState(
  stepIndex: number,
  status: JobStatus
): 'done' | 'current' | 'failed' | 'pending' {
  if (status === 'COMPLETED') return 'done';
  if (status === 'FAILED' || status === 'CANCELLED') {
    return stepIndex === 0 ? 'failed' : 'pending';
  }
  const map: Record<string, number> = {
    PENDING: 0,
    VALIDATING: 0,
    QUEUED: 1,
    INSPECTING: 1,
    EXTRACTING_EVIDENCE: 2,
    ANALYZING_AI: 3,
    GENERATING_BLUEPRINT: 3,
  };
  const currentIdx = map[status] ?? 0;
  if (stepIndex < currentIdx) return 'done';
  if (stepIndex === currentIdx) return 'current';
  return 'pending';
}

export const AnalysisOverviewView: React.FC<AnalysisOverviewViewProps> = ({ job }) => {
  const [evidenceTab, setEvidenceTab] = useState<'typography' | 'colors' | 'dom' | 'screenshots'>('typography');
  const [previewState, setPreviewState] = useState<PreviewSimulationState>('completed');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const effectiveStatus: JobStatus = job.isPreviewFixture
    ? previewState === 'running'
      ? 'INSPECTING'
      : previewState === 'failed'
      ? 'FAILED'
      : 'COMPLETED'
    : job.status;

  const effectiveProgress = job.isPreviewFixture
    ? previewState === 'running'
      ? 45
      : previewState === 'failed'
      ? 15
      : 100
    : job.progressPercent;

  const firstEvidence = job.evidence[0] || null;

  const handleDisconnectedJobAction = (actionName: string) => {
    setDeleteDialogOpen(false);
    setActionMessage(
      `${actionName} requires the /api/jobs/[id] backend worker controls (scheduled for Phases 3–4). No database records were modified.`
    );
  };

  const handleConfirmDelete = async () => {
    if (job.isPreviewFixture) {
      handleDisconnectedJobAction('Preview analysis deletion');
      return;
    }

    setIsDeleting(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setDeleteDialogOpen(false);
        setActionMessage(
          payload?.error?.message || 'Unable to delete this analysis record.'
        );
        setIsDeleting(false);
        return;
      }
      window.location.href = '/history';
    } catch {
      setDeleteDialogOpen(false);
      setActionMessage('Network error while attempting to delete analysis record.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Preview-Only Component State Switcher (for testing Loading, Running, Failed, Completed UI states) */}
      {job.isPreviewFixture && (
        <div className="bg-white rounded-lg border border-cream-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-navy-500">
              Preview Component State Inspector
            </p>
            <p className="text-[11px] text-navy-400">
              Switch UI states below to verify loading skeletons, in-progress tracking, error banners, and populated evidence views.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Preview UI states">
            {(
              [
                { id: 'completed', label: 'Completed' },
                { id: 'running', label: 'In Progress' },
                { id: 'failed', label: 'SSRF / Failed' },
                { id: 'loading', label: 'Loading State' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPreviewState(opt.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
                  previewState === opt.id
                    ? 'bg-coral-500 text-white'
                    : 'bg-cream-100 text-navy-500 hover:bg-cream-200 border border-cream-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {actionMessage && (
        <Alert variant="info" title="Backend endpoint awaiting Phases 3–4" onClose={() => setActionMessage(null)}>
          {actionMessage}
        </Alert>
      )}

      {/* Simulated Loading Skeleton View (when toggled in preview mode) */}
      {job.isPreviewFixture && previewState === 'loading' ? (
        <div className="space-y-6" aria-label="Loading analysis details">
          <div className="bg-white rounded-lg border border-cream-300 p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-full" />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
          <div className="bg-white rounded-lg border border-cream-300 p-6 space-y-4">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-44 w-full" />
          </div>
        </div>
      ) : (
        <>
          {/* Pipeline Status & Progress Panel */}
          <section
            aria-labelledby="pipeline-status-heading"
            className="bg-white rounded-lg border border-cream-300 p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <h2 id="pipeline-status-heading" className="text-base font-bold text-navy-500">
                  Execution Progress
                </h2>
                <JobStatusBadge status={effectiveStatus} />
              </div>

              <div className="flex items-center space-x-2">
                {effectiveStatus !== 'COMPLETED' && effectiveStatus !== 'FAILED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Ban className="w-3.5 h-3.5" />}
                    onClick={() => handleDisconnectedJobAction('Job cancellation')}
                  >
                    Cancel Job
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-red-600" />}
                  onClick={() => setDeleteDialogOpen(true)}
                  className="text-red-700 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>
            </div>

            <Progress
              value={effectiveProgress}
              showPercent
              label={
                effectiveStatus === 'COMPLETED'
                  ? 'Pipeline complete — empirical evidence & blueprint ready'
                  : effectiveStatus === 'FAILED'
                  ? 'Execution halted'
                  : 'Worker pipeline stage progress (SSE stream awaits Phases 3–4)'
              }
            />

            {/* Step Indicators */}
            <ol className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-1">
              {PIPELINE_STEPS.map((step, idx) => {
                const state = getStepState(idx, effectiveStatus);
                return (
                  <li
                    key={step.key}
                    className={`p-3 rounded-md border text-xs flex items-center sm:flex-col sm:items-start gap-2.5 ${
                      state === 'done'
                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                        : state === 'current'
                        ? 'bg-coral-50 border-coral-300 text-navy-500 font-semibold'
                        : state === 'failed'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-cream-50/50 border-cream-200 text-navy-400'
                    }`}
                  >
                    {state === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    ) : state === 'failed' ? (
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                    ) : (
                      <Clock
                        className={`w-4 h-4 shrink-0 ${
                          state === 'current' ? 'text-coral-500' : 'text-navy-300'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                    <span>{step.label}</span>
                  </li>
                );
              })}
            </ol>

            {/* Error State Detail */}
            {effectiveStatus === 'FAILED' && (
              <Alert variant="error" title={job.errorCode || 'SSRF_BLOCKED — Navigation Aborted'}>
                {job.errorMessage ||
                  'Target resolution matched a restricted subnet (169.254.169.254 / loopback) or timed out during controlled browser navigation. Re-check the destination URL and retry.'}
              </Alert>
            )}

            {/* Next Step Banner when Completed */}
            {effectiveStatus === 'COMPLETED' && job.blueprint && (
              <div className="pt-2 border-t border-cream-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-navy-400">
                  Empirical page evidence captured. Review inferred architecture or jump straight to prompts.
                </p>
                <div className="flex items-center space-x-2.5 shrink-0">
                  <Link href={`/analysis/${job.id}/blueprint`}>
                    <Button variant="outline" size="sm">
                      Open Blueprint Viewer
                    </Button>
                  </Link>
                  <Link href={`/analysis/${job.id}/prompts`}>
                    <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                      Edit Prompts
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </section>

          {/* Observed Ground Truth Inspector */}
          <section
            aria-labelledby="observed-evidence-heading"
            className="bg-white rounded-lg border border-cream-300 p-5 sm:p-6 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2.5">
                  <h2 id="observed-evidence-heading" className="text-base font-bold text-navy-500">
                    Observed Ground Truth Inspector
                  </h2>
                  <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Observed Evidence
                  </span>
                </div>
                <p className="text-xs text-navy-400 mt-1">
                  Measured DOM and computed CSS signals — strictly separated from AI inferences.
                </p>
              </div>
              {firstEvidence && effectiveStatus === 'COMPLETED' && (
                <div className="text-xs font-mono text-navy-400">
                  {firstEvidence.domNodeCount} DOM nodes captured
                </div>
              )}
            </div>

            {effectiveStatus !== 'COMPLETED' || !firstEvidence ? (
              <EmptyState
                icon={<Layers className="w-6 h-6 text-navy-400" />}
                title={
                  effectiveStatus === 'FAILED'
                    ? 'No evidence extracted'
                    : 'Waiting for browser evidence capture'
                }
                description={
                  effectiveStatus === 'FAILED'
                    ? 'Inspection halted before DOM and style extraction completed.'
                    : 'Typography, palette clusters, semantic DOM outline, and viewport screenshots appear once the browser worker finishes inspection.'
                }
              />
            ) : (
              <div className="space-y-5">
                <Tabs
                  activeTab={evidenceTab}
                  onChange={(t) => setEvidenceTab(t as typeof evidenceTab)}
                  tabs={[
                    {
                      id: 'typography',
                      label: 'Typography',
                      icon: <Type className="w-3.5 h-3.5" />,
                      count: firstEvidence.typography.length,
                    },
                    {
                      id: 'colors',
                      label: 'Color Palette',
                      icon: <Palette className="w-3.5 h-3.5" />,
                      count: firstEvidence.colors.length,
                    },
                    {
                      id: 'dom',
                      label: 'DOM & Spacing',
                      icon: <LayoutGrid className="w-3.5 h-3.5" />,
                      count: firstEvidence.domOutline.length,
                    },
                    {
                      id: 'screenshots',
                      label: 'Viewports',
                      icon: <Monitor className="w-3.5 h-3.5" />,
                      count: firstEvidence.screenshots.length,
                    },
                  ]}
                />

                {/* Typography Tab */}
                {evidenceTab === 'typography' && (
                  <div className="divide-y divide-cream-200 border border-cream-200 rounded-md">
                    {firstEvidence.typography.map((item, i) => (
                      <div
                        key={i}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <span className="text-xs font-semibold text-navy-500">{item.role}</span>
                          <p className="text-xs font-mono text-navy-400">
                            {item.fontFamily} &middot; {item.fontSize} / {item.lineHeight} &middot; w{item.fontWeight}
                          </p>
                        </div>
                        {item.sampleText && (
                          <p className="text-sm text-navy-500 font-medium truncate max-w-md">
                            &ldquo;{item.sampleText}&rdquo;
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Colors Tab */}
                {evidenceTab === 'colors' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {firstEvidence.colors.map((swatch, i) => (
                      <div
                        key={i}
                        className="flex items-center space-x-3 p-3 rounded-md border border-cream-300 bg-cream-50/40"
                      >
                        <div
                          className="w-10 h-10 rounded border border-cream-400 shrink-0"
                          style={{ backgroundColor: swatch.hex }}
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-navy-500">
                              {swatch.hex}
                            </span>
                            {swatch.frequencyPercent !== undefined && (
                              <span className="text-[11px] font-mono text-navy-400">
                                ({swatch.frequencyPercent}%)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-navy-400 truncate">{swatch.usage}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* DOM & Spacing Tab */}
                {evidenceTab === 'dom' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                        Semantic Landmark Outline
                      </h3>
                      <div className="border border-cream-200 rounded-md divide-y divide-cream-200">
                        {firstEvidence.domOutline.map((node, i) => (
                          <div key={i} className="p-3 flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-2 min-w-0">
                              <code className="px-1.5 py-0.5 rounded bg-navy-500 text-white font-mono text-[11px]">
                                &lt;{node.tag}&gt;
                              </code>
                              <span className="text-navy-500 truncate">{node.label}</span>
                            </div>
                            <span className="font-mono text-navy-400 shrink-0 ml-2">
                              {node.childrenCount} children
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                        Computed Spacing &amp; Layout Metrics
                      </h3>
                      <div className="border border-cream-200 rounded-md divide-y divide-cream-200">
                        {firstEvidence.spacing.map((metric, i) => (
                          <div key={i} className="p-3 flex items-center justify-between text-xs gap-3">
                            <div>
                              <p className="font-semibold text-navy-500">{metric.token}</p>
                              <p className="font-mono text-[11px] text-navy-400">{metric.context}</p>
                            </div>
                            <span className="font-mono font-bold text-navy-500 shrink-0">
                              {metric.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Screenshots / Viewports Tab */}
                {evidenceTab === 'screenshots' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {firstEvidence.screenshots.map((shot) => {
                      const Icon =
                        shot.viewportType === 'MOBILE'
                          ? Smartphone
                          : shot.viewportType === 'TABLET'
                          ? Tablet
                          : Monitor;

                      return (
                        <div
                          key={shot.id}
                          className="rounded-md border border-cream-300 bg-cream-50 p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center space-x-1.5 text-xs font-bold text-navy-500">
                              <Icon className="w-3.5 h-3.5 text-coral-500" aria-hidden="true" />
                              <span>{shot.viewportType}</span>
                            </span>
                            <span className="text-[11px] font-mono text-navy-400">
                              {shot.width} &times; {shot.height}
                            </span>
                          </div>

                          <div className="aspect-[16/10] rounded border border-dashed border-cream-400 bg-white flex flex-col items-center justify-center p-4 text-center">
                            <Icon className="w-6 h-6 text-navy-300 mb-2" aria-hidden="true" />
                            <p className="text-xs font-medium text-navy-500">
                              {shot.storageKey.startsWith('preview-fixture://')
                                ? 'Viewport capture slot (Preview Fixture)'
                                : `Stored artifact: ${shot.storageKey}`}
                            </p>
                            <p className="text-[11px] text-navy-400 mt-1">
                              Live PNG rendering connects once Phase 3 storage driver is wired.
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Structured Execution Audit Log */}
          <section
            aria-labelledby="audit-log-heading"
            className="bg-white rounded-lg border border-cream-300 p-5 sm:p-6 space-y-4"
          >
            <h2 id="audit-log-heading" className="text-sm font-bold text-navy-500">
              Job Audit Log
            </h2>

            {job.auditLogs.length === 0 ? (
              <p className="text-xs text-navy-400">No audit log events recorded yet.</p>
            ) : (
              <div className="bg-navy-500 text-cream-100 rounded-md p-4 font-mono text-xs space-y-2 overflow-x-auto">
                {job.auditLogs.map((entry) => (
                  <div key={entry.id} className="flex items-start space-x-3">
                    <span className="text-cream-300/70 shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-coral-400 font-semibold shrink-0">[{entry.stage}]</span>
                    <span className="text-cream-100">{entry.message}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        title="Delete analysis record?"
        description="This action deletes the analysis record, captured page evidence, screenshots, and blueprints."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isDeleting}
              onClick={handleConfirmDelete}
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-400">
          Target: <span className="font-mono font-semibold text-navy-500">{job.targetUrl}</span>
        </p>
      </Dialog>
    </div>
  );
};
