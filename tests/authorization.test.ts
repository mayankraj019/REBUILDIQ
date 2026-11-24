import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAuth, requireJobOwnership, AuthError, NotFoundError } from '../lib/auth/middleware';
import * as sessionModule from '../lib/auth/session';
import { prisma } from '../lib/db/prisma';

describe('Server-Side Authorization & Multi-Tenant Isolation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw AuthError (401) when session is missing or unverified', async () => {
    vi.spyOn(sessionModule, 'validateSession').mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow(AuthError);
    await expect(requireAuth()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('should resolve verified session and user when valid session exists', async () => {
    const mockAuthResult = {
      session: {
        id: 'sess-123',
        userId: 'user-abc',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
      user: {
        id: 'user-abc',
        email: 'owner@example.com',
        name: 'Account Owner',
        role: 'USER',
        createdAt: new Date(),
      },
    };

    vi.spyOn(sessionModule, 'validateSession').mockResolvedValue(mockAuthResult);

    // Mock request with session cookie
    const mockRequest = {
      cookies: {
        get: () => ({ value: 'valid-session-token' }),
      },
      headers: {
        get: () => null,
      },
    } as any;

    const result = await requireAuth(mockRequest);
    expect(result).toBeDefined();
    expect(result.user.id).toBe('user-abc');
    expect(result.user.email).toBe('owner@example.com');
  });

  it('should permit access when requesting user owns the AnalysisJob', async () => {
    const mockJob = {
      id: 'job-100',
      userId: 'user-1',
      targetUrl: 'https://example.com',
      status: 'COMPLETED',
      pageEvidence: [],
      blueprintArtifacts: [],
    };

    vi.spyOn(prisma.analysisJob, 'findFirst').mockResolvedValue(mockJob as any);

    const job = await requireJobOwnership('job-100', 'user-1');
    expect(job).toBeDefined();
    expect(job.id).toBe('job-100');
    expect(job.userId).toBe('user-1');
  });

  it('should throw NotFoundError (404) when User B attempts to access User A job', async () => {
    // When User B ('user-2') queries job 'job-100' owned by User A ('user-1'),
    // Prisma findFirst with { id: 'job-100', userId: 'user-2' } returns null.
    vi.spyOn(prisma.analysisJob, 'findFirst').mockResolvedValue(null);

    await expect(requireJobOwnership('job-100', 'user-2')).rejects.toThrow(NotFoundError);
    await expect(requireJobOwnership('job-100', 'user-2')).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should return 404 rather than 403 to prevent resource enumeration attacks', async () => {
    vi.spyOn(prisma.analysisJob, 'findFirst').mockResolvedValue(null);

    try {
      await requireJobOwnership('job-foreign', 'attacker-user');
      expect.fail('Should have thrown NotFoundError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Analysis job not found');
    }
  });
});
