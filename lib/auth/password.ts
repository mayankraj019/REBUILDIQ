import * as argon2 from '@node-rs/argon2';
import crypto from 'node:crypto';

// Standard OWASP-recommended parameters for Argon2id:
// Algorithm: 2 (Argon2id), Memory: 19456 KiB (19 MiB), Iterations: 2, OutputLen: 32, Parallelism: 1
const ARGON2ID_ALGORITHM = 2; // 0 = Argon2d, 1 = Argon2i, 2 = Argon2id

const ARGON2_OPTIONS = {
  algorithm: ARGON2ID_ALGORITHM,
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

/**
 * Hashes a plaintext password using Argon2id with cryptographically secure salt.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  return argon2.hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a plaintext password against an Argon2id hash.
 * Uses constant-time comparison internally to prevent timing attacks.
 */
export async function verifyPassword(hash: string, candidate: string): Promise<boolean> {
  if (!hash || !candidate) {
    return false;
  }
  try {
    return await argon2.verify(hash, candidate);
  } catch {
    return false;
  }
}

/**
 * Computes a SHA-256 hash of opaque tokens before database storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
