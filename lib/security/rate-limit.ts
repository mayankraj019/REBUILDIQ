import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export interface RateLimitPolicy {
  name: string;
  limit: number;
  windowMs: number;
}

export const RATE_LIMIT_POLICIES = {
  AUTH_LOGIN_IP: { name: 'auth:login:ip', limit: 10, windowMs: 15 * 60 * 1000 },
  AUTH_LOGIN_ACCOUNT: { name: 'auth:login:acct', limit: 5, windowMs: 15 * 60 * 1000 },
  AUTH_REGISTER: { name: 'auth:register:ip', limit: 5, windowMs: 60 * 60 * 1000 },
  AUTH_RECOVERY_IP: { name: 'auth:recovery:ip', limit: 5, windowMs: 15 * 60 * 1000 },
  AUTH_RECOVERY_EMAIL: { name: 'auth:recovery:email', limit: 3, windowMs: 15 * 60 * 1000 },
  AUTH_RESEND_IP: { name: 'auth:resend:ip', limit: 5, windowMs: 15 * 60 * 1000 },
  AUTH_RESEND_EMAIL: { name: 'auth:resend:email', limit: 3, windowMs: 15 * 60 * 1000 },
  AUTH_PASSWORD_UPDATE: { name: 'auth:pwd:update', limit: 5, windowMs: 15 * 60 * 1000 },
  AUTH_ACCOUNT_DELETE: { name: 'auth:acct:delete', limit: 3, windowMs: 60 * 60 * 1000 },
  JOBS_WRITE: { name: 'jobs:write', limit: 20, windowMs: 15 * 60 * 1000 },
} as const;

export interface RateLimitDecision {
  allowed: boolean;
  policy: string;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  headers: Record<string, string>;
}

const MAX_BUCKET_ENTRIES = 10_000;
const slidingWindowBuckets = new Map<string, number[]>();

function getHmacSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error(
      '[rate-limit] SESSION_SECRET environment variable is required in production. ' +
        'Set a random string of at least 32 characters.'
    );
  }
  // Dev/test fallback — ephemeral and non-sensitive
  return secret ?? 'rebuildiq-rate-limit-dev-ephemeral-key';
}

/**
 * Produces a non-reversible keyed digest so raw IPs and emails are never kept in bucket keys.
 */
export function hashRateLimitIdentifier(scope: string, identifier: string): string {
  return crypto
    .createHmac('sha256', getHmacSecret())
    .update(`${scope}:${identifier.trim().toLowerCase()}`)
    .digest('hex');
}

/**
 * Extracts best-effort client IP from standard proxy headers without trusting spoofed commas.
 */
export function extractClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  return 'unknown-ip';
}

function pruneBucketStore(now: number) {
  if (slidingWindowBuckets.size < MAX_BUCKET_ENTRIES) {
    return;
  }

  for (const [key, timestamps] of slidingWindowBuckets.entries()) {
    if (timestamps.length === 0 || timestamps[timestamps.length - 1] < now - 3600_000) {
      slidingWindowBuckets.delete(key);
    }
    if (slidingWindowBuckets.size < MAX_BUCKET_ENTRIES * 0.75) {
      break;
    }
  }
}

/**
 * Evaluates a sliding-window rate limit check in constant memory bounds.
 */
export function checkRateLimit(
  policy: RateLimitPolicy,
  identifier: string,
  nowMs = Date.now()
): RateLimitDecision {
  pruneBucketStore(nowMs);

  const key = hashRateLimitIdentifier(policy.name, identifier);
  const windowStart = nowMs - policy.windowMs;

  const existing = slidingWindowBuckets.get(key) ?? [];
  const activeTimestamps = existing.filter((ts) => ts > windowStart);

  if (activeTimestamps.length >= policy.limit) {
    const oldestInWindow = activeTimestamps[0] ?? nowMs;
    const resetAt = oldestInWindow + policy.windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - nowMs) / 1000));

    slidingWindowBuckets.set(key, activeTimestamps);

    return {
      allowed: false,
      policy: policy.name,
      limit: policy.limit,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(policy.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    };
  }

  activeTimestamps.push(nowMs);
  slidingWindowBuckets.set(key, activeTimestamps);

  const oldestInWindow = activeTimestamps[0] ?? nowMs;
  const resetAt = oldestInWindow + policy.windowMs;
  const remaining = Math.max(0, policy.limit - activeTimestamps.length);

  return {
    allowed: true,
    policy: policy.name,
    limit: policy.limit,
    remaining,
    resetAt,
    retryAfterSeconds: 0,
    headers: {
      'X-RateLimit-Limit': String(policy.limit),
      'X-RateLimit-Remaining': String(remaining),
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
    },
  };
}

/**
 * Runs one or more rate limit checks and returns the first blocked decision if exceeded.
 */
export function evaluateRateLimits(
  checks: Array<{ policy: RateLimitPolicy; identifier: string }>,
  nowMs = Date.now()
): RateLimitDecision {
  let strictestAllowed: RateLimitDecision | null = null;

  for (const { policy, identifier } of checks) {
    const result = checkRateLimit(policy, identifier, nowMs);
    if (!result.allowed) {
      return result;
    }
    if (!strictestAllowed || result.remaining < strictestAllowed.remaining) {
      strictestAllowed = result;
    }
  }

  return (
    strictestAllowed ?? {
      allowed: true,
      policy: 'default',
      limit: 100,
      remaining: 99,
      resetAt: nowMs + 60_000,
      retryAfterSeconds: 0,
      headers: {},
    }
  );
}

/**
 * Builds a uniform HTTP 429 JSON response with Retry-After and anti-cache headers.
 */
export function rateLimitExceededResponse(decision: RateLimitDecision): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please wait ${decision.retryAfterSeconds} seconds before trying again.`,
        details: {
          retryAfterSeconds: decision.retryAfterSeconds,
        },
      },
    },
    {
      status: 429,
      headers: {
        ...decision.headers,
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}

export function attachRateLimitHeaders(
  response: NextResponse,
  decision: RateLimitDecision
): NextResponse {
  for (const [k, v] of Object.entries(decision.headers)) {
    response.headers.set(k, v);
  }
  return response;
}

export function resetRateLimitStore(): void {
  slidingWindowBuckets.clear();
}
