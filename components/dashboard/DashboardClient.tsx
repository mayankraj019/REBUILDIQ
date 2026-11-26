'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Globe,
  Plus,
  Clock,
  FileCode2,
  Download,
  Eye,
  FolderOpen,
} from 'lucide-react';
import { AnalysisJobSummary } from '@/lib/analysis/types';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Progress } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, Column } from '@/components/ui/Table';
import { JobStatusBadge } from '@/components/analysis/JobStatusBadge';

export interface DashboardClientProps {
  userName: string;
  jobs: AnalysisJobSummary[];
}

const IN_PROGRESS_STATUSES = new Set([
  'PENDING',
  'VALIDATING',
  'QUEUED',
  'INSPECTING',
  'EXTRACTING_EVIDENCE',
  'ANALYZING_AI',
  'GENERATING_BLUEPRINT',
]);

export const DashboardClient: React.FC<DashboardClientProps> = ({ userName, jobs }) => {
  const router = useRouter();
  const [quickUrl, setQuickUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const activeJobs = jobs.filter((j) => IN_PROGRESS_STATUSES.has(j.status));
  const completedCount = jobs.filter((j) => j.status === 'COMPLETED').length;
  const failedCount = jobs.filter((j) => j.status === 'FAILED' || j.status === 'CANCELLED').length;
  const recentJobs = jobs.slice(0, 6);

  const handleQuickStart = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickUrl.trim();
    if (!trimmed) {
      router.push('/analysis/new');
      return;
    }

    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setUrlError('Only HTTP and HTTPS URLs are supported.');
        return;
      }
      setUrlError(null);
      router.push(`/analysis/new?url=${encodeURIComponent(normalized)}`);
    } catch {
      setUrlError('Enter a valid URL (for example, https://example.com).');
    }
  };

  const columns: Column<AnalysisJobSummary>[] = [
    {
      header: 'Website',
      accessor: (row) => (
        <div className="min-w-0">
          <Link
            href={`/analysis/${row.id}`}
            className="font-semibold text-navy-500 hover:text-coral-500 transition-colors block truncate max-w-[240px]"
          >
            {row.normalizedDomain}
          </Link>
          <span className="text-xs text-navy-400 font-mono truncate block max-w-[240px]">
            {row.targetUrl}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => (
        <div className="space-y-1">
          <JobStatusBadge status={row.status} />
          {IN_PROGRESS_STATUSES.has(row.status) && (
            <div className="w-28">
              <Progress value={row.progressPercent} />
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Pages',
      accessor: (row) => <span className="font-mono text-xs">{row.pageCount}</span>,
      align: 'center',
    },
    {
      header: 'Created',
      accessor: (row) => (
        <span className="text-xs text-navy-400">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Results',
      align: 'right',
      accessor: (row) => (
        <div className="flex items-center justify-end space-x-2">
          <Link
            href={`/analysis/${row.id}`}
            className="text-xs font-medium text-navy-500 hover:text-coral-500 px-2 py-1 rounded hover:bg-cream-100 transition-colors"
          >
            Details
          </Link>
          {row.hasBlueprint && (
            <>
              <Link
                href={`/analysis/${row.id}/blueprint`}
                className="inline-flex items-center space-x-1 text-xs font-medium text-navy-500 hover:text-coral-500 px-2 py-1 rounded hover:bg-cream-100 transition-colors"
              >
                <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Blueprint</span>
              </Link>
              <Link
                href={`/analysis/${row.id}/export`}
                className="inline-flex items-center space-x-1 text-xs font-medium text-coral-600 hover:text-coral-700 px-2 py-1 rounded hover:bg-coral-50 transition-colors"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Export</span>
              </Link>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome & Quick Launch */}
      <section aria-labelledby="dashboard-heading" className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 id="dashboard-heading" className="text-2xl font-bold tracking-tight text-navy-500">
              Welcome back, {userName.split(' ')[0]}
            </h1>
            <p className="text-sm text-navy-400 mt-1">
              Start a controlled website analysis or review existing evidence and blueprints.
            </p>
          </div>
          <Link href="/analysis/new" className="shrink-0">
            <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
              New Analysis
            </Button>
          </Link>
        </div>

        {/* Focused Quick URL Form */}
        <form
          onSubmit={handleQuickStart}
          noValidate
          className="bg-white rounded-lg border border-cream-300 p-4 sm:p-5"
        >
          <label
            htmlFor="dashboard-quick-url"
            className="block text-xs font-semibold uppercase tracking-wider text-navy-500 mb-2"
          >
            Quick URL Launch
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 flex items-center">
              <Globe className="w-4 h-4 text-navy-300 absolute left-3 pointer-events-none" aria-hidden="true" />
              <input
                id="dashboard-quick-url"
                type="url"
                value={quickUrl}
                onChange={(e) => {
                  setQuickUrl(e.target.value);
                  if (urlError) setUrlError(null);
                }}
                placeholder="https://example.com — Configure viewports and scope on next step"
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? 'dashboard-url-error' : undefined}
                className={`w-full h-10 pl-9 pr-3 rounded-md bg-white border text-sm text-navy-500 placeholder-navy-300 focus:outline-none focus:ring-1 ${
                  urlError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                    : 'border-cream-300 focus:border-navy-500 focus:ring-navy-500'
                }`}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Configure Analysis
            </Button>
          </div>
          {urlError && (
            <p id="dashboard-url-error" role="alert" className="mt-2 text-xs text-red-600 font-medium">
              {urlError}
            </p>
          )}
        </form>
      </section>

      {/* Compact Status Summary Strip */}
      <section aria-label="Analysis Summary">
        <div className="bg-white rounded-lg border border-cream-300 grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-cream-200">
          <div className="p-4">
            <p className="text-xs font-medium text-navy-400">Total Analyses</p>
            <p className="text-2xl font-bold text-navy-500 mt-1 font-mono">{jobs.length}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-navy-400">In Progress</p>
            <p className="text-2xl font-bold text-coral-500 mt-1 font-mono">{activeJobs.length}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-navy-400">Completed</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1 font-mono">{completedCount}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium text-navy-400">Failed / Stopped</p>
            <p className="text-2xl font-bold text-navy-400 mt-1 font-mono">{failedCount}</p>
          </div>
        </div>
      </section>

      {/* Active Jobs Section (shown when active DB jobs exist) */}
      {activeJobs.length > 0 && (
        <section aria-labelledby="active-jobs-heading" className="space-y-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-coral-500" aria-hidden="true" />
            <h2 id="active-jobs-heading" className="text-base font-bold text-navy-500">
              Active Jobs ({activeJobs.length})
            </h2>
          </div>

          <div className="space-y-3">
            {activeJobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-lg border border-cream-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="font-semibold text-sm text-navy-500 truncate">
                      {job.normalizedDomain}
                    </span>
                    <JobStatusBadge status={job.status} />
                  </div>
                  <Progress value={job.progressPercent} showPercent label={job.targetUrl} />
                </div>

                <Link href={`/analysis/${job.id}`} className="shrink-0">
                  <Button variant="outline" size="sm">
                    Inspect Progress
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent Analyses */}
      <section aria-labelledby="recent-analyses-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="recent-analyses-heading" className="text-base font-bold text-navy-500">
            Recent Analyses
          </h2>
          {jobs.length > 0 && (
            <Link
              href="/history"
              className="text-xs font-semibold text-coral-600 hover:text-coral-700 inline-flex items-center space-x-1"
            >
              <span>View all history</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        {recentJobs.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={<FolderOpen className="w-6 h-6 text-navy-400" />}
              title="No analyses recorded for your account yet"
              description="Your real workspace starts clean. Configure a target URL to test pre-flight validation, or inspect the sample UI preview workspace to review the blueprint, prompt editor, and export views."
              actionLabel="Start New Analysis"
              onAction={() => router.push('/analysis/new')}
            />

            <div className="bg-white rounded-lg border border-cream-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <Eye className="w-4 h-4 text-coral-500 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs font-semibold text-navy-500">
                    Want to explore the analysis workspace screens now?
                  </p>
                  <p className="text-xs text-navy-400 mt-0.5">
                    Open the clearly labeled sample fixture to test progress states, blueprint viewer, prompt editor, and exports without fake database records.
                  </p>
                </div>
              </div>
              <Link href="/analysis/preview" className="shrink-0">
                <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Open Sample Workspace
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table columns={columns} data={recentJobs} keyExtractor={(r) => r.id} />
            </div>

            {/* Mobile List */}
            <div className="md:hidden space-y-3">
              {recentJobs.map((row) => (
                <div
                  key={row.id}
                  className="bg-white rounded-lg border border-cream-300 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/analysis/${row.id}`}
                        className="font-semibold text-sm text-navy-500 block truncate"
                      >
                        {row.normalizedDomain}
                      </Link>
                      <p className="text-xs text-navy-400 font-mono truncate">{row.targetUrl}</p>
                    </div>
                    <JobStatusBadge status={row.status} />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-cream-200 text-xs">
                    <span className="text-navy-400">
                      {new Date(row.createdAt).toLocaleDateString()} &middot; {row.pageCount} pages
                    </span>
                    <div className="flex items-center space-x-3">
                      <Link href={`/analysis/${row.id}`} className="font-semibold text-navy-500">
                        Details
                      </Link>
                      {row.hasBlueprint && (
                        <Link
                          href={`/analysis/${row.id}/blueprint`}
                          className="font-semibold text-coral-600"
                        >
                          Blueprint
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* Honest Backend Connectivity Banner */}
      <Alert variant="info" title="Backend Service Status">
        User authentication, login session tracking, PostgreSQL RLS, and artifact storage are connected live to Supabase. Automated Playwright crawling (<code className="font-mono">/api/jobs</code>) and live Gemini synthesis are awaiting Phases 3–4 worker implementation.
      </Alert>
    </div>
  );
};
