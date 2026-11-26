import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { requireAuth, requireJobOwnership, AuthError, NotFoundError } from '../lib/auth/middleware';
import { GET as jobsListHandler, POST as jobsCreateHandler } from '../app/api/jobs/route';
import { GET as jobDetailHandler, DELETE as jobDeleteHandler } from '../app/api/jobs/[id]/route';
import {
  GET as blueprintGetHandler,
  PATCH as blueprintPatchHandler,
} from '../app/api/jobs/[id]/blueprint/route';
import { GET as exportGetHandler } from '../app/api/jobs/[id]/export/route';
import { updateSupabaseSession } from '../lib/supabase/middleware';
import * as routeClientModule from '../lib/supabase/route';
import { resetRateLimitStore } from '../lib/security/rate-limit';
import { signSessionAuditToken } from '../lib/auth/session-audit';
import { SESSION_AUDIT_COOKIE_NAME } from '../lib/auth/errors';

const JOB_UUID_1 = '11111111-1111-4111-8111-111111111111';
const USER_A_UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B_UUID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('Server-Side Authorization, Multi-Tenant Isolation & Route Guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimitStore();
  });

  it('should throw AuthError (401) when Supabase session is missing, expired, or revoked', async () => {
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

    // Expired cookies trigger SESSION_EXPIRED
    const expiredReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: { cookie: 'sb-project-auth-token=expired-jwt' },
    });
    await expect(requireAuth(expiredReq)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      statusCode: 401,
    });
  });

  it('should reject revoked session cookies immediately even before JWT expiration', async () => {
    const auditCookie = signSessionAuditToken('sess-row-revoked', USER_A_UUID);

    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: {
              user: { id: USER_A_UUID, email: 'owner@example.com', created_at: '2026-11-26T10:00:00.000Z' },
            },
            error: null,
          }),
          getClaims: vi.fn().mockResolvedValue({
            data: { claims: { sub: USER_A_UUID, exp: Math.floor(Date.now() / 1000) + 3600 } },
            error: null,
          }),
        },
        from: vi.fn((table: string) => {
          if (table === 'user_sessions') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'sess-row-revoked', revoked_at: '2026-11-26T12:00:00.000Z', expires_at: null },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: USER_A_UUID, email: 'owner@example.com', name: 'Owner', role: 'USER', deleted_at: null },
                  error: null,
                }),
              }),
            }),
          };
        }),
      } as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    const req = new NextRequest('http://localhost:3000/api/jobs', {
      headers: { cookie: `${SESSION_AUDIT_COOKIE_NAME}=${auditCookie}` },
    });

    await expect(requireAuth(req)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      statusCode: 401,
    });
  });

  it('should permit access when requesting user owns analysis job and return 404 (not 403) for cross-tenant requests', async () => {
    const mockJob = {
      id: JOB_UUID_1,
      user_id: USER_A_UUID,
      target_url: 'https://example.com',
      normalized_domain: 'example.com',
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

    const mockReq = new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}`);
    const job = await requireJobOwnership(JOB_UUID_1, USER_A_UUID, mockReq);
    expect(job.id).toBe(JOB_UUID_1);

    // User B query yields null under RLS + user_id scope -> throws 404 NOT_FOUND
    vi.restoreAllMocks();
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

    await expect(requireJobOwnership(JOB_UUID_1, USER_B_UUID, mockReq)).rejects.toThrow(NotFoundError);
    await expect(requireJobOwnership(JOB_UUID_1, USER_B_UUID, mockReq)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'Analysis job not found',
    });
  });

  it('should block cross-tenant access and client-supplied ownership spoofing on /api/jobs, blueprints, and exports', async () => {
    // Attacker (User B) tries to read, modify, or delete User A's analysis/blueprint/export
    let blueprintUpdated = false;

    const mockUserBClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: USER_B_UUID, email: 'attacker@example.com', created_at: '2026-11-26T10:00:00.000Z' },
          },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: USER_B_UUID, email: 'attacker@example.com', name: 'Attacker', role: 'USER', deleted_at: null },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'blueprint_artifacts') {
          return {
            update: vi.fn(() => {
              blueprintUpdated = true;
              return {};
            }),
          };
        }

        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }),
    };

    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: mockUserBClient as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    // 1. Cross-tenant query param spoof on GET /api/jobs?userId=<USER_A>
    const listSpoof = await jobsListHandler(
      new NextRequest(`http://localhost:3000/api/jobs?userId=${USER_A_UUID}`)
    );
    expect(listSpoof.status).toBe(403);

    // 2. Ownership spoof in POST /api/jobs body
    const createSpoof = await jobsCreateHandler(
      new NextRequest('http://localhost:3000/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: 'https://example.com', userId: USER_A_UUID }),
      })
    );
    expect(createSpoof.status).toBe(403);

    // 3. User B GET / DELETE foreign job -> 404
    const foreignDetail = await jobDetailHandler(
      new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}`),
      { params: Promise.resolve({ id: JOB_UUID_1 }) }
    );
    expect(foreignDetail.status).toBe(404);

    const foreignDelete = await jobDeleteHandler(
      new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: JOB_UUID_1 }) }
    );
    expect(foreignDelete.status).toBe(404);

    // 4. User B GET / PATCH foreign blueprint -> 404 (never modifies DB)
    const foreignBpGet = await blueprintGetHandler(
      new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}/blueprint`),
      { params: Promise.resolve({ id: JOB_UUID_1 }) }
    );
    expect(foreignBpGet.status).toBe(404);

    const foreignBpPatch = await blueprintPatchHandler(
      new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}/blueprint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ antigravityPrompts: '# hijacked prompt' }),
      }),
      { params: Promise.resolve({ id: JOB_UUID_1 }) }
    );
    expect(foreignBpPatch.status).toBe(404);
    expect(blueprintUpdated).toBe(false);

    // 5. User B GET foreign export -> 404
    const foreignExport = await exportGetHandler(
      new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}/export?format=prompts-md`),
      { params: Promise.resolve({ id: JOB_UUID_1 }) }
    );
    expect(foreignExport.status).toBe(404);
  });

  it('should allow owner to export owned prompts/blueprint & update prompts while blocking unauthenticated middleware requests', async () => {
    const ownedJob = {
      id: JOB_UUID_1,
      user_id: USER_A_UUID,
      target_url: 'https://example.com',
      normalized_domain: 'example.com',
      status: 'COMPLETED',
      page_evidence: [],
      blueprint_artifacts: [
        {
          id: 'bp-uuid-1',
          job_id: JOB_UUID_1,
          antigravity_prompts: '# Phase 1\nBuild clean UI',
          component_architecture: [{ name: 'Hero', observedSource: 'section', purpose: 'Landing hero' }],
          recommended_stack: [{ layer: 'UI', choice: 'Next.js', rationale: 'SSR' }],
          design_system_spec: { colors: [{ name: 'navy', hex: '#14213D' }] },
        },
      ],
    };

    const mockOwnerClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: { id: USER_A_UUID, email: 'owner@example.com', created_at: '2026-11-26T10:00:00.000Z' },
          },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'users') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: USER_A_UUID, email: 'owner@example.com', name: 'Owner', role: 'USER', deleted_at: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'blueprint_artifacts') {
          return {
            update: vi.fn(() => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: 'bp-uuid-1', is_edited_by_user: true, antigravity_prompts: '# Updated prompt' },
                      error: null,
                    }),
                  }),
                }),
              }),
            })),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: ownedJob, error: null }),
              }),
            }),
          }),
        };
      }),
    };

    vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
      supabase: mockOwnerClient as any,
      applyAuthResponseHeaders: vi.fn((r) => r),
    });

    const patchRes = await blueprintPatchHandler(
      new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}/blueprint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ antigravityPrompts: '# Updated prompt' }),
      }),
      { params: Promise.resolve({ id: JOB_UUID_1 }) }
    );
    expect(patchRes.status).toBe(200);
    expect((await patchRes.json()).data.blueprint.is_edited_by_user).toBe(true);

    const exportRes = await exportGetHandler(
      new NextRequest(`http://localhost:3000/api/jobs/${JOB_UUID_1}/export?format=prompts-md`),
      { params: Promise.resolve({ id: JOB_UUID_1 }) }
    );
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get('content-disposition')).toContain('example.com-antigravity-prompts.md');
    expect(await exportRes.text()).toContain('# Phase 1');

    // Verify middleware protects pages via login redirect & protects APIs via JSON 401
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';

    const pageRes = await updateSupabaseSession(new NextRequest('http://localhost:3000/dashboard'));
    expect(pageRes.status).toBe(307);
    expect(pageRes.headers.get('location')).toContain('/login?next=%2Fdashboard');

    const apiRes = await updateSupabaseSession(new NextRequest('http://localhost:3000/api/jobs'));
    expect(apiRes.status).toBe(401);
    expect((await apiRes.json()).error.code).toBe('UNAUTHORIZED');
  });
});
