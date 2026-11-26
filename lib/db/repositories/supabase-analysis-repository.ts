import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import { NotFoundError } from '@/lib/auth/middleware';
import { ValidationError, ConflictError } from '@/lib/errors';
import {
  ACTIVE_RUNNING_STATUSES,
  TERMINAL_JOB_STATUSES,
  assertSafeObjectStorageKey,
  assertValidJobTransition,
  normalizeDomainFromUrl,
  normalizePageUrl,
  sha256Hex,
  type DurableJobStatus,
} from '@/lib/db/state-machine';
import type {
  CreateAnalysisJobInput,
  DeletedJobStorageCleanup,
  JobLifecycleRepository,
  JobStatusTransitionOptions,
  RecordExportInput,
  RecordPageEvidenceInput,
  RetentionPurgeSummary,
  SaveAnalysisAndBlueprintInput,
  UpsertDiscoveredPageInput,
} from '@/lib/db/types';

type AnalysisJobRow = Database['public']['Tables']['analysis_jobs']['Row'];
type PostgrestErrorLike = { message: string; code?: string } | null | undefined;

function isMissingRelationError(error: PostgrestErrorLike): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    error.code === 'PGRST200'
  );
}

function assertSupabaseData<T>(
  data: T | null,
  error: PostgrestErrorLike,
  context: string
): T {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
  if (data === null) {
    throw new Error(`${context}: unexpected empty response`);
  }
  return data;
}

function toJsonValue(value: unknown): Json {
  return value as Json;
}

/**
 * RLS-aware Supabase Data-Access Repository implementing RebuildIQ's full domain model.
 * Uses authenticated user-scoped clients for tenant operations and service-role clients
 * for background worker lease claiming, stale recovery, and retention sweeps.
 */
export class SupabaseAnalysisRepository implements JobLifecycleRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  private async verifyJobOwnership(
    jobId: string,
    userId: string
  ): Promise<AnalysisJobRow> {
    const { data, error } = await this.supabase
      .from('analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundError('Analysis job not found');
    }

    return data;
  }

  private async recordJobEventSafe(
    entry: Database['public']['Tables']['job_events']['Insert']
  ): Promise<void> {
    const { error } = await this.supabase.from('job_events').insert(entry);
    if (error && !isMissingRelationError(error)) {
      if (error.code === '23505') return;
      throw new Error(`Failed to record job event: ${error.message}`);
    }
  }

  private async recordAuditLogSafe(
    entry: Database['public']['Tables']['job_audit_logs']['Insert']
  ): Promise<void> {
    const { error } = await this.supabase.from('job_audit_logs').insert(entry);
    if (error && !isMissingRelationError(error)) {
      throw new Error(`Failed to record audit log: ${error.message}`);
    }
  }

  async createJob(
    input: CreateAnalysisJobInput
  ): Promise<{ job: AnalysisJobRow; deduplicated: boolean }> {
    const normalizedDomain = normalizeDomainFromUrl(input.targetUrl);
    const normalizedEntryUrl = normalizePageUrl(input.targetUrl);
    const initialStatus = input.initialStatus ?? 'QUEUED';
    const crawlDepth = input.crawlDepth ?? 1;
    const viewports = input.viewports ?? ['desktop', 'tablet', 'mobile'];
    const retentionDays = input.retentionDays ?? 90;
    const expiresAt = new Date(
      Date.now() + retentionDays * 24 * 60 * 60 * 1000
    ).toISOString();

    if (input.idempotencyKey) {
      const { data: existing } = await this.supabase
        .from('analysis_jobs')
        .select('*')
        .eq('user_id', input.userId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();

      if (existing) {
        return { job: existing, deduplicated: true };
      }
    }

    const { data, error } = await this.supabase
      .from('analysis_jobs')
      .insert({
        user_id: input.userId,
        target_url: input.targetUrl,
        normalized_domain: normalizedDomain,
        status: initialStatus,
        crawl_depth: crawlDepth,
        viewports_config: toJsonValue(viewports),
        idempotency_key: input.idempotencyKey ?? null,
        max_attempts: input.maxAttempts ?? 3,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (error?.code === '23505' && input.idempotencyKey) {
      const { data: existing } = await this.supabase
        .from('analysis_jobs')
        .select('*')
        .eq('user_id', input.userId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();

      if (existing) {
        return { job: existing, deduplicated: true };
      }
    }

    const createdJob = assertSupabaseData(data, error, 'Failed to create analysis job');

    const { error: pageErr } = await this.supabase.from('discovered_pages').upsert(
      {
        job_id: createdJob.id,
        url: input.targetUrl,
        normalized_url: normalizedEntryUrl,
        depth: 0,
        is_entry_page: true,
        status: 'DISCOVERED',
      },
      { onConflict: 'job_id,normalized_url' }
    );
    if (pageErr && !isMissingRelationError(pageErr)) {
      throw new Error(`Failed to record entry discovered page: ${pageErr.message}`);
    }

    await this.recordJobEventSafe({
      job_id: createdJob.id,
      event_type: 'JOB_CREATED',
      to_status: initialStatus,
      idempotency_key: `job-created:${createdJob.id}`,
      message: `Created analysis job for ${normalizedDomain}`,
      metadata: toJsonValue({ crawlDepth, viewports }),
    });

    await this.recordAuditLogSafe({
      job_id: createdJob.id,
      stage: initialStatus,
      level: 'INFO',
      message: `Created durable analysis job for ${normalizedDomain}`,
    });

    return { job: createdJob, deduplicated: false };
  }

  async listJobsForUser(userId: string) {
    const { data, error } = await this.supabase
      .from('analysis_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to list analysis jobs: ${error.message}`);
    }
    return data ?? [];
  }

  async requireOwnedJobBundle(jobId: string, userId: string) {
    const job = await this.verifyJobOwnership(jobId, userId);

    const [
      evidenceRes,
      blueprintsRes,
      auditLogsRes,
      discoveredRes,
      resultsRes,
      promptsRes,
      exportsRes,
      eventsRes,
    ] = await Promise.all([
      this.supabase
        .from('page_evidence')
        .select('*, visual_screenshots(*)')
        .eq('job_id', jobId)
        .order('extracted_at', { ascending: true }),
      this.supabase
        .from('blueprint_artifacts')
        .select('*')
        .eq('job_id', jobId)
        .order('generated_at', { ascending: false }),
      this.supabase
        .from('job_audit_logs')
        .select('*')
        .eq('job_id', jobId)
        .order('timestamp', { ascending: true }),
      this.supabase
        .from('discovered_pages')
        .select('*')
        .eq('job_id', jobId)
        .order('depth', { ascending: true }),
      this.supabase
        .from('analysis_results')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle(),
      this.supabase
        .from('implementation_prompts')
        .select('*')
        .eq('job_id', jobId)
        .order('phase_number', { ascending: true }),
      this.supabase
        .from('export_records')
        .select('*')
        .eq('job_id', jobId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('job_events')
        .select('*')
        .eq('job_id', jobId)
        .order('created_at', { ascending: true }),
    ]);

    return {
      ...job,
      pageEvidence: evidenceRes.error ? [] : evidenceRes.data ?? [],
      blueprintArtifacts: blueprintsRes.error ? [] : blueprintsRes.data ?? [],
      auditLogs: auditLogsRes.error ? [] : auditLogsRes.data ?? [],
      discoveredPages:
        discoveredRes.error && isMissingRelationError(discoveredRes.error)
          ? []
          : discoveredRes.data ?? [],
      analysisResult:
        resultsRes.error && isMissingRelationError(resultsRes.error)
          ? null
          : resultsRes.data ?? null,
      implementationPrompts:
        promptsRes.error && isMissingRelationError(promptsRes.error)
          ? []
          : promptsRes.data ?? [],
      exportRecords:
        exportsRes.error && isMissingRelationError(exportsRes.error)
          ? []
          : exportsRes.data ?? [],
      jobEvents:
        eventsRes.error && isMissingRelationError(eventsRes.error)
          ? []
          : eventsRes.data ?? [],
    };
  }

  async transitionJobStatus(
    jobId: string,
    userId: string,
    toStatus: DurableJobStatus,
    options: JobStatusTransitionOptions = {}
  ): Promise<AnalysisJobRow> {
    const existing = await this.verifyJobOwnership(jobId, userId);

    if (existing.status === toStatus) {
      return existing;
    }

    assertValidJobTransition(existing.status, toStatus);

    const nowIso = new Date().toISOString();
    const isTerminal = TERMINAL_JOB_STATUSES.has(toStatus);
    const isActive = ACTIVE_RUNNING_STATUSES.has(toStatus);

    const patch: Database['public']['Tables']['analysis_jobs']['Update'] = {
      status: toStatus,
    };
    if (options.progressPercent !== undefined) {
      patch.progress_percent = options.progressPercent;
    }
    if (options.workerId !== undefined) {
      patch.worker_id = isTerminal ? null : options.workerId;
    } else if (isTerminal) {
      patch.worker_id = null;
    }
    if (isTerminal) {
      patch.lease_expires_at = null;
      patch.completed_at = existing.completed_at ?? nowIso;
    }
    if (isActive && !existing.started_at) {
      patch.started_at = nowIso;
    }
    if (options.errorCode !== undefined) {
      patch.error_code = options.errorCode;
    }
    if (options.errorMessage !== undefined) {
      patch.error_message = options.errorMessage;
    }
    if (options.durationMs !== undefined) {
      patch.duration_ms = options.durationMs;
    }

    const { data, error } = await this.supabase
      .from('analysis_jobs')
      .update(patch)
      .eq('id', jobId)
      .eq('user_id', userId)
      .eq('status', existing.status)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to transition job status: ${error.message}`);
    }
    if (!data) {
      throw new ConflictError('Job status changed concurrently; retry transition');
    }

    const eventType =
      toStatus === 'FAILED'
        ? 'JOB_FAILED'
        : toStatus === 'CANCELLED'
        ? 'JOB_CANCELLED'
        : 'STATUS_TRANSITION';

    await this.recordJobEventSafe({
      job_id: jobId,
      event_type: eventType,
      from_status: existing.status,
      to_status: toStatus,
      worker_id: options.workerId ?? existing.worker_id,
      attempt_number: existing.attempt_count,
      idempotency_key: options.eventIdempotencyKey ?? null,
      message: options.message ?? `Transitioned job ${existing.status} -> ${toStatus}`,
      metadata: options.metadata ? toJsonValue(options.metadata) : null,
    });

    await this.recordAuditLogSafe({
      job_id: jobId,
      stage: toStatus,
      level: toStatus === 'FAILED' ? 'ERROR' : 'INFO',
      message: options.message ?? `Transitioned ${existing.status} -> ${toStatus}`,
    });

    return data;
  }

  async cancelJob(
    jobId: string,
    userId: string,
    reason = 'Cancelled by owner'
  ): Promise<AnalysisJobRow> {
    const existing = await this.verifyJobOwnership(jobId, userId);

    if (existing.status === 'CANCELLED') {
      return existing;
    }

    assertValidJobTransition(existing.status, 'CANCELLED');

    const nowIso = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('analysis_jobs')
      .update({
        status: 'CANCELLED',
        cancelled_at: nowIso,
        cancellation_reason: reason,
        completed_at: nowIso,
        worker_id: null,
        lease_expires_at: null,
      })
      .eq('id', jobId)
      .eq('user_id', userId)
      .eq('status', existing.status)
      .select('*')
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to cancel analysis job: ${error.message}`);
    }
    if (!data) {
      throw new ConflictError('Job status changed concurrently during cancellation');
    }

    await this.recordJobEventSafe({
      job_id: jobId,
      event_type: 'JOB_CANCELLED',
      from_status: existing.status,
      to_status: 'CANCELLED',
      worker_id: existing.worker_id,
      attempt_number: existing.attempt_count,
      message: reason,
    });

    await this.recordAuditLogSafe({
      job_id: jobId,
      stage: 'CANCELLED',
      level: 'WARN',
      message: reason,
    });

    return data;
  }

  async claimNextQueuedJob(
    workerId: string,
    leaseDurationMs = 180_000
  ): Promise<AnalysisJobRow | null> {
    const { data: candidates, error } = await this.supabase
      .from('analysis_jobs')
      .select('*')
      .eq('status', 'QUEUED')
      .order('created_at', { ascending: true })
      .limit(5);

    if (error || !candidates || candidates.length === 0) {
      return null;
    }

    for (const candidate of candidates) {
      if (candidate.attempt_count >= candidate.max_attempts) {
        continue;
      }

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const leaseIso = new Date(now + leaseDurationMs).toISOString();

      const { data: claimed, error: claimErr } = await this.supabase
        .from('analysis_jobs')
        .update({
          status: 'INSPECTING',
          worker_id: workerId,
          heartbeat_at: nowIso,
          lease_expires_at: leaseIso,
          attempt_count: candidate.attempt_count + 1,
          started_at: candidate.started_at ?? nowIso,
        })
        .eq('id', candidate.id)
        .eq('status', 'QUEUED')
        .select('*')
        .maybeSingle();

      if (!claimErr && claimed) {
        await this.recordJobEventSafe({
          job_id: claimed.id,
          event_type: 'WORKER_CLAIMED',
          from_status: 'QUEUED',
          to_status: 'INSPECTING',
          worker_id: workerId,
          attempt_number: claimed.attempt_count,
          message: `Worker ${workerId} claimed job (attempt ${claimed.attempt_count}/${claimed.max_attempts})`,
        });
        return claimed;
      }
    }

    return null;
  }

  async recoverStaleJobs(
    now = new Date()
  ): Promise<{ requeued: number; failed: number }> {
    const nowIso = now.toISOString();
    const { data: staleJobs, error } = await this.supabase
      .from('analysis_jobs')
      .select('*')
      .in('status', Array.from(ACTIVE_RUNNING_STATUSES))
      .lt('lease_expires_at', nowIso);

    if (error || !staleJobs) {
      return { requeued: 0, failed: 0 };
    }

    let requeued = 0;
    let failed = 0;

    for (const job of staleJobs) {
      if (job.attempt_count < job.max_attempts) {
        const { data: updated } = await this.supabase
          .from('analysis_jobs')
          .update({
            status: 'QUEUED',
            worker_id: null,
            lease_expires_at: null,
          })
          .eq('id', job.id)
          .eq('status', job.status)
          .select('*')
          .maybeSingle();

        if (updated) {
          requeued += 1;
          await this.recordJobEventSafe({
            job_id: job.id,
            event_type: 'STALE_RECOVERED',
            from_status: job.status,
            to_status: 'QUEUED',
            worker_id: job.worker_id,
            attempt_number: job.attempt_count,
            message: `Recovered stale job after lease expiry (attempt ${job.attempt_count}/${job.max_attempts})`,
          });
        }
      } else {
        const { data: updated } = await this.supabase
          .from('analysis_jobs')
          .update({
            status: 'FAILED',
            worker_id: null,
            lease_expires_at: null,
            completed_at: nowIso,
            error_code: 'WORKER_CRASH_MAX_RETRIES',
            error_message:
              'Analysis halted after exhausting worker retry budget.',
          })
          .eq('id', job.id)
          .eq('status', job.status)
          .select('*')
          .maybeSingle();

        if (updated) {
          failed += 1;
          await this.recordJobEventSafe({
            job_id: job.id,
            event_type: 'JOB_FAILED',
            from_status: job.status,
            to_status: 'FAILED',
            worker_id: job.worker_id,
            attempt_number: job.attempt_count,
            message: 'Marked job FAILED after exhausting maximum recovery attempts',
          });
        }
      }
    }

    return { requeued, failed };
  }

  async upsertDiscoveredPage(
    jobId: string,
    userId: string,
    input: UpsertDiscoveredPageInput
  ) {
    await this.verifyJobOwnership(jobId, userId);

    const normalizedUrl = normalizePageUrl(input.url);
    const { data, error } = await this.supabase
      .from('discovered_pages')
      .upsert(
        {
          job_id: jobId,
          url: input.url,
          normalized_url: normalizedUrl,
          depth: input.depth ?? 0,
          is_entry_page: input.isEntryPage ?? false,
          status: input.status ?? 'DISCOVERED',
          http_status: input.httpStatus ?? null,
          error_code: input.errorCode ?? null,
        },
        { onConflict: 'job_id,normalized_url' }
      )
      .select('*')
      .single();

    return assertSupabaseData(data, error, 'Failed to upsert discovered page');
  }

  async recordPageEvidenceAndScreenshots(
    jobId: string,
    userId: string,
    input: RecordPageEvidenceInput
  ) {
    if (input.domSnapshotStorageKey) {
      assertSafeObjectStorageKey(
        input.domSnapshotStorageKey,
        'domSnapshotStorageKey'
      );
    }
    for (const s of input.screenshots ?? []) {
      assertSafeObjectStorageKey(s.storageKey, 'screenshot.storageKey');
    }

    const ownerJob = await this.verifyJobOwnership(jobId, userId);

    let discoveredPageId = input.discoveredPageId ?? null;
    if (!discoveredPageId) {
      const normalizedUrl = normalizePageUrl(input.pageUrl);
      const { data: page, error: pageErr } = await this.supabase
        .from('discovered_pages')
        .upsert(
          {
            job_id: jobId,
            url: input.pageUrl,
            normalized_url: normalizedUrl,
            status: 'COMPLETED',
            inspected_at: new Date().toISOString(),
          },
          { onConflict: 'job_id,normalized_url' }
        )
        .select('id')
        .maybeSingle();

      if (!pageErr && page) {
        discoveredPageId = page.id;
      } else if (pageErr && !isMissingRelationError(pageErr)) {
        throw new Error(`Failed to upsert discovered page: ${pageErr.message}`);
      }
    }

    const { data: evidenceRow, error: evErr } = await this.supabase
      .from('page_evidence')
      .upsert(
        {
          job_id: jobId,
          discovered_page_id: discoveredPageId,
          page_url: input.pageUrl,
          page_title: input.pageTitle,
          meta_tags: toJsonValue(input.metaTags),
          dom_structure: toJsonValue(input.domStructure),
          computed_typography: toJsonValue(input.computedTypography),
          computed_colors: toJsonValue(input.computedColors),
          computed_spacing: toJsonValue(input.computedSpacing),
          detected_components: toJsonValue(input.detectedComponents),
          dom_node_count: input.domNodeCount,
          dom_snapshot_storage_key: input.domSnapshotStorageKey ?? null,
        },
        { onConflict: 'job_id,page_url' }
      )
      .select('*')
      .single();

    const evidence = assertSupabaseData(
      evidenceRow,
      evErr,
      'Failed to persist page evidence'
    );

    const savedShots: Database['public']['Tables']['visual_screenshots']['Row'][] = [];
    for (const shot of input.screenshots ?? []) {
      const { data: shotRow, error: shotErr } = await this.supabase
        .from('visual_screenshots')
        .upsert(
          {
            evidence_id: evidence.id,
            viewport_type: shot.viewportType,
            width: shot.width,
            height: shot.height,
            storage_bucket: shot.storageBucket ?? 'rebuildiq-artifacts',
            storage_key: shot.storageKey,
            file_hash: shot.fileHash,
            file_size_bytes: shot.fileSizeBytes,
            mime_type: shot.mimeType ?? 'image/png',
          },
          { onConflict: 'evidence_id,viewport_type' }
        )
        .select('*')
        .single();

      savedShots.push(
        assertSupabaseData(shotRow, shotErr, 'Failed to persist visual screenshot')
      );
    }

    await this.recordJobEventSafe({
      job_id: jobId,
      event_type: 'EVIDENCE_CAPTURED',
      attempt_number: ownerJob.attempt_count,
      idempotency_key: input.eventIdempotencyKey ?? null,
      message: `Captured DOM & style evidence for ${input.pageUrl}`,
    });

    return {
      ...evidence,
      screenshots: savedShots,
    };
  }

  async saveAnalysisResultsAndBlueprint(
    jobId: string,
    userId: string,
    input: SaveAnalysisAndBlueprintInput
  ) {
    if (input.rawArtifactStorageKey) {
      assertSafeObjectStorageKey(
        input.rawArtifactStorageKey,
        'rawArtifactStorageKey'
      );
    }
    if (input.blueprintStorageKey) {
      assertSafeObjectStorageKey(
        input.blueprintStorageKey,
        'blueprintStorageKey'
      );
    }
    if (
      input.confidenceScore !== undefined &&
      input.confidenceScore !== null &&
      (input.confidenceScore < 0 || input.confidenceScore > 1)
    ) {
      throw new ValidationError('confidenceScore must be between 0 and 1');
    }

    const ownerJob = await this.verifyJobOwnership(jobId, userId);

    const { data: analysisResultRow, error: arErr } = await this.supabase
      .from('analysis_results')
      .upsert(
        {
          job_id: jobId,
          provider: input.provider,
          model_name: input.modelName,
          architecture_summary: input.architectureSummary,
          detected_patterns: toJsonValue(input.detectedPatterns),
          design_token_summary: toJsonValue(input.designTokenSummary),
          evidence_coverage: toJsonValue(input.evidenceCoverage),
          confidence_score: input.confidenceScore ?? null,
          raw_artifact_storage_key: input.rawArtifactStorageKey ?? null,
        },
        { onConflict: 'job_id' }
      )
      .select('*')
      .single();

    const analysisResult = assertSupabaseData(
      analysisResultRow,
      arErr,
      'Failed to save analysis results'
    );

    const version = input.blueprintVersion ?? '1.0.0';
    const combinedPrompts = input.prompts
      .map((p) => `# Phase ${p.phaseNumber}: ${p.title}\n\n${p.promptMarkdown}`)
      .join('\n---\n');

    const { data: blueprintRow, error: bpErr } = await this.supabase
      .from('blueprint_artifacts')
      .upsert(
        {
          job_id: jobId,
          analysis_result_id: analysisResult.id,
          version,
          design_system_spec: toJsonValue(input.designSystemSpec),
          component_architecture: toJsonValue(input.componentArchitecture),
          state_interactions: toJsonValue(input.stateInteractions),
          recommended_stack: toJsonValue(input.recommendedStack),
          antigravity_prompts: combinedPrompts,
          blueprint_storage_key: input.blueprintStorageKey ?? null,
        },
        { onConflict: 'job_id,version' }
      )
      .select('*')
      .single();

    const blueprint = assertSupabaseData(
      blueprintRow,
      bpErr,
      'Failed to save blueprint artifact'
    );

    const prompts: Database['public']['Tables']['implementation_prompts']['Row'][] = [];
    for (const p of input.prompts) {
      const targetTool = p.targetTool ?? 'antigravity';
      const promptHash = sha256Hex(p.promptMarkdown);

      const { data: promptRow, error: pErr } = await this.supabase
        .from('implementation_prompts')
        .upsert(
          {
            job_id: jobId,
            blueprint_id: blueprint.id,
            phase_number: p.phaseNumber,
            target_tool: targetTool,
            title: p.title,
            objective: p.objective,
            prompt_markdown: p.promptMarkdown,
            prompt_hash: promptHash,
            is_edited_by_user: p.isEditedByUser ?? false,
          },
          { onConflict: 'blueprint_id,target_tool,phase_number' }
        )
        .select('*')
        .single();

      prompts.push(
        assertSupabaseData(
          promptRow,
          pErr,
          'Failed to save implementation prompt'
        )
      );
    }

    await this.recordJobEventSafe({
      job_id: jobId,
      event_type: 'BLUEPRINT_GENERATED',
      attempt_number: ownerJob.attempt_count,
      message: `Generated blueprint v${version} with ${prompts.length} prompts`,
    });

    if (input.markCompleted) {
      await this.transitionJobStatus(jobId, userId, 'COMPLETED', {
        progressPercent: 100,
        message: 'Analysis, blueprint, and implementation prompts persisted',
      });
    }

    return {
      analysisResult,
      blueprint: {
        ...blueprint,
        prompts,
      },
    };
  }

  async recordExport(
    jobId: string,
    userId: string,
    input: RecordExportInput
  ) {
    if (input.storageKey) {
      assertSafeObjectStorageKey(input.storageKey, 'export.storageKey');
    }

    const ownerJob = await this.verifyJobOwnership(jobId, userId);

    const expiresInDays = input.expiresInDays ?? 7;
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await this.supabase
      .from('export_records')
      .insert({
        job_id: jobId,
        user_id: userId,
        format: input.format,
        storage_key: input.storageKey ?? null,
        file_hash: input.fileHash ?? null,
        file_size_bytes: input.fileSizeBytes ?? null,
        status: input.status ?? 'READY',
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    const exportRecord = assertSupabaseData(
      data,
      error,
      'Failed to record export artifact'
    );

    await this.recordJobEventSafe({
      job_id: jobId,
      event_type: 'EXPORT_CREATED',
      attempt_number: ownerJob.attempt_count,
      message: `Generated ${input.format} export record`,
      metadata: toJsonValue({ exportId: exportRecord.id, format: input.format }),
    });

    return exportRecord;
  }

  async markExportDownloaded(exportId: string, userId: string) {
    const { data: existing, error: findErr } = await this.supabase
      .from('export_records')
      .select('*')
      .eq('id', exportId)
      .eq('user_id', userId)
      .maybeSingle();

    if (findErr || !existing) {
      throw new NotFoundError('Export record not found');
    }

    const { data, error } = await this.supabase
      .from('export_records')
      .update({ downloaded_at: new Date().toISOString() })
      .eq('id', exportId)
      .eq('user_id', userId)
      .select('*')
      .single();

    return assertSupabaseData(data, error, 'Failed to update export download time');
  }

  async deleteJobForUser(
    jobId: string,
    userId: string
  ): Promise<DeletedJobStorageCleanup> {
    const bundle = await this.requireOwnedJobBundle(jobId, userId);

    const keys = new Set<string>();
    for (const ev of bundle.pageEvidence as Array<{
      dom_snapshot_storage_key?: string | null;
      visual_screenshots?: Array<{ storage_key: string }>;
    }>) {
      if (ev.dom_snapshot_storage_key) keys.add(ev.dom_snapshot_storage_key);
      for (const shot of ev.visual_screenshots ?? []) {
        if (shot.storage_key) keys.add(shot.storage_key);
      }
    }
    if (bundle.analysisResult?.raw_artifact_storage_key) {
      keys.add(bundle.analysisResult.raw_artifact_storage_key);
    }
    for (const bp of bundle.blueprintArtifacts) {
      if (bp.blueprint_storage_key) keys.add(bp.blueprint_storage_key);
    }
    for (const exp of bundle.exportRecords) {
      if (exp.storage_key) keys.add(exp.storage_key);
    }

    const { error } = await this.supabase
      .from('analysis_jobs')
      .delete()
      .eq('id', jobId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to delete analysis job: ${error.message}`);
    }

    return {
      deletedJobId: jobId,
      storageKeysToRemove: Array.from(keys),
    };
  }

  async purgeExpiredRetentionData(
    now = new Date()
  ): Promise<RetentionPurgeSummary> {
    const nowIso = now.toISOString();
    const keys = new Set<string>();

    const { data: expiredExports } = await this.supabase
      .from('export_records')
      .select('id, storage_key')
      .lte('expires_at', nowIso);

    for (const exp of expiredExports ?? []) {
      if (exp.storage_key) keys.add(exp.storage_key);
    }

    const expiredExportIds = (expiredExports ?? []).map((e) => e.id);
    if (expiredExportIds.length > 0) {
      await this.supabase
        .from('export_records')
        .delete()
        .in('id', expiredExportIds);
    }

    const { data: expiredJobs } = await this.supabase
      .from('analysis_jobs')
      .select(
        `
        id,
        page_evidence(dom_snapshot_storage_key, visual_screenshots(storage_key)),
        analysis_results(raw_artifact_storage_key),
        blueprint_artifacts(blueprint_storage_key),
        export_records(storage_key)
      `
      )
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso);

    const expiredJobIds: string[] = [];
    for (const job of expiredJobs ?? []) {
      expiredJobIds.push(job.id);

      const evList = Array.isArray(job.page_evidence) ? job.page_evidence : [];
      for (const ev of evList) {
        if (ev.dom_snapshot_storage_key) keys.add(ev.dom_snapshot_storage_key);
        const shots = Array.isArray(ev.visual_screenshots)
          ? ev.visual_screenshots
          : [];
        for (const s of shots) {
          if (s.storage_key) keys.add(s.storage_key);
        }
      }

      const ar = Array.isArray(job.analysis_results)
        ? job.analysis_results[0]
        : job.analysis_results;
      if (ar?.raw_artifact_storage_key) {
        keys.add(ar.raw_artifact_storage_key);
      }

      const bpList = Array.isArray(job.blueprint_artifacts)
        ? job.blueprint_artifacts
        : [];
      for (const bp of bpList) {
        if (bp.blueprint_storage_key) keys.add(bp.blueprint_storage_key);
      }

      const expList = Array.isArray(job.export_records)
        ? job.export_records
        : [];
      for (const exp of expList) {
        if (exp.storage_key) keys.add(exp.storage_key);
      }
    }

    if (expiredJobIds.length > 0) {
      await this.supabase
        .from('analysis_jobs')
        .delete()
        .in('id', expiredJobIds);
    }

    return {
      expiredExportsDeleted: expiredExportIds.length,
      expiredJobsDeleted: expiredJobIds.length,
      storageKeysToRemove: Array.from(keys),
    };
  }
}
