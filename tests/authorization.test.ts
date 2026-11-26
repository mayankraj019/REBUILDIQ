import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { requireAuth, requireJobOwnership, AuthError, NotFoundError } from '../lib/auth/middleware';
import * as routeClientModule from '../lib/supabase/route';

describe('Server-Side Authorization & Multi-Tenant Isolation (Supabase)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should throw AuthError (401) when Supabase session is missing or unverified', async () => {
    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Missing JWT' } }),
        },
      } as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    const mockReq = new NextRequest('http://localhost:3000/api/auth/me');
    await expect(requireAuth(mockReq)).rejects.toThrow(AuthError);
    await expect(requireAuth(mockReq)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      statusCode: 401,
    });
  });

  it('should resolve verified session and user when valid Supabase session exists', async () => {
    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: {
                id: 'user-abc',
                email: 'owner@example.com',
                created_at: '2026-11-26T10:00:00.000Z',
                user_metadata: { full_name: 'Account Owner' },
              },
            },
            error: null,
          }),
        },
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'user-abc',
                  email: 'owner@example.com',
                  name: 'Account Owner',
                  role: 'USER',
                  created_at: '2026-11-26T10:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        })),
      } as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    const mockReq = new NextRequest('http://localhost:3000/api/auth/me');
    const result = await requireAuth(mockReq);
    expect(result.user.id).toBe('user-abc');
    expect(result.user.email).toBe('owner@example.com');
    expect(result.user.name).toBe('Account Owner');
  });

  it('should permit access when requesting user owns the analysis_jobs row', async () => {
    const mockJob = {
      id: 'job-100',
      user_id: 'user-1',
      target_url: 'https://example.com',
      status: 'COMPLETED',
      page_evidence: [],
      blueprint_artifacts: [],
    };

    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: {
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
              }),
            }),
          }),
        })),
      } as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    const mockReq = new NextRequest('http://localhost:3000/api/jobs/job-100');
    const job = await requireJobOwnership('job-100', 'user-1', mockReq);
    expect(job.id).toBe('job-100');
    expect(job.user_id).toBe('user-1');
  });

  it('should throw NotFoundError (404) when User B attempts to access User A job', async () => {
    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: {
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        })),
      } as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    const mockReq = new NextRequest('http://localhost:3000/api/jobs/job-100');
    await expect(requireJobOwnership('job-100', 'user-2', mockReq)).rejects.toThrow(NotFoundError);
    await expect(requireJobOwnership('job-100', 'user-2', mockReq)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
    });
  });

  it('should return 404 rather than 403 to prevent resource enumeration attacks', async () => {
    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: {
        from: vi.fn(() => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        })),
      } as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    const mockReq = new NextRequest('http://localhost:3000/api/jobs/job-foreign');
    try {
      await requireJobOwnership('job-foreign', 'attacker-user', mockReq);
      expect.fail('Should have thrown NotFoundError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect(err.statusCode).toBe(404);
      expect(err.message).toBe('Analysis job not found');
    }
  });
});
