-- CreateTable
CREATE TABLE "discovered_pages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "normalizedUrl" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "httpStatus" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DISCOVERED',
    "isEntryPage" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectedAt" DATETIME,
    CONSTRAINT "discovered_pages_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "modelName" TEXT NOT NULL,
    "architectureSummary" TEXT NOT NULL,
    "detectedPatterns" TEXT NOT NULL,
    "designTokenSummary" TEXT NOT NULL,
    "evidenceCoverage" TEXT NOT NULL,
    "confidenceScore" REAL,
    "rawArtifactStorageKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "analysis_results_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "implementation_prompts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blueprintId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "phaseNumber" INTEGER NOT NULL,
    "targetTool" TEXT NOT NULL DEFAULT 'antigravity',
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "promptMarkdown" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "isEditedByUser" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "implementation_prompts_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "blueprint_artifacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "implementation_prompts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "export_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileHash" TEXT,
    "fileSizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "expiresAt" DATETIME NOT NULL,
    "downloadedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "export_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "export_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "workerId" TEXT,
    "attemptNumber" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_analysis_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "crawlDepth" INTEGER NOT NULL DEFAULT 1,
    "viewportsConfig" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "workerId" TEXT,
    "leaseExpiresAt" DATETIME,
    "heartbeatAt" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "cancellationReason" TEXT,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "analysis_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_analysis_jobs" ("completedAt", "crawlDepth", "createdAt", "durationMs", "errorCode", "errorMessage", "id", "normalizedDomain", "progressPercent", "startedAt", "status", "targetUrl", "updatedAt", "userId", "viewportsConfig") SELECT "completedAt", "crawlDepth", "createdAt", "durationMs", "errorCode", "errorMessage", "id", "normalizedDomain", "progressPercent", "startedAt", "status", "targetUrl", "updatedAt", "userId", "viewportsConfig" FROM "analysis_jobs";
DROP TABLE "analysis_jobs";
ALTER TABLE "new_analysis_jobs" RENAME TO "analysis_jobs";
CREATE INDEX "analysis_jobs_userId_status_idx" ON "analysis_jobs"("userId", "status");
CREATE INDEX "analysis_jobs_userId_createdAt_idx" ON "analysis_jobs"("userId", "createdAt");
CREATE INDEX "analysis_jobs_normalizedDomain_idx" ON "analysis_jobs"("normalizedDomain");
CREATE INDEX "analysis_jobs_status_leaseExpiresAt_createdAt_idx" ON "analysis_jobs"("status", "leaseExpiresAt", "createdAt");
CREATE INDEX "analysis_jobs_expiresAt_idx" ON "analysis_jobs"("expiresAt");
CREATE UNIQUE INDEX "analysis_jobs_userId_idempotencyKey_key" ON "analysis_jobs"("userId", "idempotencyKey");
CREATE TABLE "new_blueprint_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "analysisResultId" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "designSystemSpec" TEXT NOT NULL,
    "componentArchitecture" TEXT NOT NULL,
    "stateInteractions" TEXT NOT NULL,
    "recommendedStack" TEXT NOT NULL,
    "antigravityPrompts" TEXT NOT NULL,
    "blueprintStorageKey" TEXT,
    "isEditedByUser" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "blueprint_artifacts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "blueprint_artifacts_analysisResultId_fkey" FOREIGN KEY ("analysisResultId") REFERENCES "analysis_results" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_blueprint_artifacts" ("antigravityPrompts", "componentArchitecture", "designSystemSpec", "generatedAt", "id", "isEditedByUser", "jobId", "recommendedStack", "stateInteractions", "updatedAt", "version") SELECT "antigravityPrompts", "componentArchitecture", "designSystemSpec", "generatedAt", "id", "isEditedByUser", "jobId", "recommendedStack", "stateInteractions", "updatedAt", "version" FROM "blueprint_artifacts";
DROP TABLE "blueprint_artifacts";
ALTER TABLE "new_blueprint_artifacts" RENAME TO "blueprint_artifacts";
CREATE INDEX "blueprint_artifacts_jobId_idx" ON "blueprint_artifacts"("jobId");
CREATE INDEX "blueprint_artifacts_analysisResultId_idx" ON "blueprint_artifacts"("analysisResultId");
CREATE UNIQUE INDEX "blueprint_artifacts_jobId_version_key" ON "blueprint_artifacts"("jobId", "version");
CREATE TABLE "new_page_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "discoveredPageId" TEXT,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL,
    "metaTags" TEXT NOT NULL,
    "domStructure" TEXT NOT NULL,
    "computedTypography" TEXT NOT NULL,
    "computedColors" TEXT NOT NULL,
    "computedSpacing" TEXT NOT NULL,
    "detectedComponents" TEXT NOT NULL,
    "domNodeCount" INTEGER NOT NULL DEFAULT 0,
    "domSnapshotStorageKey" TEXT,
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_evidence_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "page_evidence_discoveredPageId_fkey" FOREIGN KEY ("discoveredPageId") REFERENCES "discovered_pages" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_page_evidence" ("computedColors", "computedSpacing", "computedTypography", "detectedComponents", "domNodeCount", "domStructure", "extractedAt", "id", "jobId", "metaTags", "pageTitle", "pageUrl") SELECT "computedColors", "computedSpacing", "computedTypography", "detectedComponents", "domNodeCount", "domStructure", "extractedAt", "id", "jobId", "metaTags", "pageTitle", "pageUrl" FROM "page_evidence";
DROP TABLE "page_evidence";
ALTER TABLE "new_page_evidence" RENAME TO "page_evidence";
CREATE UNIQUE INDEX "page_evidence_discoveredPageId_key" ON "page_evidence"("discoveredPageId");
CREATE INDEX "page_evidence_jobId_idx" ON "page_evidence"("jobId");
CREATE UNIQUE INDEX "page_evidence_jobId_pageUrl_key" ON "page_evidence"("jobId", "pageUrl");
CREATE TABLE "new_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "authSessionId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_sessions" ("createdAt", "expiresAt", "id", "ipAddress", "sessionToken", "userAgent", "userId") SELECT "createdAt", "expiresAt", "id", "ipAddress", "sessionToken", "userAgent", "userId" FROM "sessions";
DROP TABLE "sessions";
ALTER TABLE "new_sessions" RENAME TO "sessions";
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");
CREATE INDEX "sessions_sessionToken_idx" ON "sessions"("sessionToken");
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "defaultPromptTarget" TEXT NOT NULL DEFAULT 'antigravity',
    "deletedAt" DATETIME,
    "deletionScheduledAt" DATETIME,
    "deletionReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt") SELECT "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");
CREATE TABLE "new_visual_screenshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "viewportType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "storageBucket" TEXT NOT NULL DEFAULT 'rebuildiq-artifacts',
    "storageKey" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visual_screenshots_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "page_evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_visual_screenshots" ("capturedAt", "evidenceId", "fileHash", "fileSizeBytes", "height", "id", "mimeType", "storageKey", "viewportType", "width") SELECT "capturedAt", "evidenceId", "fileHash", "fileSizeBytes", "height", "id", "mimeType", "storageKey", "viewportType", "width" FROM "visual_screenshots";
DROP TABLE "visual_screenshots";
ALTER TABLE "new_visual_screenshots" RENAME TO "visual_screenshots";
CREATE INDEX "visual_screenshots_evidenceId_idx" ON "visual_screenshots"("evidenceId");
CREATE UNIQUE INDEX "visual_screenshots_evidenceId_viewportType_key" ON "visual_screenshots"("evidenceId", "viewportType");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "discovered_pages_jobId_status_idx" ON "discovered_pages"("jobId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "discovered_pages_jobId_normalizedUrl_key" ON "discovered_pages"("jobId", "normalizedUrl");

-- CreateIndex
CREATE UNIQUE INDEX "analysis_results_jobId_key" ON "analysis_results"("jobId");

-- CreateIndex
CREATE INDEX "implementation_prompts_jobId_targetTool_idx" ON "implementation_prompts"("jobId", "targetTool");

-- CreateIndex
CREATE UNIQUE INDEX "implementation_prompts_blueprintId_targetTool_phaseNumber_key" ON "implementation_prompts"("blueprintId", "targetTool", "phaseNumber");

-- CreateIndex
CREATE INDEX "export_records_userId_createdAt_idx" ON "export_records"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "export_records_jobId_format_idx" ON "export_records"("jobId", "format");

-- CreateIndex
CREATE INDEX "export_records_expiresAt_idx" ON "export_records"("expiresAt");

-- CreateIndex
CREATE INDEX "job_events_jobId_createdAt_idx" ON "job_events"("jobId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "job_events_jobId_idempotencyKey_key" ON "job_events"("jobId", "idempotencyKey");

-- Database-level durable job transition enforcement & object-storage invariant triggers
CREATE TRIGGER "trg_analysis_jobs_status_transition"
BEFORE UPDATE OF "status" ON "analysis_jobs"
WHEN NEW."status" <> OLD."status"
BEGIN
    SELECT CASE
        WHEN OLD."status" = 'PENDING' AND NEW."status" IN ('VALIDATING', 'QUEUED', 'FAILED', 'CANCELLED') THEN 1
        WHEN OLD."status" = 'VALIDATING' AND NEW."status" IN ('QUEUED', 'INSPECTING', 'FAILED', 'CANCELLED') THEN 1
        WHEN OLD."status" = 'QUEUED' AND NEW."status" IN ('INSPECTING', 'FAILED', 'CANCELLED') THEN 1
        WHEN OLD."status" = 'INSPECTING' AND NEW."status" IN ('EXTRACTING_EVIDENCE', 'QUEUED', 'FAILED', 'CANCELLED') THEN 1
        WHEN OLD."status" = 'EXTRACTING_EVIDENCE' AND NEW."status" IN ('ANALYZING_AI', 'QUEUED', 'FAILED', 'CANCELLED') THEN 1
        WHEN OLD."status" = 'ANALYZING_AI' AND NEW."status" IN ('GENERATING_BLUEPRINT', 'QUEUED', 'FAILED', 'CANCELLED') THEN 1
        WHEN OLD."status" = 'GENERATING_BLUEPRINT' AND NEW."status" IN ('COMPLETED', 'QUEUED', 'FAILED', 'CANCELLED') THEN 1
        WHEN OLD."status" = 'FAILED' AND NEW."status" IN ('QUEUED') THEN 1
        ELSE RAISE(ABORT, 'Invalid analysis job state transition')
    END;
END;

CREATE TRIGGER "trg_visual_screenshots_no_inline_blob_insert"
BEFORE INSERT ON "visual_screenshots"
BEGIN
    SELECT CASE
        WHEN length(trim(NEW."storageKey")) = 0 OR lower(NEW."storageKey") LIKE 'data:%'
        THEN RAISE(ABORT, 'Inline binary or data URIs are prohibited in visual_screenshots.storageKey')
    END;
END;

CREATE TRIGGER "trg_visual_screenshots_no_inline_blob_update"
BEFORE UPDATE OF "storageKey" ON "visual_screenshots"
BEGIN
    SELECT CASE
        WHEN length(trim(NEW."storageKey")) = 0 OR lower(NEW."storageKey") LIKE 'data:%'
        THEN RAISE(ABORT, 'Inline binary or data URIs are prohibited in visual_screenshots.storageKey')
    END;
END;

CREATE TRIGGER "trg_export_records_no_inline_blob_insert"
BEFORE INSERT ON "export_records"
WHEN NEW."storageKey" IS NOT NULL AND lower(NEW."storageKey") LIKE 'data:%'
BEGIN
    SELECT RAISE(ABORT, 'Inline binary or data URIs are prohibited in export_records.storageKey');
END;
