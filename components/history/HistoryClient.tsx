'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  History as HistoryIcon,
  FileCode2,
  Download,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { AnalysisJobSummary } from '@/lib/analysis/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { Table, Column } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { JobStatusBadge } from '@/components/analysis/JobStatusBadge';

export interface HistoryClientProps {
  jobs: AnalysisJobSummary[];
}

const ACTIVE_GROUP = new Set([
  'PENDING',
  'VALIDATING',
  'QUEUED',
  'INSPECTING',
  'EXTRACTING_EVIDENCE',
  'ANALYZING_AI',
  'GENERATING_BLUEPRINT',
]);

export const HistoryClient: React.FC<HistoryClientProps> = ({ jobs }) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'active' | 'failed'>('all');

  const counts = useMemo(() => {
    return {
      all: jobs.length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
      active: jobs.filter((j) => ACTIVE_GROUP.has(j.status)).length,
      failed: jobs.filter((j) => j.status === 'FAILED' || j.status === 'CANCELLED').length,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return jobs.filter((job) => {
      if (statusFilter === 'completed' && job.status !== 'COMPLETED') return false;
      if (statusFilter === 'active' && !ACTIVE_GROUP.has(job.status)) return false;
      if (
        statusFilter === 'failed' &&
        job.status !== 'FAILED' &&
        job.status !== 'CANCELLED'
      ) {
        return false;
      }

      if (q) {
        return (
          job.normalizedDomain.toLowerCase().includes(q) ||
          job.targetUrl.toLowerCase().includes(q) ||
          job.id.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [jobs, searchQuery, statusFilter]);

  const columns: Column<AnalysisJobSummary>[] = [
    {
      header: 'Domain & URL',
      accessor: (row) => (
        <div className="min-w-0">
          <Link
            href={`/analysis/${row.id}`}
            className="font-semibold text-navy-500 hover:text-coral-500 block truncate max-w-[260px]"
          >
            {row.normalizedDomain}
          </Link>
          <span className="text-xs font-mono text-navy-400 block truncate max-w-[260px]">
            {row.targetUrl}
          </span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => <JobStatusBadge status={row.status} />,
    },
    {
      header: 'Viewports',
      accessor: (row) => (
        <span className="text-xs font-mono text-navy-400">
          {row.viewports.join(', ')}
        </span>
      ),
    },
    {
      header: 'Pages',
      align: 'center',
      accessor: (row) => <span className="text-xs font-mono">{row.pageCount}</span>,
    },
    {
      header: 'Timestamp',
      accessor: (row) => (
        <span className="text-xs text-navy-400">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (row) => (
        <div className="flex items-center justify-end space-x-2">
          <Link
            href={`/analysis/${row.id}`}
            className="inline-flex items-center space-x-1 text-xs font-medium text-navy-500 hover:text-coral-500 px-2 py-1 rounded hover:bg-cream-100"
          >
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open</span>
          </Link>
          {row.hasBlueprint && (
            <>
              <Link
                href={`/analysis/${row.id}/blueprint`}
                className="inline-flex items-center space-x-1 text-xs font-medium text-navy-500 hover:text-coral-500 px-2 py-1 rounded hover:bg-cream-100"
              >
                <FileCode2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Blueprint</span>
              </Link>
              <Link
                href={`/analysis/${row.id}/export`}
                className="inline-flex items-center space-x-1 text-xs font-medium text-coral-600 hover:text-coral-700 px-2 py-1 rounded hover:bg-coral-50"
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-500">
            Analysis History
          </h1>
          <p className="text-sm text-navy-400 mt-1">
            Browse, filter, and inspect every website analysis scoped to your account.
          </p>
        </div>

        <Link href="/analysis/new" className="shrink-0">
          <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}>
            New Analysis
          </Button>
        </Link>
      </div>

      {/* Filters Toolbar */}
      <div className="space-y-4">
        <div className="max-w-md">
          <Input
            aria-label="Search analyses by domain or URL"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by domain, URL, or job ID..."
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>

        <Tabs
          activeTab={statusFilter}
          onChange={(tab) => setStatusFilter(tab as typeof statusFilter)}
          tabs={[
            { id: 'all', label: 'All Jobs', count: counts.all },
            { id: 'completed', label: 'Completed', count: counts.completed },
            { id: 'active', label: 'In Progress', count: counts.active },
            { id: 'failed', label: 'Failed', count: counts.failed },
          ]}
        />
      </div>

      {/* Results Area */}
      {jobs.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={<HistoryIcon className="w-6 h-6 text-navy-400" />}
            title="No analysis history yet"
            description="Once website inspections run against your account, their timestamps, viewports, extracted evidence, and exported blueprints appear here."
            actionLabel="Configure First Analysis"
            onAction={() => router.push('/analysis/new')}
          />

          <div className="bg-white rounded-lg border border-cream-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5 text-xs text-navy-400">
              <Eye className="w-4 h-4 text-coral-500 shrink-0" aria-hidden="true" />
              <span>
                You can review a non-persisted interactive sample record inside the UI Preview Workspace.
              </span>
            </div>
            <Link href="/analysis/preview" className="text-xs font-semibold text-coral-600 hover:text-coral-700 shrink-0">
              View UI Preview &rarr;
            </Link>
          </div>
        </div>
      ) : filteredJobs.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6 text-navy-400" />}
          title="No analyses match these filters"
          description="Try clearing your search term or switching back to All Jobs."
          actionLabel="Clear Filters"
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <Table columns={columns} data={filteredJobs} keyExtractor={(r) => r.id} />
          </div>

          <div className="md:hidden space-y-3">
            {filteredJobs.map((row) => (
              <div
                key={row.id}
                className="bg-white rounded-lg border border-cream-300 p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      href={`/analysis/${row.id}`}
                      className="font-semibold text-sm text-navy-500 block truncate"
                    >
                      {row.normalizedDomain}
                    </Link>
                    <p className="text-xs font-mono text-navy-400 truncate">{row.targetUrl}</p>
                  </div>
                  <JobStatusBadge status={row.status} />
                </div>
                <div className="text-xs text-navy-400">
                  {new Date(row.createdAt).toLocaleString()} &middot; {row.viewports.join(', ')}
                </div>
                <div className="pt-2 border-t border-cream-200 flex items-center gap-4 text-xs font-semibold">
                  <Link href={`/analysis/${row.id}`} className="text-navy-500">
                    Details
                  </Link>
                  {row.hasBlueprint && (
                    <>
                      <Link href={`/analysis/${row.id}/blueprint`} className="text-navy-500">
                        Blueprint
                      </Link>
                      <Link href={`/analysis/${row.id}/export`} className="text-coral-600">
                        Export
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
