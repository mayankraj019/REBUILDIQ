-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "normalizedDomain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "crawlDepth" INTEGER NOT NULL DEFAULT 1,
    "viewportsConfig" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "analysis_jobs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "page_evidence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "pageUrl" TEXT NOT NULL,
    "pageTitle" TEXT NOT NULL,
    "metaTags" TEXT NOT NULL,
    "domStructure" TEXT NOT NULL,
    "computedTypography" TEXT NOT NULL,
    "computedColors" TEXT NOT NULL,
    "computedSpacing" TEXT NOT NULL,
    "detectedComponents" TEXT NOT NULL,
    "domNodeCount" INTEGER NOT NULL DEFAULT 0,
    "extractedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "page_evidence_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "visual_screenshots" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evidenceId" TEXT NOT NULL,
    "viewportType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT 'image/png',
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "visual_screenshots_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "page_evidence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "blueprint_artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "designSystemSpec" TEXT NOT NULL,
    "componentArchitecture" TEXT NOT NULL,
    "stateInteractions" TEXT NOT NULL,
    "recommendedStack" TEXT NOT NULL,
    "antigravityPrompts" TEXT NOT NULL,
    "isEditedByUser" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "blueprint_artifacts_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "job_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "job_audit_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "analysis_jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_expiresAt_idx" ON "sessions"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "sessions_sessionToken_idx" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "analysis_jobs_userId_status_idx" ON "analysis_jobs"("userId", "status");

-- CreateIndex
CREATE INDEX "analysis_jobs_userId_createdAt_idx" ON "analysis_jobs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "analysis_jobs_normalizedDomain_idx" ON "analysis_jobs"("normalizedDomain");

-- CreateIndex
CREATE INDEX "page_evidence_jobId_idx" ON "page_evidence"("jobId");

-- CreateIndex
CREATE INDEX "visual_screenshots_evidenceId_idx" ON "visual_screenshots"("evidenceId");

-- CreateIndex
CREATE INDEX "blueprint_artifacts_jobId_idx" ON "blueprint_artifacts"("jobId");

-- CreateIndex
CREATE INDEX "job_audit_logs_jobId_timestamp_idx" ON "job_audit_logs"("jobId", "timestamp");
