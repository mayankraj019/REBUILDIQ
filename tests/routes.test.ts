import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as registerHandler } from '../app/api/auth/register/route';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { GET as meHandler } from '../app/api/auth/me/route';
import { POST as logoutHandler } from '../app/api/auth/logout/route';
import { prisma } from '../lib/db/prisma';
import { SESSION_COOKIE_NAME } from '../lib/auth/cookies';

describe('Authentication Route Handlers (API Endpoints)', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'route-test' } },
    });
  });

  it('should successfully register a new user and set HTTP-only cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'newuser.route-test@rebuildiq.dev',
        name: 'New Route Tester',
        password: 'ValidP@ssword123',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe('newuser.route-test@rebuildiq.dev');
    expect(data.data.user.name).toBe('New Route Tester');
    expect(data.data.user.passwordHash).toBeUndefined(); // Never expose password hash

    // Verify cookie was set
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
    expect(setCookie?.toLowerCase()).toContain('httponly');
    expect(setCookie?.toLowerCase()).toContain('samesite=lax');
  });

  it('should reject registration when email already exists', async () => {
    const payload = {
      email: 'duplicate.route-test@rebuildiq.dev',
      name: 'Initial User',
      password: 'ValidP@ssword123',
    };

    // First registration
    const req1 = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const res1 = await registerHandler(req1);
    expect(res1.status).toBe(201);

    // Second registration with same email
    const req2 = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, name: 'Different Name' }),
    });
    const res2 = await registerHandler(req2);
    expect(res2.status).toBe(409);

    const data = await res2.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('ACCOUNT_EXISTS');
  });

  it('should reject registration with invalid password complexity', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalidpwd.route-test@rebuildiq.dev',
        name: 'Invalid Pwd',
        password: 'weak',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_FAILED');
  });

  it('should successfully log in and issue session cookie', async () => {
    // 1. Register user
    const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login.route-test@rebuildiq.dev',
        name: 'Login User',
        password: 'CorrectP@ssword123',
      }),
    });
    await registerHandler(regReq);

    // 2. Log in
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'login.route-test@rebuildiq.dev',
        password: 'CorrectP@ssword123',
      }),
    });

    const res = await loginHandler(loginReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe('login.route-test@rebuildiq.dev');

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain(SESSION_COOKIE_NAME);
  });

  it('should reject login with wrong password', async () => {
    // 1. Register user
    const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrongpwd.route-test@rebuildiq.dev',
        name: 'Wrong Pwd User',
        password: 'CorrectP@ssword123',
      }),
    });
    await registerHandler(regReq);

    // 2. Attempt login with wrong password
    const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrongpwd.route-test@rebuildiq.dev',
        password: 'IncorrectPassword!999',
      }),
    });

    const res = await loginHandler(loginReq);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should return 401 on /api/auth/me when unauthenticated', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/me');
    const res = await meHandler(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 200 on /api/auth/me when authenticated with session cookie', async () => {
    // Register user to obtain valid cookie
    const regReq = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'me.route-test@rebuildiq.dev',
        name: 'Me User',
        password: 'CorrectP@ssword123',
      }),
    });
    const regRes = await registerHandler(regReq);
    const setCookie = regRes.headers.get('set-cookie');
    expect(setCookie).toBeDefined();

    // Extract cookie value
    const match = setCookie?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    const token = match?.[1];
    expect(token).toBeDefined();

    // Make authenticated request
    const meReq = new NextRequest('http://localhost:3000/api/auth/me', {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${token}`,
      },
    });

    const meRes = await meHandler(meReq);
    expect(meRes.status).toBe(200);

    const meData = await meRes.json();
    expect(meData.success).toBe(true);
    expect(meData.data.user.email).toBe('me.route-test@rebuildiq.dev');
  });

  it('should return 200 on /api/auth/logout and clear session cookie', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/logout', {
      method: 'POST',
    });

    const res = await logoutHandler(req);
    expect(res.status).toBe(200);

    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeDefined();
    expect(setCookie?.toLowerCase()).toContain('max-age=0');
  });
});
