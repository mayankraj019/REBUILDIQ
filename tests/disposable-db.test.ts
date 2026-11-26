import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NotFoundError } from '@/lib/auth/middleware';
import {
  InvalidStateTransitionError,
  PrismaAnalysisRepository,
  SupabaseAnalysisRepository,
  normalizePageUrl,
  sha256Hex,
} from '@/lib/db';
import { ValidationError } from '@/lib/errors';

describe('Disposable Database Migrations, Relationships, Ownership, State Transitions & Retention', () => {
  let tempDir: string;
  let dbPath: string;
  let dbUrl: string;
  let prisma: PrismaClient;
  let repo: PrismaAnalysisRepository;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rebuildiq-disposable-db-'));
    dbPath = path.join(tempDir, 'disposable.sqlite');
    dbUrl = `file:${dbPath}`;

    const prismaBin = path.resolve(__dirname, '../node_modules/.bin/prisma');
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');

    // Run full version-controlled migration history from empty file into disposable DB
    execFileSync(prismaBin, ['migrate', 'deploy', '--schema', schemaPath], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });
    await prisma.$connect();
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON;');

    repo = new PrismaAnalysisRepository(prisma);

    const userA = await prisma.user.create({
      data: {
        email: 'owner-a@disposable.rebuildiq.test',
        passwordHash: 'argon2id-placeholder-hash-a',
        name: 'Owner A',
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: 'tenant-b@disposable.rebuildiq.test',
        passwordHash: 'argon2id-placeholder-hash-b',
        name: 'Tenant B',
      },
    });

    userAId = userA.id;
    userBId = userB.id;
  }, 30_000);

  afterAll(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should apply all versioned migrations cleanly from scratch including SQLite enforcement triggers', async () => {
    expect(fs.existsSync(dbPath)).toBe(true);

    const migrations = await prisma.$queryRawUnsafe<
      Array<{ migration_name: string; finished_at: string | null }>
    >('SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY started_at ASC');

    const migrationNames = migrations.map((m) => m.migration_name);
    expect(migrationNames).toContain('20261124113424_init_phase2_schema');
    expect(migrationNames).toContain('20261126175232_complete_domain_data_model');
    expect(migrations.every((m) => m.finished_at !== null)).toBe(true);

    const triggers = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type = 'trigger'`
    );
    const triggerNames = triggers.map((t) => t.name);
    expect(triggerNames).toContain('trg_analysis_jobs_status_transition');
    expect(triggerNames).toContain('trg_visual_screenshots_no_inline_blob_insert');
    expect(triggerNames).toContain('trg_export_records_no_inline_blob_insert');
  });

  it('should persist full relational entity graph across sessions, jobs, pages, evidence, screenshots, results, blueprints, prompts, exports, and events', async () => {
    const session = await prisma.session.create({
      data: {
        userId: userAId,
        sessionToken: sha256Hex('disposable-session-token-a'),
        authSessionId: 'auth-sess-001',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    expect(session.userId).toBe(userAId);

    const { job, deduplicated } = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://Example.com/landing/#top',
      crawlDepth: 2,
      viewports: ['desktop', 'mobile'],
      idempotencyKey: 'create-job-graph-001',
    });
    expect(deduplicated).toBe(false);
    expect(job.normalizedDomain).toBe('example.com');
    expect(job.status).toBe('QUEUED');

    const claimed = await repo.claimNextQueuedJob('worker-alpha', 60_000);
    expect(claimed?.id).toBe(job.id);
    expect(claimed?.status).toBe('INSPECTING');
    expect(claimed?.attemptCount).toBe(1);

    await repo.transitionJobStatus(job.id, userAId, 'EXTRACTING_EVIDENCE', {
      progressPercent: 40,
      workerId: 'worker-alpha',
    });

    const discoveredPricing = await repo.upsertDiscoveredPage(job.id, userAId, {
      url: 'https://example.com/pricing/',
      depth: 1,
      httpStatus: 200,
      status: 'INSPECTING',
    });
    expect(discoveredPricing.normalizedUrl).toBe('https://example.com/pricing');

    const evidence = await repo.recordPageEvidenceAndScreenshots(job.id, userAId, {
      discoveredPageId: discoveredPricing.id,
      pageUrl: 'https://example.com/pricing',
      pageTitle: 'Example Pricing',
      metaTags: { description: 'Plans' },
      domStructure: [{ tag: 'header', depth: 1, childrenCount: 3, label: 'Nav' }],
      computedTypography: [{ role: 'heading', fontFamily: 'Inter', fontSize: '40px' }],
      computedColors: [{ hex: '#14213D', usage: 'primary' }],
      computedSpacing: [{ token: 'section-y', value: '64px' }],
      detectedComponents: ['PricingGrid'],
      domNodeCount: 245,
      domSnapshotStorageKey: `${userAId}/${job.id}/dom-pricing.json`,
      screenshots: [
        {
          viewportType: 'DESKTOP',
          width: 1440,
          height: 900,
          storageKey: `${userAId}/${job.id}/pricing-desktop.png`,
          fileHash: sha256Hex('desktop-png'),
          fileSizeBytes: 51200,
        },
        {
          viewportType: 'MOBILE',
          width: 390,
          height: 844,
          storageKey: `${userAId}/${job.id}/pricing-mobile.png`,
          fileHash: sha256Hex('mobile-png'),
          fileSizeBytes: 28400,
        },
      ],
    });
    expect(evidence.id).toBeTruthy();

    await repo.transitionJobStatus(job.id, userAId, 'ANALYZING_AI', { progressPercent: 65 });
    await repo.transitionJobStatus(job.id, userAId, 'GENERATING_BLUEPRINT', { progressPercent: 85 });

    const synthesis = await repo.saveAnalysisResultsAndBlueprint(job.id, userAId, {
      provider: 'gemini',
      modelName: 'gemini-2.5-pro',
      architectureSummary: 'Modular SaaS marketing landing with 3-tier pricing matrix.',
      detectedPatterns: ['StickyHeader', 'PricingTierCards'],
      designTokenSummary: { palette: ['#14213D', '#F4EDE0'] },
      evidenceCoverage: { inspectedPages: 1, totalScreenshots: 2 },
      confidenceScore: 0.94,
      rawArtifactStorageKey: `${userAId}/${job.id}/ai-raw.json`,
      blueprintVersion: '1.0.0',
      designSystemSpec: { colors: [{ name: 'Navy', hex: '#14213D', role: 'primary' }] },
      componentArchitecture: [{ name: 'PricingGrid', purpose: 'Tier cards' }],
      stateInteractions: [{ component: 'BillingToggle', trigger: 'click', expectedState: 'annual' }],
      recommendedStack: [{ layer: 'Framework', choice: 'Next.js', rationale: 'App Router SSR' }],
      blueprintStorageKey: `${userAId}/${job.id}/blueprint-v1.json`,
      prompts: [
        {
          phaseNumber: 1,
          targetTool: 'antigravity',
          title: 'Design Tokens & Shell',
          objective: 'Bootstrap theme variables',
          promptMarkdown: '# Phase 1\nDefine CSS tokens for #14213D',
        },
        {
          phaseNumber: 2,
          targetTool: 'antigravity',
          title: 'Pricing Matrix',
          objective: 'Implement tier grid',
          promptMarkdown: '# Phase 2\nBuild responsive 3-column PricingGrid',
        },
      ],
      markCompleted: true,
    });

    expect(synthesis.blueprint.prompts).toHaveLength(2);

    const exportRec = await repo.recordExport(job.id, userAId, {
      format: 'zip',
      storageKey: `${userAId}/${job.id}/rebuildiq-pack.zip`,
      fileHash: sha256Hex('zip-bytes'),
      fileSizeBytes: 120000,
    });
    const downloadedExport = await repo.markExportDownloaded(exportRec.id, userAId);
    expect(downloadedExport.downloadedAt).not.toBeNull();

    const bundle = await repo.requireOwnedJobBundle(job.id, userAId);
    expect(bundle.status).toBe('COMPLETED');
    expect(bundle.discoveredPages.length).toBeGreaterThanOrEqual(2);
    expect(bundle.pageEvidence).toHaveLength(1);
    expect(bundle.pageEvidence[0].screenshots).toHaveLength(2);
    expect(bundle.analysisResult?.modelName).toBe('gemini-2.5-pro');
    expect(bundle.blueprintArtifacts[0].prompts).toHaveLength(2);
    expect(bundle.blueprintArtifacts[0].prompts[0].promptHash).toBe(
      sha256Hex('# Phase 1\nDefine CSS tokens for #14213D')
    );
    expect(bundle.exportRecords).toHaveLength(1);
    expect(bundle.jobEvents.length).toBeGreaterThanOrEqual(5);
  });

  it('should enforce strict tenant isolation across all read, mutation, export, and delete operations', async () => {
    const { job: ownerJob } = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://private-tenant.example.com',
      idempotencyKey: 'tenant-isolation-job-001',
    });

    const ownerExport = await repo.recordExport(ownerJob.id, userAId, {
      format: 'prompts-md',
      storageKey: `${userAId}/${ownerJob.id}/prompts.md`,
    });

    const userBJobs = await repo.listJobsForUser(userBId);
    expect(userBJobs.some((j) => j.id === ownerJob.id)).toBe(false);

    await expect(repo.requireOwnedJobBundle(ownerJob.id, userBId)).rejects.toThrow(NotFoundError);
    await expect(repo.transitionJobStatus(ownerJob.id, userBId, 'FAILED')).rejects.toThrow(
      NotFoundError
    );
    await expect(repo.cancelJob(ownerJob.id, userBId)).rejects.toThrow(NotFoundError);
    await expect(
      repo.upsertDiscoveredPage(ownerJob.id, userBId, { url: 'https://private-tenant.example.com/x' })
    ).rejects.toThrow(NotFoundError);
    await expect(
      repo.recordPageEvidenceAndScreenshots(ownerJob.id, userBId, {
        pageUrl: 'https://private-tenant.example.com',
        pageTitle: 'Hacked',
        metaTags: {},
        domStructure: [],
        computedTypography: [],
        computedColors: [],
        computedSpacing: [],
        detectedComponents: [],
        domNodeCount: 1,
      })
    ).rejects.toThrow(NotFoundError);
    await expect(
      repo.saveAnalysisResultsAndBlueprint(ownerJob.id, userBId, {
        provider: 'mock',
        modelName: 'test',
        architectureSummary: 'Unauthorized overwrite attempt',
        detectedPatterns: [],
        designTokenSummary: {},
        evidenceCoverage: {},
        designSystemSpec: {},
        componentArchitecture: [],
        stateInteractions: [],
        recommendedStack: [],
        prompts: [],
      })
    ).rejects.toThrow(NotFoundError);
    await expect(
      repo.recordExport(ownerJob.id, userBId, { format: 'blueprint-json' })
    ).rejects.toThrow(NotFoundError);
    await expect(repo.markExportDownloaded(ownerExport.id, userBId)).rejects.toThrow(
      NotFoundError
    );
    await expect(repo.deleteJobForUser(ownerJob.id, userBId)).rejects.toThrow(NotFoundError);

    // Owner still finds job unharmed
    const intact = await repo.requireOwnedJobBundle(ownerJob.id, userAId);
    expect(intact.id).toBe(ownerJob.id);

    // Verify SupabaseAnalysisRepository also rejects cross-user access with NotFoundError (404)
    const mockUserBScopedSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    } as any;

    const supaRepo = new SupabaseAnalysisRepository(mockUserBScopedSupabase);
    await expect(supaRepo.requireOwnedJobBundle(ownerJob.id, userBId)).rejects.toThrow(
      NotFoundError
    );
    await expect(supaRepo.transitionJobStatus(ownerJob.id, userBId, 'FAILED')).rejects.toThrow(
      NotFoundError
    );
    await expect(supaRepo.cancelJob(ownerJob.id, userBId)).rejects.toThrow(NotFoundError);
    await expect(supaRepo.deleteJobForUser(ownerJob.id, userBId)).rejects.toThrow(NotFoundError);
  });

  it('should enforce durable job transitions, DB triggers, worker claim exclusivity, cancellation, and stale crash recovery', async () => {
    const { job } = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://recovery.example.com',
      maxAttempts: 2,
    });

    // App-layer invalid transition rejected with 409 InvalidStateTransitionError
    await expect(repo.transitionJobStatus(job.id, userAId, 'COMPLETED')).rejects.toThrow(
      InvalidStateTransitionError
    );

    // Database-layer SQLite trigger rejects direct illegal jump bypassing repo logic
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "analysis_jobs" SET "status" = 'COMPLETED' WHERE "id" = ?`,
        job.id
      )
    ).rejects.toThrow(/Invalid analysis job state transition/);

    // Clear other queued jobs temporarily by cancelling any leftover from earlier test
    const leftovers = await prisma.analysisJob.findMany({
      where: { status: 'QUEUED', id: { not: job.id } },
    });
    for (const row of leftovers) {
      await repo.cancelJob(row.id, row.userId, 'Test cleanup');
    }

    // Attempt #1 claimed cleanly by worker-1; second worker sees no queued job
    const claim1 = await repo.claimNextQueuedJob('worker-1', 10_000);
    const claim2 = await repo.claimNextQueuedJob('worker-2', 10_000);
    expect(claim1?.id).toBe(job.id);
    expect(claim1?.attemptCount).toBe(1);
    expect(claim2).toBeNull();

    // Heartbeat extends active worker lease
    expect(await repo.heartbeatJob(job.id, 'worker-1', 15_000)).toBe(true);
    expect(await repo.heartbeatJob(job.id, 'wrong-worker', 15_000)).toBe(false);

    // Simulate worker-1 crash: lease expires in the past -> stale recovery requeues
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { leaseExpiresAt: new Date(Date.now() - 60_000) },
    });
    const firstRecovery = await repo.recoverStaleJobs(new Date());
    expect(firstRecovery).toEqual({ requeued: 1, failed: 0 });

    // Worker-2 picks up recovered attempt #2 (maxAttempts = 2)
    const claimRetry = await repo.claimNextQueuedJob('worker-2', 10_000);
    expect(claimRetry?.id).toBe(job.id);
    expect(claimRetry?.attemptCount).toBe(2);

    // Simulate second crash -> retry budget exhausted -> FAILED WORKER_CRASH_MAX_RETRIES
    await prisma.analysisJob.update({
      where: { id: job.id },
      data: { leaseExpiresAt: new Date(Date.now() - 60_000) },
    });
    const secondRecovery = await repo.recoverStaleJobs(new Date());
    expect(secondRecovery).toEqual({ requeued: 0, failed: 1 });

    const finalState = await repo.requireOwnedJobBundle(job.id, userAId);
    expect(finalState.status).toBe('FAILED');
    expect(finalState.errorCode).toBe('WORKER_CRASH_MAX_RETRIES');
    expect(finalState.workerId).toBeNull();
    expect(finalState.jobEvents.some((e) => e.eventType === 'STALE_RECOVERED')).toBe(true);

    // Cancel path from QUEUED blocks further claims & transitions
    const { job: cancelTarget } = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://cancel-me.example.com',
    });
    const cancelled = await repo.cancelJob(cancelTarget.id, userAId, 'User aborted crawl');
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.cancellationReason).toBe('User aborted crawl');
    await expect(repo.transitionJobStatus(cancelTarget.id, userAId, 'QUEUED')).rejects.toThrow(
      InvalidStateTransitionError
    );
  });

  it('should deduplicate repeated job creation, normalized crawl URLs, and evidence upserts', async () => {
    const first = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://idempotent.example.com',
      idempotencyKey: 'idem-submit-key-99',
    });
    const second = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://idempotent.example.com',
      idempotencyKey: 'idem-submit-key-99',
    });

    expect(first.deduplicated).toBe(false);
    expect(second.deduplicated).toBe(true);
    expect(second.job.id).toBe(first.job.id);

    expect(normalizePageUrl('HTTPS://Docs.Example.COM:443/guide/#section')).toBe(
      'https://docs.example.com/guide'
    );

    const p1 = await repo.upsertDiscoveredPage(first.job.id, userAId, {
      url: 'https://Docs.Example.COM:443/guide/#top',
      depth: 1,
      status: 'DISCOVERED',
    });
    const p2 = await repo.upsertDiscoveredPage(first.job.id, userAId, {
      url: 'https://docs.example.com/guide/',
      depth: 1,
      httpStatus: 200,
      status: 'COMPLETED',
    });
    expect(p1.id).toBe(p2.id);
    expect(p2.status).toBe('COMPLETED');
    expect(p2.httpStatus).toBe(200);

    // Clean up cancelled state so queued jobs don't linger
    await repo.cancelJob(first.job.id, userAId, 'Done testing idempotency');
  });

  it('should block inline binary data URIs in both application repository and SQLite triggers', async () => {
    const { job } = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://storage-rules.example.com',
    });

    await expect(
      repo.recordPageEvidenceAndScreenshots(job.id, userAId, {
        pageUrl: 'https://storage-rules.example.com',
        pageTitle: 'Storage Rules',
        metaTags: {},
        domStructure: [],
        computedTypography: [],
        computedColors: [],
        computedSpacing: [],
        detectedComponents: [],
        domNodeCount: 5,
        screenshots: [
          {
            viewportType: 'DESKTOP',
            width: 1280,
            height: 720,
            storageKey: 'data:image/png;base64,iVBORw0KGgoAAAANS',
            fileHash: 'abc',
            fileSizeBytes: 120,
          },
        ],
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      repo.recordExport(job.id, userAId, {
        format: 'zip',
        storageKey: 'data:application/zip;base64,UEsDBAo=',
      })
    ).rejects.toThrow(ValidationError);

    // Insert valid evidence then test direct SQLite trigger blocking inline blob insert on visual_screenshots
    const validEv = await repo.recordPageEvidenceAndScreenshots(job.id, userAId, {
      pageUrl: 'https://storage-rules.example.com',
      pageTitle: 'Storage Rules',
      metaTags: {},
      domStructure: [],
      computedTypography: [],
      computedColors: [],
      computedSpacing: [],
      detectedComponents: [],
      domNodeCount: 5,
    });

    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "visual_screenshots" ("id", "evidenceId", "viewportType", "width", "height", "storageKey", "fileHash", "fileSizeBytes")
         VALUES (?, ?, 'MOBILE', 390, 844, 'data:image/png;base64,BAD', 'hash', 100)`,
        'shot-inline-block',
        validEv.id
      )
    ).rejects.toThrow(/Inline binary or data URIs are prohibited/);
  });

  it('should cascade deletions and return referenced object storage keys during manual delete and retention purge', async () => {
    const { job: deleteMe } = await repo.createJob({
      userId: userAId,
      targetUrl: 'https://delete-cascade.example.com',
      retentionDays: 90,
    });

    const delKeyShot = `${userAId}/${deleteMe.id}/desktop.png`;
    const delKeyDom = `${userAId}/${deleteMe.id}/dom.json`;
    const delKeyExport = `${userAId}/${deleteMe.id}/pack.zip`;

    await repo.recordPageEvidenceAndScreenshots(deleteMe.id, userAId, {
      pageUrl: 'https://delete-cascade.example.com',
      pageTitle: 'Cascade Delete',
      metaTags: {},
      domStructure: [],
      computedTypography: [],
      computedColors: [],
      computedSpacing: [],
      detectedComponents: [],
      domNodeCount: 10,
      domSnapshotStorageKey: delKeyDom,
      screenshots: [
        {
          viewportType: 'DESKTOP',
          width: 1440,
          height: 900,
          storageKey: delKeyShot,
          fileHash: sha256Hex('shot'),
          fileSizeBytes: 900,
        },
      ],
    });
    await repo.recordExport(deleteMe.id, userAId, {
      format: 'zip',
      storageKey: delKeyExport,
      expiresInDays: 7,
    });

    const cleanup = await repo.deleteJobForUser(deleteMe.id, userAId);
    expect(cleanup.deletedJobId).toBe(deleteMe.id);
    expect(cleanup.storageKeysToRemove).toEqual(
      expect.arrayContaining([delKeyDom, delKeyShot, delKeyExport])
    );

    // Ensure child records are fully removed via ON DELETE CASCADE
    expect(await prisma.pageEvidence.count({ where: { jobId: deleteMe.id } })).toBe(0);
    expect(await prisma.discoveredPage.count({ where: { jobId: deleteMe.id } })).toBe(0);
    expect(await prisma.exportRecord.count({ where: { jobId: deleteMe.id } })).toBe(0);
    expect(await prisma.jobEvent.count({ where: { jobId: deleteMe.id } })).toBe(0);

    // Create expired export + expired job vs fresh job, then run retention sweep
    const { job: expiredJob } = await repo.createJob({
      userId: userBId,
      targetUrl: 'https://expired-job.example.com',
      retentionDays: -1,
    });
    const expiredJobExportKey = `${userBId}/${expiredJob.id}/expired-pack.zip`;
    await repo.recordExport(expiredJob.id, userBId, {
      format: 'zip',
      storageKey: expiredJobExportKey,
      expiresInDays: 1,
    });

    const { job: activeJob } = await repo.createJob({
      userId: userBId,
      targetUrl: 'https://active-retained.example.com',
      retentionDays: 90,
    });
    const expiredStandaloneExportKey = `${userBId}/${activeJob.id}/old-export.md`;
    await repo.recordExport(activeJob.id, userBId, {
      format: 'prompts-md',
      storageKey: expiredStandaloneExportKey,
      expiresInDays: -1,
    });

    const purge = await repo.purgeExpiredRetentionData(new Date());
    expect(purge.expiredExportsDeleted).toBe(1);
    expect(purge.expiredJobsDeleted).toBe(1);
    expect(purge.storageKeysToRemove).toEqual(
      expect.arrayContaining([expiredStandaloneExportKey, expiredJobExportKey])
    );

    // Non-expired job survives retention sweep
    const surviving = await repo.requireOwnedJobBundle(activeJob.id, userBId);
    expect(surviving.id).toBe(activeJob.id);
  });
});
