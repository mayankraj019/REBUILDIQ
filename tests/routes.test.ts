import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { GET as meHandler, PATCH as mePatchHandler } from '../app/api/auth/me/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import { POST as forgotPasswordHandler } from '../app/api/auth/forgot-password/route';
import { POST as resendHandler } from '../app/api/auth/resend-confirmation/route';
import { POST as updatePasswordHandler } from '../app/api/auth/update-password/route';
import { GET as sessionsListHandler } from '../app/api/auth/sessions/route';
import { POST as sessionsRevokeHandler } from '../app/api/auth/sessions/revoke/route';
import { DELETE as accountDeleteHandler } from '../app/api/auth/account/route';
import * as routeClientModule from '../lib/supabase/route';
import * as verifyPasswordModule from '../lib/supabase/verify-password';
import * as adminModule from '../lib/supabase/admin';
import { resetRateLimitStore } from '../lib/security/rate-limit';
import { signSessionAuditToken } from '../lib/auth/session-audit';
import { SESSION_AUDIT_COOKIE_NAME } from '../lib/auth/errors';

function createMockRouteClient(overrides: {
  signUpResult?: any;
  signInResult?: any;
  getUserResult?: any;
  getClaimsResult?: any;
  profileRow?: any;
  sessionsRows?: any[];
  signOutResult?: any;
  updateUserResult?: any;
  resetPasswordResult?: any;
  resendResult?: any;
  revokedRowsResult?: any[];
} = {}) {
  const insertedSessions: any[] = [];
  let updatedRevokeFilter: string | null = null;
  let updatedProfilePayload: any = null;
  let deletedJobsCalled = false;

  const mockSupabase = {
    auth: {
      signUp: vi.fn().mockResolvedValue(
        overrides.signUpResult ?? {
          data: {
            user: {
              id: 'user-uuid-1',
              email: 'newuser@rebuildiq.dev',
              created_at: '2026-11-26T15:00:00.000Z',
              email_confirmed_at: '2026-11-26T15:00:00.000Z',
              identities: [{ id: 'ident-1' }],
              user_metadata: { full_name: 'New Tester' },
            },
            session: {
              access_token: 'mock-jwt',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        }
      ),
      signInWithPassword: vi.fn().mockResolvedValue(
        overrides.signInResult ?? {
          data: {
            user: {
              id: 'user-uuid-1',
              email: 'login@rebuildiq.dev',
              created_at: '2026-11-26T15:00:00.000Z',
              email_confirmed_at: '2026-11-26T15:00:00.000Z',
              user_metadata: { full_name: 'Login User' },
            },
            session: {
              access_token: 'mock-jwt',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        }
      ),
      getUser: vi.fn().mockResolvedValue(
        overrides.getUserResult ?? {
          data: { user: null },
          error: { message: 'Auth session missing!' },
        }
      ),
      getClaims: vi.fn().mockResolvedValue(
        overrides.getClaimsResult ?? {
          data: {
            claims: {
              sub: 'user-uuid-1',
              session_id: 'auth-sess-uuid-1',
              exp: Math.floor(Date.now() / 1000) + 3600,
            },
          },
          error: null,
        }
      ),
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-jwt',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          },
        },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue(
        overrides.signOutResult ?? { error: null }
      ),
      updateUser: vi.fn().mockResolvedValue(
        overrides.updateUserResult ?? { data: { user: { id: 'user-uuid-1' } }, error: null }
      ),
      resetPasswordForEmail: vi.fn().mockResolvedValue(
        overrides.resetPasswordResult ?? { data: {}, error: null }
      ),
      resend: vi.fn().mockResolvedValue(
        overrides.resendResult ?? { data: {}, error: null }
      ),
    },
    storage: {
      from: vi.fn(() => ({
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        const defaultRow =
          overrides.profileRow === undefined
            ? {
                id: 'user-uuid-1',
                email: 'login@rebuildiq.dev',
                name: 'Login User',
                role: 'USER',
                default_prompt_target: 'antigravity',
                deleted_at: null,
                created_at: '2026-11-26T15:00:00.000Z',
              }
            : overrides.profileRow;

        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: defaultRow,
                error: null,
              }),
            }),
          }),
          update: vi.fn((payload: any) => {
            updatedProfilePayload = payload;
            return {
              eq: vi.fn().mockResolvedValue({ error: null }),
            };
          }),
        };
      }

      if (table === 'user_sessions') {
        const defaultSessions = overrides.sessionsRows ?? [
          {
            id: '11111111-1111-4111-8111-111111111111',
            auth_session_id: 'auth-sess-uuid-1',
            ip_address: '127.0.0.1',
            user_agent: 'Chrome/130',
            auth_method: 'password',
            logged_in_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400_000).toISOString(),
            revoked_at: null,
          },
        ];

        return {
          select: () => {
            const chain: any = {
              eq: () => chain,
              is: () => chain,
              order: () => chain,
              limit: vi.fn().mockResolvedValue({ data: defaultSessions, error: null }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: defaultSessions[0] ?? null,
                error: null,
              }),
            };
            return chain;
          },
          insert: vi.fn((row: any) => {
            insertedSessions.push(row);
            return {
              select: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: '11111111-1111-4111-8111-111111111111' },
                  error: null,
                }),
              }),
            };
          }),
          update: vi.fn(() => {
            const updateChain: any = {
              eq: vi.fn(() => updateChain),
              neq: vi.fn(() => {
                updatedRevokeFilter = 'neq';
                return updateChain;
              }),
              is: vi.fn(() => {
                if (!updatedRevokeFilter) updatedRevokeFilter = 'all_or_eq';
                return Object.assign(Promise.resolve({ data: null, error: null }), {
                  select: vi.fn().mockResolvedValue({
                    data: overrides.revokedRowsResult ?? [{ id: '22222222-2222-4222-8222-222222222222' }],
                    error: null,
                  }),
                });
              }),
              select: vi.fn().mockResolvedValue({
                data: overrides.revokedRowsResult ?? [{ id: '22222222-2222-4222-8222-222222222222' }],
                error: null,
              }),
            };
            return updateChain;
          }),
        };
      }

      if (table === 'analysis_jobs') {
        return {
          delete: () => ({
            eq: () => ({
              select: vi.fn().mockImplementation(async () => {
                deletedJobsCalled = true;
                return { data: [{ id: 'job-1' }], error: null };
              }),
            }),
          }),
        };
      }

      return {};
    }),
  };

  const applyAuthResponseHeaders = vi.fn((res: NextResponse) => {
    res.headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate, max-age=0');
    return res;
  });

  vi.spyOn(routeClientModule, 'createSupabaseRouteClient').mockReturnValue({
    supabase: mockSupabase as any,
    applyAuthResponseHeaders,
  });

  return {
    mockSupabase,
    insertedSessions,
    getRevokeFilter: () => updatedRevokeFilter,
    getUpdatedProfile: () => updatedProfilePayload,
    wasJobsDeleted: () => deletedJobsCalled,
    applyAuthResponseHeaders,
  };
}

describe('Production Authentication API Routes (Supabase SSR)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimitStore();
  });

  it('should register a new user, reject ownership spoofing, and record session audit', async () => {
    const spoofReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.1' },
      body: JSON.stringify({
        email: 'attacker@rebuildiq.dev',
        name: 'Attacker',
        password: 'ValidP@ssword123',
        role: 'ADMIN',
      }),
    });
    const spoofRes = await registerHandler(spoofReq);
    expect(spoofRes.status).toBe(403);

    const { insertedSessions, applyAuthResponseHeaders } = createMockRouteClient();
    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.2',
        'user-agent': 'Vitest/2.1',
      },
      body: JSON.stringify({
        email: 'newuser@rebuildiq.dev',
        name: 'New Tester',
        password: 'ValidP@ssword123',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe('newuser@rebuildiq.dev');
    expect(data.data.requiresEmailConfirmation).toBe(false);
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessions[0].auth_method).toBe('register');
    expect(applyAuthResponseHeaders).toHaveBeenCalledTimes(1);
  });

  it('should support email verification confirmation pending mode when session is null', async () => {
    const { insertedSessions } = createMockRouteClient({
      signUpResult: {
        data: {
          user: {
            id: 'user-pending-verify',
            email: 'verify@rebuildiq.dev',
            created_at: '2026-11-26T15:00:00.000Z',
            identities: [{ id: 'ident-pending' }],
          },
          session: null,
        },
        error: null,
      },
    });

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.3' },
      body: JSON.stringify({
        email: 'verify@rebuildiq.dev',
        name: 'Verify User',
        password: 'ValidP@ssword123',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.requiresEmailConfirmation).toBe(true);
    expect(insertedSessions).toHaveLength(0);
  });

  it('should reject duplicate registration and invalid password complexity cleanly', async () => {
    createMockRouteClient({
      signUpResult: {
        data: {
          user: { id: 'existing', email: 'dup@rebuildiq.dev', identities: [] },
          session: null,
        },
        error: null,
      },
    });

    const dupReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.4' },
      body: JSON.stringify({
        email: 'dup@rebuildiq.dev',
        name: 'Dup User',
        password: 'ValidP@ssword123',
      }),
    });
    const dupRes = await registerHandler(dupReq);
    expect(dupRes.status).toBe(409);

    const weakReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.5' },
      body: JSON.stringify({
        email: 'weak@rebuildiq.dev',
        name: 'Weak User',
        password: 'weak',
      }),
    });
    const weakRes = await registerHandler(weakReq);
    expect(weakRes.status).toBe(400);
  });

  it('should log in verified account, block deleted accounts, and enforce rate limiting on brute force', async () => {
    const { insertedSessions } = createMockRouteClient();
    const okReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
      body: JSON.stringify({
        email: 'login@rebuildiq.dev',
        password: 'CorrectP@ssword123',
      }),
    });

    const okRes = await loginHandler(okReq);
    expect(okRes.status).toBe(200);
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessions[0].auth_session_id).toBe('auth-sess-uuid-1');

    // Soft-deleted account login attempt must be rejected and signed out
    vi.restoreAllMocks();
    const { mockSupabase } = createMockRouteClient({
      profileRow: {
        id: 'user-uuid-1',
        email: 'deleted@rebuildiq.dev',
        name: 'Deleted Account',
        role: 'USER',
        deleted_at: '2026-11-26T00:00:00.000Z',
        created_at: '2026-11-20T00:00:00.000Z',
      },
    });
    const delReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.11' },
      body: JSON.stringify({
        email: 'deleted@rebuildiq.dev',
        password: 'CorrectP@ssword123',
      }),
    });
    const delRes = await loginHandler(delReq);
    expect(delRes.status).toBe(403);
    expect((await delRes.json()).error.code).toBe('ACCOUNT_DELETED');
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });

    // Rate limiting on repeated invalid login attempts
    vi.restoreAllMocks();
    createMockRouteClient({
      signInResult: {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      },
    });

    for (let i = 0; i < 5; i++) {
      const attempt = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
        body: JSON.stringify({ email: 'victim@rebuildiq.dev', password: 'WrongPassword1!' }),
      });
      const r = await loginHandler(attempt);
      expect(r.status).toBe(401);
      expect((await r.json()).error.code).toBe('INVALID_CREDENTIALS');
    }

    const blockedAttempt = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({ email: 'victim@rebuildiq.dev', password: 'WrongPassword1!' }),
    });
    const blockedRes = await loginHandler(blockedAttempt);
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('retry-after')).toBeTruthy();
  });

  it('should handle unauthenticated vs expired-session responses consistently on /api/auth/me and allow profile updates', async () => {
    createMockRouteClient();
    const unauthReq = new NextRequest('http://localhost:3000/api/auth/me');
    const unauthRes = await meHandler(unauthReq);
    expect(unauthRes.status).toBe(401);
    expect((await unauthRes.json()).error.code).toBe('UNAUTHORIZED');

    // Request carrying stale Supabase cookie returns SESSION_EXPIRED + clears cookies
    const expiredReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: {
        cookie: 'sb-ubnwbkcbixtbaiutrfiv-auth-token=stale-expired-jwt',
      },
    });
    const expiredRes = await meHandler(expiredReq);
    expect(expiredRes.status).toBe(401);
    expect((await expiredRes.json()).error.code).toBe('SESSION_EXPIRED');
    expect(expiredRes.headers.get('set-cookie')).toContain('sb-ubnwbkcbixtbaiutrfiv-auth-token=');

    // Verified profile retrieval + safe profile mutation
    vi.restoreAllMocks();
    const { getUpdatedProfile } = createMockRouteClient({
      getUserResult: {
        data: {
          user: {
            id: 'user-uuid-1',
            email: 'login@rebuildiq.dev',
            email_confirmed_at: '2026-11-26T15:05:00.000Z',
            created_at: '2026-11-26T15:00:00.000Z',
            user_metadata: { full_name: 'Login User' },
          },
        },
        error: null,
      },
    });

    const patchForbidden = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacker', role: 'ADMIN' }),
    });
    const patchForbiddenRes = await mePatchHandler(patchForbidden);
    expect(patchForbiddenRes.status).toBe(403);

    const patchOk = new NextRequest('http://localhost:3000/api/auth/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Maya Lin', defaultPromptTarget: 'cursor' }),
    });
    const patchOkRes = await mePatchHandler(patchOk);
    expect(patchOkRes.status).toBe(200);
    expect(getUpdatedProfile()).toMatchObject({
      name: 'Maya Lin',
      default_prompt_target: 'cursor',
    });
  });

  it('should execute sign-out scopes (local vs global) and session revocation cleanly', async () => {
    const { mockSupabase, getRevokeFilter } = createMockRouteClient({
      getUserResult: {
        data: {
          user: { id: 'user-uuid-1', email: 'login@rebuildiq.dev' },
        },
        error: null,
      },
    });

    const auditCookie = signSessionAuditToken(
      '11111111-1111-4111-8111-111111111111',
      'user-uuid-1'
    );

    const localLogout = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_AUDIT_COOKIE_NAME}=${auditCookie}`,
      },
      body: JSON.stringify({ scope: 'local' }),
    });

    const res = await logoutHandler(localLogout);
    expect(res.status).toBe(200);
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(getRevokeFilter()).toBe('all_or_eq');

    // Listing active sessions and revoking another session
    const sessionsReq = new NextRequest('http://localhost:3000/api/auth/sessions', {
      headers: { cookie: `${SESSION_AUDIT_COOKIE_NAME}=${auditCookie}` },
    });
    const sessionsRes = await sessionsListHandler(sessionsReq);
    expect(sessionsRes.status).toBe(200);
    const listData = await sessionsRes.json();
    expect(listData.data.sessions).toHaveLength(1);
    expect(listData.data.sessions[0].isCurrent).toBe(true);

    // Reject revoking current session via revoke endpoint
    const selfRevoke = new NextRequest('http://localhost:3000/api/auth/sessions/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_AUDIT_COOKIE_NAME}=${auditCookie}`,
      },
      body: JSON.stringify({
        scope: 'single',
        sessionId: '11111111-1111-4111-8111-111111111111',
      }),
    });
    expect((await sessionsRevokeHandler(selfRevoke)).status).toBe(400);

    // Revoking a different session owned by user succeeds
    const otherRevoke = new NextRequest('http://localhost:3000/api/auth/sessions/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: `${SESSION_AUDIT_COOKIE_NAME}=${auditCookie}`,
      },
      body: JSON.stringify({
        scope: 'single',
        sessionId: '22222222-2222-4222-8222-222222222222',
      }),
    });
    expect((await sessionsRevokeHandler(otherRevoke)).status).toBe(200);
  });

  it('should support password recovery, confirmation resend, password update, and rate limiting without email enumeration', async () => {
    const { mockSupabase } = createMockRouteClient({
      getUserResult: {
        data: {
          user: {
            id: 'user-uuid-1',
            email: 'owner@rebuildiq.dev',
            created_at: '2026-11-26T10:00:00.000Z',
          },
        },
        error: null,
      },
    });

    // Recovery returns identical 200 success even for unknown emails (anti-enumeration)
    const forgotReq = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.80' },
      body: JSON.stringify({ email: 'unknown-user@rebuildiq.dev' }),
    });
    const forgotRes = await forgotPasswordHandler(forgotReq);
    expect(forgotRes.status).toBe(200);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'unknown-user@rebuildiq.dev',
      expect.objectContaining({
        redirectTo: expect.stringContaining('/auth/confirm?next=/update-password'),
      })
    );

    const resendReq = new NextRequest('http://localhost:3000/api/auth/resend-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.81' },
      body: JSON.stringify({ email: 'pending@rebuildiq.dev' }),
    });
    const resendRes = await resendHandler(resendReq);
    expect(resendRes.status).toBe(200);

    // Password change validates currentPassword first
    vi.spyOn(verifyPasswordModule, 'verifyCurrentPasswordStateless').mockResolvedValueOnce(false);
    const badPwdReq = new NextRequest('http://localhost:3000/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.82' },
      body: JSON.stringify({
        mode: 'change',
        currentPassword: 'WrongPassword!1',
        newPassword: 'NewStrong!Password9',
        confirmPassword: 'NewStrong!Password9',
      }),
    });
    expect((await updatePasswordHandler(badPwdReq)).status).toBe(401);

    vi.spyOn(verifyPasswordModule, 'verifyCurrentPasswordStateless').mockResolvedValueOnce(true);
    const okPwdReq = new NextRequest('http://localhost:3000/api/auth/update-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '203.0.113.82' },
      body: JSON.stringify({
        mode: 'change',
        currentPassword: 'OldStrong!Password1',
        newPassword: 'NewStrong!Password9',
        confirmPassword: 'NewStrong!Password9',
      }),
    });
    const okPwdRes = await updatePasswordHandler(okPwdReq);
    expect(okPwdRes.status).toBe(200);
    expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
      password: 'NewStrong!Password9',
    });
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
  });

  it('should require password verification and erase workspace data & identity cleanly on account deletion', async () => {
    const { mockSupabase, wasJobsDeleted } = createMockRouteClient({
      getUserResult: {
        data: {
          user: {
            id: 'user-uuid-1',
            email: 'owner@rebuildiq.dev',
            created_at: '2026-11-26T10:00:00.000Z',
          },
        },
        error: null,
      },
    });

    vi.spyOn(verifyPasswordModule, 'verifyCurrentPasswordStateless').mockResolvedValueOnce(true);
    const deleteUserMock = vi.fn().mockResolvedValue({ data: { user: null }, error: null });
    vi.spyOn(adminModule, 'hasSupabaseAdminConfig').mockReturnValue(true);
    vi.spyOn(adminModule, 'createSupabaseAdminClient').mockReturnValue({
      auth: { admin: { deleteUser: deleteUserMock } },
      storage: {
        from: vi.fn(() => ({
          list: vi.fn().mockResolvedValue({ data: [], error: null }),
          remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
      },
    } as any);

    const req = new NextRequest('http://localhost:3000/api/auth/account', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'sb-ubnwbkcbixtbaiutrfiv-auth-token=active-jwt',
      },
      body: JSON.stringify({
        confirmation: 'DELETE',
        currentPassword: 'ValidP@ssword123',
        reason: 'Automated test cleanup',
      }),
    });

    const res = await accountDeleteHandler(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.deleted).toBe(true);
    expect(data.data.authIdentityDeleted).toBe(true);
    expect(wasJobsDeleted()).toBe(true);
    expect(deleteUserMock).toHaveBeenCalledWith('user-uuid-1');
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(res.headers.get('set-cookie')).toContain('sb-ubnwbkcbixtbaiutrfiv-auth-token=');
  });
});
