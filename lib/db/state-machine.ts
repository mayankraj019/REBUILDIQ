import crypto from 'node:crypto';
import { AppError, ValidationError } from '@/lib/errors';

export const DURABLE_JOB_STATUSES = [
  'PENDING',
  'VALIDATING',
  'QUEUED',
  'INSPECTING',
  'EXTRACTING_EVIDENCE',
  'ANALYZING_AI',
  'GENERATING_BLUEPRINT',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type DurableJobStatus = (typeof DURABLE_JOB_STATUSES)[number];

export const ACTIVE_RUNNING_STATUSES: ReadonlySet<DurableJobStatus> = new Set([
  'INSPECTING',
  'EXTRACTING_EVIDENCE',
  'ANALYZING_AI',
  'GENERATING_BLUEPRINT',
]);

export const TERMINAL_JOB_STATUSES: ReadonlySet<DurableJobStatus> = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const ALLOWED_JOB_TRANSITIONS: Record<DurableJobStatus, ReadonlyArray<DurableJobStatus>> = {
  PENDING: ['VALIDATING', 'QUEUED', 'FAILED', 'CANCELLED'],
  VALIDATING: ['QUEUED', 'INSPECTING', 'FAILED', 'CANCELLED'],
  QUEUED: ['INSPECTING', 'FAILED', 'CANCELLED'],
  // Active running phases can advance forward, fail, cancel, or re-queue on stale worker lease recovery
  INSPECTING: ['EXTRACTING_EVIDENCE', 'QUEUED', 'FAILED', 'CANCELLED'],
  EXTRACTING_EVIDENCE: ['ANALYZING_AI', 'QUEUED', 'FAILED', 'CANCELLED'],
  ANALYZING_AI: ['GENERATING_BLUEPRINT', 'QUEUED', 'FAILED', 'CANCELLED'],
  GENERATING_BLUEPRINT: ['COMPLETED', 'QUEUED', 'FAILED', 'CANCELLED'],
  // Terminal states
  COMPLETED: [],
  FAILED: ['QUEUED'],
  CANCELLED: [],
};

export class InvalidStateTransitionError extends AppError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Invalid job state transition: ${fromStatus} -> ${toStatus}`,
      'INVALID_STATE_TRANSITION',
      409,
      { fromStatus, toStatus }
    );
  }
}

export function canTransitionJobStatus(fromStatus: string, toStatus: string): boolean {
  const allowed = ALLOWED_JOB_TRANSITIONS[fromStatus as DurableJobStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus as DurableJobStatus);
}

export function assertValidJobTransition(fromStatus: string, toStatus: string): void {
  if (fromStatus === toStatus) return;
  if (!canTransitionJobStatus(fromStatus, toStatus)) {
    throw new InvalidStateTransitionError(fromStatus, toStatus);
  }
}

export function normalizeDomainFromUrl(urlString: string): string {
  const parsed = new URL(urlString);
  return parsed.hostname.toLowerCase().replace(/^www\./, '');
}

/**
 * Canonicalizes a discovered/inspected URL for idempotent deduplication within a crawl job.
 * Strips hash fragments, lowercases scheme/host, removes default ports, and normalizes trailing slashes.
 */
export function normalizePageUrl(urlString: string): string {
  const parsed = new URL(urlString);
  parsed.hash = '';
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();
  if (
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    (parsed.protocol === 'http:' && parsed.port === '80')
  ) {
    parsed.port = '';
  }
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.toString();
}

/**
 * Enforces object storage reference discipline: prevents storing inline binary payloads
 * or `data:` base64 URIs inside relational database rows.
 */
export function assertSafeObjectStorageKey(storageKey: string, fieldName = 'storageKey'): string {
  const trimmed = storageKey.trim();
  if (!trimmed) {
    throw new ValidationError(`${fieldName} cannot be empty`);
  }
  if (trimmed.toLowerCase().startsWith('data:')) {
    throw new ValidationError(
      `${fieldName} must reference object storage rather than inline base64 data URIs`
    );
  }
  if (trimmed.length > 500) {
    throw new ValidationError(`${fieldName} cannot exceed 500 characters`);
  }
  return trimmed;
}

export function sha256Hex(content: string | Buffer): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}
