import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  checkRateLimit,
  extractClientIp,
  hashRateLimitIdentifier,
  rateLimitExceededResponse,
  resetRateLimitStore,
} from '../lib/security/rate-limit';
import { mapSupabaseAuthError } from '../lib/auth/errors';
import {
  signSessionAuditToken,
  verifySessionAuditToken,
} from '../lib/auth/session-audit';
import { findForbiddenClientOwnershipFields } from '../lib/auth/schemas';

describe('Rate Limiting, Auth Error Sanitization & Cryptographic Session Integrity', () => {
  beforeEach(() => {
    resetRateLimitStore();
  });

  it('should hash identifiers with HMAC so raw emails/IPs are never leaked in bucket keys', () => {
    const email = 'sensitive.user@company.com';
    const digest = hashRateLimitIdentifier('auth:login:acct', email);
    expect(digest).toHaveLength(64);
    expect(digest).not.toContain('sensitive.user');
    expect(digest).not.toContain('company.com');
  });

  it('should enforce sliding-window request limits and reset after window expiration', async () => {
    const policy = { name: 'test:window', limit: 3, windowMs: 60_000 };
    const startMs = 1_700_000_000_000;

    expect(checkRateLimit(policy, '192.0.2.10', startMs).allowed).toBe(true);
    expect(checkRateLimit(policy, '192.0.2.10', startMs + 1000).allowed).toBe(true);
    expect(checkRateLimit(policy, '192.0.2.10', startMs + 2000).allowed).toBe(true);

    const blocked = checkRateLimit(policy, '192.0.2.10', startMs + 3000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(57);

    const res429 = rateLimitExceededResponse(blocked);
    expect(res429.status).toBe(429);
    expect(res429.headers.get('retry-after')).toBeTruthy();
    const json = await res429.json();
    expect(json.error.code).toBe('RATE_LIMIT_EXCEEDED');

    // Separate IP stays unaffected
    expect(checkRateLimit(policy, '192.0.2.11', startMs + 3000).allowed).toBe(true);

    // Once window passes, quota reopens
    expect(checkRateLimit(policy, '192.0.2.10', startMs + 61_000).allowed).toBe(true);
  });

  it('should extract first forwarded IP hop cleanly', () => {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      headers: { 'x-forwarded-for': '203.0.113.19, 10.0.0.1' },
    });
    expect(extractClientIp(req)).toBe('203.0.113.19');
  });

  it('should sanitize upstream auth errors without leaking stack/provider internals or email existence', () => {
    const loginErr = mapSupabaseAuthError(
      { message: 'User not found in pg auth.users table', status: 400 },
      'login'
    );
    expect(loginErr.statusCode).toBe(401);
    expect(loginErr.code).toBe('INVALID_CREDENTIALS');
    expect(loginErr.message).toBe('Invalid email or password');

    const unconfirmedErr = mapSupabaseAuthError(
      { code: 'email_not_confirmed', message: 'Email not confirmed', status: 400 },
      'login'
    );
    expect(unconfirmedErr.code).toBe('EMAIL_NOT_CONFIRMED');

    const rateErr = mapSupabaseAuthError(
      { code: 'over_email_send_rate_limit', status: 429 },
      'recovery'
    );
    expect(rateErr.statusCode).toBe(429);
    expect(rateErr.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('should sign and verify HMAC session audit tokens and reject tampered or cross-user cookies', () => {
    const token = signSessionAuditToken('sess-uuid-123', 'user-1');
    expect(verifySessionAuditToken(token, 'user-1')).toEqual({
      sessionRowId: 'sess-uuid-123',
      userId: 'user-1',
    });

    // Cross-user cookie mismatch must reject
    expect(verifySessionAuditToken(token, 'user-2')).toBeNull();

    // Tampered signature must reject
    const tampered = `${token.slice(0, -4)}ffff`;
    expect(verifySessionAuditToken(tampered, 'user-1')).toBeNull();
  });

  it('should detect client-supplied privilege or ownership spoofing fields', () => {
    expect(findForbiddenClientOwnershipFields({ email: 'a@b.com', userId: 'victim' })).toEqual([
      'userId',
    ]);
    expect(findForbiddenClientOwnershipFields({ name: 'Maya', role: 'ADMIN' })).toEqual([
      'role',
    ]);
    expect(findForbiddenClientOwnershipFields({ email: 'a@b.com', name: 'Maya' })).toEqual([]);
  });
});
