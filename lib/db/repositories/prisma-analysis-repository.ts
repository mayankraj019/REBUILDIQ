import { Prisma, type PrismaClient } from '@prisma/client';
import prismaSingleton from '@/lib/db/prisma';
import { NotFoundError } from '@/lib/auth/middleware';
import { ValidationError } from '@/lib/errors';
import {
  ACTIVE_RUNNING_STATUSES,
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

function collectJobStorageKeys(job: {
  pageEvidence?: Array<{
    domSnapshotStorageKey?: string | null;
    screenshots?: Array<{ storageKey: string }>;
  }>;
  analysisResult?: { rawArtifactStorageKey?: string | null } | null;
  blueprintArtifacts?: Array<{ blueprintStorageKey?: string | null }>;
  exportRecords?: Array<{ storageKey?: string | null }>;
}): string[] {
  const keys = new Set<string>();

  for (const ev of job.pageEvidence ?? []) {
    if (ev.domSnapshotStorageKey) keys.add(ev.domSnapshotStorageKey);
    for (const s of ev.screenshots ?? []) {
      if (s.storageKey) keys.add(s.storageKey);
    }
  }
  if (job.analysisResult?.rawArtifactStorageKey) {
    keys.add(job.analysisResult.rawArtifactStorageKey);
  }
  for (const bp of job.blueprintArtifacts ?? []) {
    if (bp.blueprintStorageKey) keys.add(bp.blueprintStorageKey);
  }
  for (const exp of job.exportRecords ?? []) {
    if (exp.storageKey) keys.add(exp.storageKey);
  }

  return Array.from(keys);
}

/**
 * Transactional Prisma Data-Access Repository implementing RebuildIQ's full domain model.
 * Suitable for local SQLite development, disposable DB validation suites, and standalone PostgreSQL.
 */
export class PrismaAnalysisRepository implements JobLifecycleRepository {
  constructor(private readonly db: PrismaClient = prismaSingleton) {}

  async createJob(
    input: CreateAnalysisJobInput
  ): Promise<{ job: any; deduplicated: boolean }> {
    const normalizedDomain = normalizeDomainFromUrl(input.targetUrl);
    const normalizedEntryUrl = normalizePageUrl(input.targetUrl);
    const initialStatus = input.initialStatus ?? 'QUEUED';
    const crawlDepth = input.crawlDepth ?? 1;
    const viewports = input.viewports ?? ['desktop', 'tablet', 'mobile'];
    const retentionDays = input.retentionDays ?? 90;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

    if (input.idempotencyKey) {
      const existing = await this.db.analysisJob.findUnique({
        where: {
          userId_idempotencyKey: {
            userId: input.userId,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: {
          discoveredPages: true,
          jobEvents: { orderBy: { createdAt: 'asc' } },
        },
      });
      if (existing) {
        return { job: existing, deduplicated: true };
      }
    }

    try {
      const created = await this.db.$transaction(async (tx) => {
        const job = await tx.analysisJob.create({
          data: {
            userId: input.userId,
            targetUrl: input.targetUrl,
            normalizedDomain,
            status: initialStatus,
            crawlDepth,
            viewportsConfig: JSON.stringify(viewports),
            idempotencyKey: input.idempotencyKey ?? null,
            maxAttempts: input.maxAttempts ?? 3,
            expiresAt,
          },
        });

        await tx.discoveredPage.create({
          data: {
            jobId: job.id,
            url: input.targetUrl,
            normalizedUrl: normalizedEntryUrl,
            depth: 0,
            isEntryPage: true,
            status: 'QUEUED',
          },
        });

        await tx.jobEvent.create({
          data: {
            jobId: job.id,
            eventType: 'JOB_CREATED',
            toStatus: initialStatus,
            message: `Created analysis job for ${normalizedDomain}`,
            idempotencyKey: `job_created:${job.id}`,
            metadata: JSON.stringify({
              crawlDepth,
              viewports,
            }),
          },
        });

        return tx.analysisJob.findUniqueOrThrow({
          where: { id: job.id },
          include: {
            discoveredPages: true,
            jobEvents: { orderBy: { createdAt: 'asc' } },
          },
        });
      });

      return { job: created, deduplicated: false };
    } catch (error) {
      if (
        input.idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const winner = await this.db.analysisJob.findUnique({
          where: {
            userId_idempotencyKey: {
              userId: input.userId,
              idempotencyKey: input.idempotencyKey,
            },
          },
          include: {
            discoveredPages: true,
            jobEvents: { orderBy: { createdAt: 'asc' } },
          },
        });
        if (winner) {
          return { job: winner, deduplicated: true };
        }
      }
      throw error;
    }
  }

  async listJobsForUser(userId: string) {
    if (!userId) return [];
    return this.db.analysisJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        discoveredPages: true,
        analysisResult: true,
        blueprintArtifacts: { select: { id: true, version: true } },
      },
    });
  }

  async requireOwnedJobBundle(jobId: string, userId: string) {
    if (!jobId || !userId) {
      throw new NotFoundError('Analysis job not found');
    }

    const job = await this.db.analysisJob.findFirst({
      where: { id: jobId, userId },
      include: {
        discoveredPages: { orderBy: { depth: 'asc' } },
        pageEvidence: {
          include: { screenshots: true },
          orderBy: { extractedAt: 'asc' },
        },
        analysisResult: true,
        blueprintArtifacts: {
          include: {
            prompts: { orderBy: { phaseNumber: 'asc' } },
          },
          orderBy: { generatedAt: 'desc' },
        },
        exportRecords: { orderBy: { createdAt: 'desc' } },
        jobEvents: { orderBy: { createdAt: 'asc' } },
        jobAuditLogs: { orderBy: { timestamp: 'asc' } },
      },
    });

    if (!job) {
      throw new NotFoundError('Analysis job not found');
    }

    return job;
  }

  async transitionJobStatus(
    jobId: string,
    userId: string,
    toStatus: DurableJobStatus,
    options: JobStatusTransitionOptions = {}
  ) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.analysisJob.findFirst({
        where: { id: jobId, userId },
      });
      if (!existing) {
        throw new NotFoundError('Analysis job not found');
      }

      assertValidJobTransition(existing.status, toStatus);

      const isTerminal =
        toStatus === 'COMPLETED' || toStatus === 'FAILED' || toStatus === 'CANCELLED';

      const updated = await tx.analysisJob.update({
        where: { id: existing.id },
        data: {
          status: toStatus,
          progressPercent:
            options.progressPercent ??
            (toStatus === 'COMPLETED' ? 100 : existing.progressPercent),
          errorCode: options.errorCode !== undefined ? options.errorCode : existing.errorCode,
          errorMessage:
            options.errorMessage !== undefined ? options.errorMessage : existing.errorMessage,
          durationMs: options.durationMs !== undefined ? options.durationMs : existing.durationMs,
          completedAt: isTerminal ? existing.completedAt ?? new Date() : existing.completedAt,
          cancelledAt:
            toStatus === 'CANCELLED' ? existing.cancelledAt ?? new Date() : existing.cancelledAt,
          workerId: isTerminal ? null : options.workerId ?? existing.workerId,
          leaseExpiresAt: isTerminal ? null : existing.leaseExpiresAt,
        },
      });

      const eventType =
        toStatus === 'CANCELLED'
          ? 'JOB_CANCELLED'
          : toStatus === 'FAILED'
          ? 'JOB_FAILED'
          : 'STATUS_TRANSITION';

      const eventPayload = {
        jobId: existing.id,
        eventType,
        fromStatus: existing.status,
        toStatus,
        workerId: options.workerId ?? existing.workerId,
        attemptNumber: existing.attemptCount,
        message: options.message || `Transitioned ${existing.status} -> ${toStatus}`,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        idempotencyKey: options.eventIdempotencyKey ?? null,
      };

      if (options.eventIdempotencyKey) {
        await tx.jobEvent.upsert({
          where: {
            jobId_idempotencyKey: {
              jobId: existing.id,
              idempotencyKey: options.eventIdempotencyKey,
            },
          },
          create: eventPayload,
          update: {},
        });
      } else {
        await tx.jobEvent.create({ data: eventPayload });
      }

      return updated;
    });
  }

  async cancelJob(jobId: string, userId: string, reason = 'Cancelled by owner') {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.analysisJob.findFirst({
        where: { id: jobId, userId },
      });
      if (!existing) {
        throw new NotFoundError('Analysis job not found');
      }

      assertValidJobTransition(existing.status, 'CANCELLED');

      const now = new Date();
      const updated = await tx.analysisJob.update({
        where: { id: existing.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancellationReason: reason,
          completedAt: now,
          workerId: null,
          leaseExpiresAt: null,
        },
      });

      await tx.jobEvent.create({
        data: {
          jobId: existing.id,
          eventType: 'JOB_CANCELLED',
          fromStatus: existing.status,
          toStatus: 'CANCELLED',
          attemptNumber: existing.attemptCount,
          message: reason,
        },
      });

      return updated;
    });
  }

  /**
   * Atomically claims the oldest QUEUED job whose attempt budget remains and whose owner is active.
   * Uses optimistic compare-and-swap inside a transaction so concurrent workers never claim twice.
   */
  async claimNextQueuedJob(workerId: string, leaseDurationMs = 180_000) {
    return this.db.$transaction(async (tx) => {
      const candidates = await tx.analysisJob.findMany({
        where: {
          status: 'QUEUED',
          user: { deletedAt: null },
        },
        orderBy: { createdAt: 'asc' },
        take: 10,
      });

      for (const candidate of candidates) {
        if (candidate.attemptCount >= candidate.maxAttempts) {
          continue;
        }

        const now = new Date();
        const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

        const claimRes = await tx.analysisJob.updateMany({
          where: {
            id: candidate.id,
            status: 'QUEUED',
            attemptCount: candidate.attemptCount,
          },
          data: {
            status: 'INSPECTING',
            workerId,
            leaseExpiresAt,
            heartbeatAt: now,
            startedAt: candidate.startedAt ?? now,
            attemptCount: candidate.attemptCount + 1,
          },
        });

        if (claimRes.count === 1) {
          const claimed = await tx.analysisJob.findUniqueOrThrow({
            where: { id: candidate.id },
          });

          await tx.jobEvent.create({
            data: {
              jobId: claimed.id,
              eventType: 'WORKER_CLAIMED',
              fromStatus: 'QUEUED',
              toStatus: 'INSPECTING',
              workerId,
              attemptNumber: claimed.attemptCount,
              message: `Worker ${workerId} claimed job (attempt ${claimed.attemptCount}/${claimed.maxAttempts})`,
            },
          });

          return claimed;
        }
      }

      return null;
    });
  }

  async heartbeatJob(jobId: string, workerId: string, extendLeaseMs = 180_000) {
    const now = new Date();
    const res = await this.db.analysisJob.updateMany({
      where: {
        id: jobId,
        workerId,
        status: { in: Array.from(ACTIVE_RUNNING_STATUSES) },
      },
      data: {
        heartbeatAt: now,
        leaseExpiresAt: new Date(now.getTime() + extendLeaseMs),
      },
    });
    return res.count > 0;
  }

  /**
   * Reclaims interrupted jobs whose worker lease expired cleanly without leaving zombie locks.
   */
  async recoverStaleJobs(now = new Date()): Promise<{ requeued: number; failed: number }> {
    return this.db.$transaction(async (tx) => {
      const staleJobs = await tx.analysisJob.findMany({
        where: {
          status: { in: Array.from(ACTIVE_RUNNING_STATUSES) },
          leaseExpiresAt: { lt: now },
        },
      });

      let requeued = 0;
      let failed = 0;

      for (const job of staleJobs) {
        if (job.attemptCount < job.maxAttempts) {
          await tx.analysisJob.update({
            where: { id: job.id },
            data: {
              status: 'QUEUED',
              workerId: null,
              leaseExpiresAt: null,
            },
          });

          await tx.jobEvent.create({
            data: {
              jobId: job.id,
              eventType: 'STALE_RECOVERED',
              fromStatus: job.status,
              toStatus: 'QUEUED',
              workerId: job.workerId,
              attemptNumber: job.attemptCount,
              message: `Recovered stale job back to QUEUED after lease expiration (${job.attemptCount}/${job.maxAttempts})`,
            },
          });

          requeued += 1;
        } else {
          await tx.analysisJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              errorCode: 'WORKER_CRASH_MAX_RETRIES',
              errorMessage: 'Job failed after exhausting worker recovery retries.',
              completedAt: now,
              workerId: null,
              leaseExpiresAt: null,
            },
          });

          await tx.jobEvent.create({
            data: {
              jobId: job.id,
              eventType: 'JOB_FAILED',
              fromStatus: job.status,
              toStatus: 'FAILED',
              workerId: job.workerId,
              attemptNumber: job.attemptCount,
              message: 'Marked FAILED after exhausting worker crash recovery retries',
            },
          });

          failed += 1;
        }
      }

      return { requeued, failed };
    });
  }

  async upsertDiscoveredPage(
    jobId: string,
    userId: string,
    input: UpsertDiscoveredPageInput
  ) {
    const ownerJob = await this.db.analysisJob.findFirst({
      where: { id: jobId, userId },
      select: { id: true },
    });
    if (!ownerJob) {
      throw new NotFoundError('Analysis job not found');
    }

    const normalizedUrl = normalizePageUrl(input.url);
    return this.db.discoveredPage.upsert({
      where: {
        jobId_normalizedUrl: {
          jobId,
          normalizedUrl,
        },
      },
      create: {
        jobId,
        url: input.url,
        normalizedUrl,
        depth: input.depth ?? 0,
        isEntryPage: input.isEntryPage ?? false,
        status: input.status ?? 'DISCOVERED',
        httpStatus: input.httpStatus ?? null,
        errorCode: input.errorCode ?? null,
      },
      update: {
        status: input.status ?? undefined,
        httpStatus: input.httpStatus ?? undefined,
        errorCode: input.errorCode ?? undefined,
        inspectedAt: input.status === 'COMPLETED' ? new Date() : undefined,
      },
    });
  }

  async recordPageEvidenceAndScreenshots(
    jobId: string,
    userId: string,
    input: RecordPageEvidenceInput
  ) {
    if (input.domSnapshotStorageKey) {
      assertSafeObjectStorageKey(input.domSnapshotStorageKey, 'domSnapshotStorageKey');
    }
    for (const s of input.screenshots ?? []) {
      assertSafeObjectStorageKey(s.storageKey, 'screenshot.storageKey');
    }

    return this.db.$transaction(async (tx) => {
      const ownerJob = await tx.analysisJob.findFirst({
        where: { id: jobId, userId },
        select: { id: true, attemptCount: true },
      });
      if (!ownerJob) {
        throw new NotFoundError('Analysis job not found');
      }

      const normalizedUrl = normalizePageUrl(input.pageUrl);
      const discovered =
        input.discoveredPageId ??
        (
          await tx.discoveredPage.upsert({
            where: {
              jobId_normalizedUrl: { jobId, normalizedUrl },
            },
            create: {
              jobId,
              url: input.pageUrl,
              normalizedUrl,
              status: 'COMPLETED',
              inspectedAt: new Date(),
            },
            update: {
              status: 'COMPLETED',
              inspectedAt: new Date(),
            },
          })
        ).id;

      const evidence = await tx.pageEvidence.upsert({
        where: {
          jobId_pageUrl: {
            jobId,
            pageUrl: input.pageUrl,
          },
        },
        create: {
          jobId,
          discoveredPageId: discovered,
          pageUrl: input.pageUrl,
          pageTitle: input.pageTitle,
          metaTags: JSON.stringify(input.metaTags),
          domStructure: JSON.stringify(input.domStructure),
          computedTypography: JSON.stringify(input.computedTypography),
          computedColors: JSON.stringify(input.computedColors),
          computedSpacing: JSON.stringify(input.computedSpacing),
          detectedComponents: JSON.stringify(input.detectedComponents),
          domNodeCount: input.domNodeCount,
          domSnapshotStorageKey: input.domSnapshotStorageKey ?? null,
        },
        update: {
          discoveredPageId: discovered,
          pageTitle: input.pageTitle,
          metaTags: JSON.stringify(input.metaTags),
          domStructure: JSON.stringify(input.domStructure),
          computedTypography: JSON.stringify(input.computedTypography),
          computedColors: JSON.stringify(input.computedColors),
          computedSpacing: JSON.stringify(input.computedSpacing),
          detectedComponents: JSON.stringify(input.detectedComponents),
          domNodeCount: input.domNodeCount,
          domSnapshotStorageKey: input.domSnapshotStorageKey ?? null,
        },
      });

      for (const s of input.screenshots ?? []) {
        await tx.visualScreenshot.upsert({
          where: {
            evidenceId_viewportType: {
              evidenceId: evidence.id,
              viewportType: s.viewportType,
            },
          },
          create: {
            evidenceId: evidence.id,
            viewportType: s.viewportType,
            width: s.width,
            height: s.height,
            storageBucket: s.storageBucket ?? 'rebuildiq-artifacts',
            storageKey: s.storageKey,
            fileHash: s.fileHash,
            fileSizeBytes: s.fileSizeBytes,
            mimeType: s.mimeType ?? 'image/png',
          },
          update: {
            width: s.width,
            height: s.height,
            storageBucket: s.storageBucket ?? 'rebuildiq-artifacts',
            storageKey: s.storageKey,
            fileHash: s.fileHash,
            fileSizeBytes: s.fileSizeBytes,
            mimeType: s.mimeType ?? 'image/png',
          },
        });
      }

      if (input.discoveredPageId) {
        await tx.discoveredPage.update({
          where: { id: input.discoveredPageId },
          data: { status: 'COMPLETED', inspectedAt: new Date() },
        });
      }

      const eventKey = input.eventIdempotencyKey ?? `evidence:${normalizedUrl}`;
      await tx.jobEvent.upsert({
        where: {
          jobId_idempotencyKey: {
            jobId,
            idempotencyKey: eventKey,
          },
        },
        create: {
          jobId,
          eventType: 'EVIDENCE_CAPTURED',
          attemptNumber: ownerJob.attemptCount,
          message: `Captured DOM evidence and ${input.screenshots?.length ?? 0} screenshot(s) for ${input.pageUrl}`,
          idempotencyKey: eventKey,
        },
        update: {},
      });

      return tx.pageEvidence.findUniqueOrThrow({
        where: { id: evidence.id },
        include: { screenshots: true },
      });
    });
  }

  async saveAnalysisResultsAndBlueprint(
    jobId: string,
    userId: string,
    input: SaveAnalysisAndBlueprintInput
  ) {
    if (input.rawArtifactStorageKey) {
      assertSafeObjectStorageKey(input.rawArtifactStorageKey, 'rawArtifactStorageKey');
    }
    if (input.blueprintStorageKey) {
      assertSafeObjectStorageKey(input.blueprintStorageKey, 'blueprintStorageKey');
    }
    if (
      input.confidenceScore !== undefined &&
      input.confidenceScore !== null &&
      (input.confidenceScore < 0 || input.confidenceScore > 1)
    ) {
      throw new ValidationError('confidenceScore must be between 0 and 1');
    }

    const version = input.blueprintVersion ?? '1.0.0';

    return this.db.$transaction(async (tx) => {
      const existingJob = await tx.analysisJob.findFirst({
        where: { id: jobId, userId },
      });
      if (!existingJob) {
        throw new NotFoundError('Analysis job not found');
      }

      if (input.markCompleted) {
        assertValidJobTransition(existingJob.status, 'COMPLETED');
      }

      const analysisResult = await tx.analysisResult.upsert({
        where: { jobId },
        create: {
          jobId,
          provider: input.provider,
          modelName: input.modelName,
          architectureSummary: input.architectureSummary,
          detectedPatterns: JSON.stringify(input.detectedPatterns),
          designTokenSummary: JSON.stringify(input.designTokenSummary),
          evidenceCoverage: JSON.stringify(input.evidenceCoverage),
          confidenceScore: input.confidenceScore ?? null,
          rawArtifactStorageKey: input.rawArtifactStorageKey ?? null,
        },
        update: {
          provider: input.provider,
          modelName: input.modelName,
          architectureSummary: input.architectureSummary,
          detectedPatterns: JSON.stringify(input.detectedPatterns),
          designTokenSummary: JSON.stringify(input.designTokenSummary),
          evidenceCoverage: JSON.stringify(input.evidenceCoverage),
          confidenceScore: input.confidenceScore ?? null,
          rawArtifactStorageKey: input.rawArtifactStorageKey ?? null,
        },
      });

      const combinedMarkdown = input.prompts.map((p) => p.promptMarkdown).join('\n\n---\n\n');

      const blueprint = await tx.blueprintArtifact.upsert({
        where: {
          jobId_version: { jobId, version },
        },
        create: {
          jobId,
          analysisResultId: analysisResult.id,
          version,
          designSystemSpec: JSON.stringify(input.designSystemSpec),
          componentArchitecture: JSON.stringify(input.componentArchitecture),
          stateInteractions: JSON.stringify(input.stateInteractions),
          recommendedStack: JSON.stringify(input.recommendedStack),
          antigravityPrompts: combinedMarkdown,
          blueprintStorageKey: input.blueprintStorageKey ?? null,
        },
        update: {
          analysisResultId: analysisResult.id,
          designSystemSpec: JSON.stringify(input.designSystemSpec),
          componentArchitecture: JSON.stringify(input.componentArchitecture),
          stateInteractions: JSON.stringify(input.stateInteractions),
          recommendedStack: JSON.stringify(input.recommendedStack),
          antigravityPrompts: combinedMarkdown,
          blueprintStorageKey: input.blueprintStorageKey ?? null,
        },
      });

      for (const prompt of input.prompts) {
        const targetTool = prompt.targetTool ?? 'antigravity';
        await tx.implementationPrompt.upsert({
          where: {
            blueprintId_targetTool_phaseNumber: {
              blueprintId: blueprint.id,
              targetTool,
              phaseNumber: prompt.phaseNumber,
            },
          },
          create: {
            blueprintId: blueprint.id,
            jobId,
            phaseNumber: prompt.phaseNumber,
            targetTool,
            title: prompt.title,
            objective: prompt.objective,
            promptMarkdown: prompt.promptMarkdown,
            promptHash: sha256Hex(prompt.promptMarkdown),
            isEditedByUser: prompt.isEditedByUser ?? false,
          },
          update: {
            title: prompt.title,
            objective: prompt.objective,
            promptMarkdown: prompt.promptMarkdown,
            promptHash: sha256Hex(prompt.promptMarkdown),
            isEditedByUser: prompt.isEditedByUser ?? undefined,
            version: { increment: 1 },
          },
        });
      }

      if (input.markCompleted) {
        await tx.analysisJob.update({
          where: { id: jobId },
          data: {
            status: 'COMPLETED',
            progressPercent: 100,
            completedAt: new Date(),
            workerId: null,
            leaseExpiresAt: null,
          },
        });
      }

      await tx.jobEvent.upsert({
        where: {
          jobId_idempotencyKey: {
            jobId,
            idempotencyKey: `blueprint:${version}`,
          },
        },
        create: {
          jobId,
          eventType: 'BLUEPRINT_GENERATED',
          fromStatus: existingJob.status,
          toStatus: input.markCompleted ? 'COMPLETED' : existingJob.status,
          attemptNumber: existingJob.attemptCount,
          message: `Persisted analysis result and blueprint v${version} (${input.prompts.length} prompts)`,
          idempotencyKey: `blueprint:${version}`,
        },
        update: {},
      });

      return {
        analysisResult,
        blueprint: await tx.blueprintArtifact.findUniqueOrThrow({
          where: { id: blueprint.id },
          include: { prompts: { orderBy: { phaseNumber: 'asc' } } },
        }),
      };
    });
  }

  async recordExport(jobId: string, userId: string, input: RecordExportInput) {
    if (input.storageKey) {
      assertSafeObjectStorageKey(input.storageKey, 'export.storageKey');
    }

    const expiresInDays = input.expiresInDays ?? 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    return this.db.$transaction(async (tx) => {
      const ownerJob = await tx.analysisJob.findFirst({
        where: { id: jobId, userId },
        select: { id: true, attemptCount: true },
      });
      if (!ownerJob) {
        throw new NotFoundError('Analysis job not found');
      }

      const record = await tx.exportRecord.create({
        data: {
          jobId,
          userId,
          format: input.format,
          storageKey: input.storageKey ?? null,
          fileHash: input.fileHash ?? null,
          fileSizeBytes: input.fileSizeBytes ?? null,
          status: input.status ?? 'READY',
          expiresAt,
        },
      });

      await tx.jobEvent.create({
        data: {
          jobId,
          eventType: 'EXPORT_CREATED',
          attemptNumber: ownerJob.attemptCount,
          message: `Generated ${input.format} export record`,
          metadata: JSON.stringify({ exportId: record.id, format: input.format }),
        },
      });

      return record;
    });
  }

  async markExportDownloaded(exportId: string, userId: string) {
    const existing = await this.db.exportRecord.findFirst({
      where: { id: exportId, userId },
    });
    if (!existing) {
      throw new NotFoundError('Export record not found');
    }

    return this.db.exportRecord.update({
      where: { id: existing.id },
      data: { downloadedAt: new Date() },
    });
  }

  async deleteJobForUser(jobId: string, userId: string): Promise<DeletedJobStorageCleanup> {
    return this.db.$transaction(async (tx) => {
      const job = await tx.analysisJob.findFirst({
        where: { id: jobId, userId },
        include: {
          pageEvidence: { include: { screenshots: true } },
          analysisResult: true,
          blueprintArtifacts: true,
          exportRecords: true,
        },
      });

      if (!job) {
        throw new NotFoundError('Analysis job not found');
      }

      const storageKeysToRemove = collectJobStorageKeys(job);
      await tx.analysisJob.delete({ where: { id: job.id } });

      return {
        deletedJobId: job.id,
        storageKeysToRemove,
      };
    });
  }

  async purgeExpiredRetentionData(now = new Date()): Promise<RetentionPurgeSummary> {
    return this.db.$transaction(async (tx) => {
      const expiredExports = await tx.exportRecord.findMany({
        where: { expiresAt: { lte: now } },
        select: { id: true, storageKey: true },
      });

      const expiredJobs = await tx.analysisJob.findMany({
        where: { expiresAt: { not: null, lte: now } },
        include: {
          pageEvidence: { include: { screenshots: true } },
          analysisResult: true,
          blueprintArtifacts: true,
          exportRecords: true,
        },
      });

      const keys = new Set<string>();
      for (const exp of expiredExports) {
        if (exp.storageKey) keys.add(exp.storageKey);
      }
      for (const job of expiredJobs) {
        for (const k of collectJobStorageKeys(job)) {
          keys.add(k);
        }
      }

      const exportDel = await tx.exportRecord.deleteMany({
        where: { id: { in: expiredExports.map((e) => e.id) } },
      });
      const jobDel = await tx.analysisJob.deleteMany({
        where: { id: { in: expiredJobs.map((j) => j.id) } },
      });

      return {
        expiredExportsDeleted: exportDel.count,
        expiredJobsDeleted: jobDel.count,
        storageKeysToRemove: Array.from(keys),
      };
    });
  }
}
