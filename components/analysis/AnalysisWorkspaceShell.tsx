'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  FileCode2,
  Terminal,
  Download,
  ExternalLink,
  ArrowLeft,
} from 'lucide-react';
import { AnalysisJobSummary } from '@/lib/analysis/types';
import { JobStatusBadge } from './JobStatusBadge';
import { Alert } from '@/components/ui/Alert';

export interface AnalysisWorkspaceShellProps {
  job: AnalysisJobSummary;
  children: React.ReactNode;
}

export const AnalysisWorkspaceShell: React.FC<AnalysisWorkspaceShellProps> = ({
  job,
  children,
}) => {
  const pathname = usePathname();
  const baseHref = `/analysis/${job.id}`;

  const tabs = [
    {
      href: baseHref,
      label: 'Details & Evidence',
      icon: Activity,
      isActive: pathname === baseHref,
    },
    {
      href: `${baseHref}/blueprint`,
      label: 'Blueprint Viewer',
      icon: FileCode2,
      isActive: pathname === `${baseHref}/blueprint`,
    },
    {
      href: `${baseHref}/prompts`,
      label: 'Prompt Editor',
      icon: Terminal,
      isActive: pathname === `${baseHref}/prompts`,
    },
    {
      href: `${baseHref}/export`,
      label: 'Export',
      icon: Download,
      isActive: pathname === `${baseHref}/export`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sample Fixture Transparency Banner */}
      {job.isPreviewFixture && (
        <Alert
          variant="warning"
          title="Sample UI Preview Fixture (Not a Live Website Scan)"
        >
          This workspace renders illustrative fixture data so you can inspect the progress view, observed evidence inspector, blueprint viewer, prompt editor, and export interface while automated worker and AI backend services (Phases 3–4) remain disconnected.
        </Alert>
      )}

      {/* Analysis Header */}
      <div className="bg-white rounded-lg border border-cream-300 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0 space-y-1.5">
            <Link
              href="/history"
              className="inline-flex items-center space-x-1 text-xs font-medium text-navy-400 hover:text-navy-500 transition-colors mb-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Analysis History</span>
            </Link>

            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-navy-500 truncate">
                {job.normalizedDomain}
              </h1>
              <JobStatusBadge status={job.status} size="md" />
              {job.isPreviewFixture && (
                <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cream-200 text-navy-500 border border-cream-300">
                  Preview Fixture
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-navy-400">
              <a
                href={job.targetUrl}
                target="_blank"
                rel="noreferrer"
                className="font-mono hover:text-coral-500 inline-flex items-center space-x-1 truncate max-w-full"
              >
                <span className="truncate">{job.targetUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
              </a>
              <span>&middot;</span>
              <span>Depth: {job.crawlDepth} page{job.crawlDepth > 1 ? 's' : ''}</span>
              <span>&middot;</span>
              <span>Viewports: {job.viewports.join(', ')}</span>
              {job.durationMs !== null && (
                <>
                  <span>&middot;</span>
                  <span className="font-mono">{(job.durationMs / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Route-Connected Sub-Navigation Tabs */}
        <nav
          aria-label="Analysis Workspace Navigation"
          className="flex items-center space-x-1 overflow-x-auto border-t border-cream-200 pt-3 -mb-1"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={tab.isActive ? 'page' : undefined}
                className={`inline-flex items-center space-x-2 px-3.5 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
                  tab.isActive
                    ? 'bg-navy-500 text-white'
                    : 'text-navy-400 hover:text-navy-500 hover:bg-cream-100'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${tab.isActive ? 'text-coral-400' : ''}`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sub-Page Body */}
      <div>{children}</div>
    </div>
  );
};
