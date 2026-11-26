import React from 'react';
import { Badge, BadgeProps } from '@/components/ui/Badge';
import { JobStatus } from '@/lib/analysis/types';

const STATUS_META: Record<
  JobStatus,
  { label: string; variant: NonNullable<BadgeProps['variant']> }
> = {
  PENDING: { label: 'Pending', variant: 'default' },
  VALIDATING: { label: 'Validating URL', variant: 'info' },
  QUEUED: { label: 'Queued', variant: 'default' },
  INSPECTING: { label: 'Inspecting Browser', variant: 'coral' },
  EXTRACTING_EVIDENCE: { label: 'Extracting Evidence', variant: 'coral' },
  ANALYZING_AI: { label: 'Synthesizing Blueprint', variant: 'info' },
  GENERATING_BLUEPRINT: { label: 'Generating Prompts', variant: 'info' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'error' },
  CANCELLED: { label: 'Cancelled', variant: 'warning' },
};

export const JobStatusBadge: React.FC<{
  status: JobStatus;
  size?: 'sm' | 'md';
}> = ({ status, size = 'sm' }) => {
  const meta = STATUS_META[status] || { label: status, variant: 'default' as const };
  return (
    <Badge variant={meta.variant} size={size} hasDot>
      {meta.label}
    </Badge>
  );
};
