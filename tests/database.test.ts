import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../lib/db/prisma';
import { hashPassword } from '../lib/auth/password';
import { createSession, validateSession, revokeSession } from '../lib/auth/session';

describe('Prisma Database Layer, Relational Integrity & Cascade Rules', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-db' } },
    });
  });

  it('should create a User and enforce unique email constraints', async () => {
    const passwordHash = await hashPassword('SecureP@ssword123');

    const user1 = await prisma.user.create({
      data: {
        email: 'user1.test-db@rebuildiq.dev',
        name: 'Database Tester 1',
        passwordHash,
      },
    });

    expect(user1).toBeDefined();
    expect(user1.id).toBeDefined();
    expect(user1.email).toBe('user1.test-db@rebuildiq.dev');

    // Attempt duplicate email insertion
    await expect(
      prisma.user.create({
        data: {
          email: 'user1.test-db@rebuildiq.dev',
          name: 'Duplicate Tester',
          passwordHash,
        },
      })
    ).rejects.toThrow();
  });

  it('should create an active session, validate it, and support revocation', async () => {
    const passwordHash = await hashPassword('SecureP@ssword123');

    const user = await prisma.user.create({
      data: {
        email: 'session.test-db@rebuildiq.dev',
        name: 'Session Tester',
        passwordHash,
      },
    });

    const { rawToken, expiresAt } = await createSession(user.id, {
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest/2.1',
    });

    expect(rawToken).toHaveLength(64);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Validate session
    const validated = await validateSession(rawToken);
    expect(validated).not.toBeNull();
    expect(validated?.user.id).toBe(user.id);
    expect(validated?.user.email).toBe('session.test-db@rebuildiq.dev');

    // Revoke session
    const revoked = await revokeSession(rawToken);
    expect(revoked).toBe(true);

    // Validate after revocation should return null
    const validatedAfter = await validateSession(rawToken);
    expect(validatedAfter).toBeNull();
  });

  it('should cascade delete sessions and analysis jobs when user is deleted', async () => {
    const passwordHash = await hashPassword('SecureP@ssword123');

    const user = await prisma.user.create({
      data: {
        email: 'cascade.test-db@rebuildiq.dev',
        name: 'Cascade Tester',
        passwordHash,
      },
    });

    // Create session
    const { rawToken } = await createSession(user.id);

    // Create AnalysisJob
    const job = await prisma.analysisJob.create({
      data: {
        userId: user.id,
        targetUrl: 'https://example.com',
        normalizedDomain: 'example.com',
        status: 'INSPECTING',
        viewportsConfig: JSON.stringify(['mobile', 'desktop']),
      },
    });

    // Create PageEvidence
    const evidence = await prisma.pageEvidence.create({
      data: {
        jobId: job.id,
        pageUrl: 'https://example.com',
        pageTitle: 'Example Domain',
        metaTags: JSON.stringify({ description: 'Example domain' }),
        domStructure: JSON.stringify({ tag: 'body', children: [] }),
        computedTypography: JSON.stringify([]),
        computedColors: JSON.stringify({ backgrounds: ['#FFFFFF'] }),
        computedSpacing: JSON.stringify({ padding: ['16px'] }),
        detectedComponents: JSON.stringify([]),
      },
    });

    // Create VisualScreenshot
    await prisma.visualScreenshot.create({
      data: {
        evidenceId: evidence.id,
        viewportType: 'DESKTOP',
        width: 1280,
        height: 800,
        storageKey: 'screenshots/test.png',
        fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        fileSizeBytes: 1024,
      },
    });

    // Create BlueprintArtifact
    await prisma.blueprintArtifact.create({
      data: {
        jobId: job.id,
        designSystemSpec: JSON.stringify({ colors: {} }),
        componentArchitecture: JSON.stringify([]),
        stateInteractions: JSON.stringify({}),
        recommendedStack: JSON.stringify({ framework: 'nextjs' }),
        antigravityPrompts: '# Phase 1 Reconstruction Prompt',
      },
    });

    // Verify all records exist
    const sessionCountBefore = await prisma.session.count({ where: { userId: user.id } });
    const jobCountBefore = await prisma.analysisJob.count({ where: { userId: user.id } });
    const evidenceCountBefore = await prisma.pageEvidence.count({ where: { jobId: job.id } });
    expect(sessionCountBefore).toBe(1);
    expect(jobCountBefore).toBe(1);
    expect(evidenceCountBefore).toBe(1);

    // Delete user
    await prisma.user.delete({ where: { id: user.id } });

    // Verify CASCADE deletion
    const sessionCountAfter = await prisma.session.count({ where: { userId: user.id } });
    const jobCountAfter = await prisma.analysisJob.count({ where: { userId: user.id } });
    const evidenceCountAfter = await prisma.pageEvidence.count({ where: { jobId: job.id } });
    const screenshotCountAfter = await prisma.visualScreenshot.count({ where: { evidenceId: evidence.id } });
    const blueprintCountAfter = await prisma.blueprintArtifact.count({ where: { jobId: job.id } });

    expect(sessionCountAfter).toBe(0);
    expect(jobCountAfter).toBe(0);
    expect(evidenceCountAfter).toBe(0);
    expect(screenshotCountAfter).toBe(0);
    expect(blueprintCountAfter).toBe(0);
  });
});
