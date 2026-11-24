import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { validateSession, SessionValidationResult } from './session';
import { getSessionToken } from './cookies';

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code = 'UNAUTHORIZED', statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class NotFoundError extends Error {
  code: string;
  statusCode: number;

  constructor(message = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
    this.code = 'NOT_FOUND';
    this.statusCode = 404;
  }
}

/**
 * Resolves the authenticated user from cookies or Authorization header.
 * Returns null if no valid session exists.
 */
export async function getAuthenticatedUser(
  request?: NextRequest | null
): Promise<SessionValidationResult | null> {
  const token = getSessionToken(request);
  if (!token) {
    return null;
  }

  return validateSession(token);
}

/**
 * Requires a verified authenticated user session.
 * Throws AuthError (401) if unauthenticated.
 */
export async function requireAuth(
  request?: NextRequest | null
): Promise<SessionValidationResult> {
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    throw new AuthError('Authentication required to access this resource');
  }
  return auth;
}

/**
 * Strict Multi-Tenant Authorization Guard:
 * Resolves an AnalysisJob by ID and verifies that the requesting user owns it.
 * If the job does not exist OR belongs to another user, returns NotFoundError (404)
 * to prevent leaking the existence of jobs across tenants.
 */
export async function requireJobOwnership(
  jobId: string,
  userId: string
) {
  if (!jobId || !userId) {
    throw new NotFoundError('Analysis job not found');
  }

  const job = await prisma.analysisJob.findFirst({
    where: {
      id: jobId,
      userId: userId, // Strict tenant scoping
    },
    include: {
      pageEvidence: {
        include: {
          screenshots: true,
        },
      },
      blueprintArtifacts: true,
    },
  });

  if (!job) {
    throw new NotFoundError('Analysis job not found');
  }

  return job;
}
