import type { DurableJobStatus } from './state-machine';

export type DiscoveredPageStatus =
  | 'DISCOVERED'
  | 'QUEUED'
  | 'INSPECTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED';

export type PromptTargetTool = 'antigravity' | 'cursor' | 'claude' | 'generic';

export type ExportFormatType =
  | 'prompts-md'
  | 'blueprint-md'
  | 'blueprint-json'
  | 'tailwind-ts'
  | 'evidence-json'
  | 'zip';

export type ExportRecordStatus = 'PENDING' | 'READY' | 'FAILED' | 'EXPIRED';

export type JobEventType =
  | 'JOB_CREATED'
  | 'STATUS_TRANSITION'
  | 'WORKER_CLAIMED'
  | 'HEARTBEAT'
  | 'STALE_RECOVERED'
  | 'PAGE_DISCOVERED'
  | 'EVIDENCE_CAPTURED'
  | 'AI_COMPLETED'
  | 'BLUEPRINT_GENERATED'
  | 'EXPORT_CREATED'
  | 'JOB_CANCELLED'
  | 'JOB_FAILED';

export interface CreateAnalysisJobInput {
  userId: string;
  targetUrl: string;
  crawlDepth?: number;
  viewports?: Array<'mobile' | 'tablet' | 'desktop'>;
  idempotencyKey?: string | null;
  initialStatus?: 'PENDING' | 'VALIDATING' | 'QUEUED';
  maxAttempts?: number;
  retentionDays?: number;
}

export interface UpsertDiscoveredPageInput {
  url: string;
  depth?: number;
  isEntryPage?: boolean;
  status?: DiscoveredPageStatus;
  httpStatus?: number | null;
  errorCode?: string | null;
}

export interface RecordScreenshotInput {
  viewportType: 'MOBILE' | 'TABLET' | 'DESKTOP';
  width: number;
  height: number;
  storageBucket?: string;
  storageKey: string;
  fileHash: string;
  fileSizeBytes: number;
  mimeType?: string;
}

export interface RecordPageEvidenceInput {
  discoveredPageId?: string | null;
  pageUrl: string;
  pageTitle: string;
  metaTags: Record<string, unknown>;
  domStructure: unknown;
  computedTypography: unknown;
  computedColors: unknown;
  computedSpacing: unknown;
  detectedComponents: unknown;
  domNodeCount: number;
  domSnapshotStorageKey?: string | null;
  screenshots?: RecordScreenshotInput[];
  eventIdempotencyKey?: string;
}

export interface ImplementationPromptInput {
  phaseNumber: number;
  targetTool?: PromptTargetTool;
  title: string;
  objective: string;
  promptMarkdown: string;
  isEditedByUser?: boolean;
}

export interface SaveAnalysisAndBlueprintInput {
  provider: 'gemini' | 'mock';
  modelName: string;
  architectureSummary: string;
  detectedPatterns: unknown;
  designTokenSummary: unknown;
  evidenceCoverage: unknown;
  confidenceScore?: number | null;
  rawArtifactStorageKey?: string | null;
  blueprintVersion?: string;
  designSystemSpec: unknown;
  componentArchitecture: unknown;
  stateInteractions: unknown;
  recommendedStack: unknown;
  blueprintStorageKey?: string | null;
  prompts: ImplementationPromptInput[];
  markCompleted?: boolean;
}

export interface RecordExportInput {
  format: ExportFormatType;
  storageKey?: string | null;
  fileHash?: string | null;
  fileSizeBytes?: number | null;
  status?: ExportRecordStatus;
  expiresInDays?: number;
}

export interface DeletedJobStorageCleanup {
  deletedJobId: string;
  storageKeysToRemove: string[];
}

export interface RetentionPurgeSummary {
  expiredExportsDeleted: number;
  expiredJobsDeleted: number;
  storageKeysToRemove: string[];
}

export interface JobStatusTransitionOptions {
  workerId?: string | null;
  progressPercent?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  durationMs?: number | null;
  message?: string;
  eventIdempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface JobLifecycleRepository {
  createJob(input: CreateAnalysisJobInput): Promise<{ job: any; deduplicated: boolean }>;
  transitionJobStatus(
    jobId: string,
    userId: string,
    toStatus: DurableJobStatus,
    options?: JobStatusTransitionOptions
  ): Promise<any>;
  cancelJob(jobId: string, userId: string, reason?: string): Promise<any>;
  claimNextQueuedJob(workerId: string, leaseDurationMs?: number): Promise<any | null>;
  recoverStaleJobs(now?: Date): Promise<{ requeued: number; failed: number }>;
  deleteJobForUser(jobId: string, userId: string): Promise<DeletedJobStorageCleanup>;
  purgeExpiredRetentionData(now?: Date): Promise<RetentionPurgeSummary>;
}
