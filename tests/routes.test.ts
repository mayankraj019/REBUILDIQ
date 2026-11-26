import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { GET as meHandler } from '../app/api/auth/me/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import * as routeClientModule from '../lib/supabase/route';

function createMockRouteClient(overrides: {
  signUpResult?: any;
  signInResult?: any;
  getUserResult?: any;
  profileRow?: any;
  signOutResult?: any;
} = {}) {
  const insertedSessions: any[] = [];
  let updatedSessionRevoked = false;

  const mockSupabase = {
    auth: {
      signUp: vi.fn().mockResolvedValue(
        overrides.signUpResult ?? {
          data: {
            user: {
              id: 'user-uuid-1',
              email: 'newuser@rebuildiq.dev',
              created_at: '2026-11-26T15:00:00.000Z',
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
      signOut: vi.fn().mockResolvedValue(
        overrides.signOutResult ?? { error: null }
      ),
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: overrides.profileRow ?? {
                  id: 'user-uuid-1',
                  email: 'login@rebuildiq.dev',
                  name: 'Login User',
                  role: 'USER',
                  created_at: '2026-11-26T15:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        };
      }

      if (table === 'user_sessions') {
        return {
          insert: vi.fn((row: any) => {
            insertedSessions.push(row);
            return Promise.resolve({ data: row, error: null });
          }),
          update: vi.fn(() => ({
            eq: () => ({
              is: vi.fn().mockImplementation(() => {
                updatedSessionRevoked = true;
                return Promise.resolve({ data: null, error: null });
              }),
            }),
          })),
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
    getRevokedFlag: () => updatedSessionRevoked,
    applyAuthResponseHeaders,
  };
}

describe('Supabase Authentication Route Handlers (API Endpoints)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should successfully register a new user in Supabase and record session login audit', async () => {
    const { insertedSessions, applyAuthResponseHeaders } = createMockRouteClient();

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
    expect(res.headers.get('cache-control')).toContain('private');
  });

  it('should support Supabase email confirmation mode cleanly when session is null', async () => {
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
      headers: { 'Content-Type': 'application/json' },
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

  it('should reject duplicate registration (error or obfuscated empty identities) with 409', async () => {
    createMockRouteClient({
      signUpResult: {
        data: {
          user: { id: 'existing', email: 'dup@rebuildiq.dev', identities: [] },
          session: null,
        },
        error: null,
      },
    });

    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dup@rebuildiq.dev',
        name: 'Dup User',
        password: 'ValidP@ssword123',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('should reject registration with invalid password complexity', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'weak@rebuildiq.dev',
        name: 'Weak User',
        password: 'weak',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe('VALIDATION_FAILED');
  });

  it('should log in via Supabase Auth, record user_sessions row, and apply response headers', async () => {
    const { insertedSessions, applyAuthResponseHeaders } = createMockRouteClient();

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login@rebuildiq.dev',
        password: 'CorrectP@ssword123',
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe('login@rebuildiq.dev');
    expect(insertedSessions).toHaveLength(1);
    expect(insertedSessions[0].auth_method).toBe('password');
    expect(applyAuthResponseHeaders).toHaveBeenCalledTimes(1);
  });

  it('should reject login with wrong password with 401 INVALID_CREDENTIALS', async () => {
    createMockRouteClient({
      signInResult: {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      },
    });

    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login@rebuildiq.dev',
        password: 'WrongPassword!1',
      }),
    });

    const res = await loginHandler(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 on /api/auth/me when unauthenticated and 200 when verified', async () => {
    createMockRouteClient();
    const unauthReq = new NextRequest('http://localhost:3000/api/auth/me');
    const unauthRes = await meHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    vi.restoreAllMocks();
    createMockRouteClient({
      getUserResult: {
        data: {
          user: {
            id: 'user-uuid-1',
            email: 'login@rebuildiq.dev',
            created_at: '2026-11-26T15:00:00.000Z',
            user_metadata: { full_name: 'Login User' },
          },
        },
        error: null,
      },
    });

    const authReq = new NextRequest('http://localhost:3000/api/auth/me');
    const authRes = await meHandler(authReq);
    expect(authRes.status).toBe(200);
    const data = await authRes.json();
    expect(data.data.user.email).toBe('login@rebuildiq.dev');
  });

  it('should mark active user_sessions revoked and sign out on /api/auth/logout', async () => {
    const { getRevokedFlag, mockSupabase, applyAuthResponseHeaders } = createMockRouteClient({
      getUserResult: {
        data: { user: { id: 'user-uuid-1', email: 'login@rebuildiq.dev' } },
        error: null,
      },
    });

    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const res = await logoutHandler(req);
    expect(res.status).toBe(200);
    expect(getRevokedFlag()).toBe(true);
    expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(applyAuthResponseHeaders).toHaveBeenCalledTimes(1);
  });
});
