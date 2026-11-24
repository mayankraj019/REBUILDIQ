import crypto from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { hashToken } from './password';

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface CreateSessionOptions {
  ipAddress?: string | null;
  userAgent?: string | null;
  maxAgeSeconds?: number;
}

export interface SessionValidationResult {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
  };
}

/**
 * Creates an opaque session token, hashes it, and persists the session in the database.
 * Returns the plaintext opaque token to be sent as an HTTP-only cookie.
 */
export async function createSession(
  userId: string,
  options: CreateSessionOptions = {}
): Promise<{ rawToken: string; expiresAt: Date }> {
  // Generate 256 bits of cryptographically secure random entropy
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);

  const maxAge = options.maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS;
  const expiresAt = new Date(Date.now() + maxAge * 1000);

  await prisma.session.create({
    data: {
      sessionToken: tokenHash,
      userId,
      expiresAt,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ? options.userAgent.slice(0, 500) : null,
    },
  });

  return { rawToken, expiresAt };
}

/**
 * Validates an opaque raw session token.
 * Hashes the token, looks up the session and user, and checks for expiration.
 */
export async function validateSession(
  rawToken: string
): Promise<SessionValidationResult | null> {
  if (!rawToken || typeof rawToken !== 'string') {
    return null;
  }

  const tokenHash = hashToken(rawToken);

  const session = await prisma.session.findUnique({
    where: { sessionToken: tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Check if session has expired
  if (session.expiresAt.getTime() < Date.now()) {
    // Asynchronously delete expired session
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    },
    user: session.user,
  };
}

/**
 * Revokes a session by deleting it using the raw token.
 */
export async function revokeSession(rawToken: string): Promise<boolean> {
  if (!rawToken || typeof rawToken !== 'string') {
    return false;
  }

  const tokenHash = hashToken(rawToken);

  try {
    await prisma.session.delete({
      where: { sessionToken: tokenHash },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Revokes all sessions for a user (e.g., on password reset or account compromise).
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { userId },
  });
  return result.count;
}
