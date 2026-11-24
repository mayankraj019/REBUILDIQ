import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashToken } from '../lib/auth/password';
import { RegisterInputSchema, LoginInputSchema } from '../lib/auth/schemas';

describe('Password Hashing & Token Cryptography (Argon2id)', () => {
  it('should successfully hash a plaintext password with Argon2id', async () => {
    const password = 'StrongPassword!123';
    const hash = await hashPassword(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('should verify matching candidate password against Argon2id hash', async () => {
    const password = 'CorrectPassword!999';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(hash, password);
    expect(isMatch).toBe(true);
  });

  it('should reject incorrect candidate password against Argon2id hash', async () => {
    const password = 'CorrectPassword!999';
    const hash = await hashPassword(password);

    const isMatch = await verifyPassword(hash, 'WrongPassword!000');
    expect(isMatch).toBe(false);
  });

  it('should generate distinct hashes for identical passwords due to unique salts', async () => {
    const password = 'IdenticalPassword!123';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(hash1, password)).toBe(true);
    expect(await verifyPassword(hash2, password)).toBe(true);
  });

  it('should reject empty or non-string passwords with error', async () => {
    await expect(hashPassword('')).rejects.toThrow('Password must be a non-empty string');
    expect(await verifyPassword('', 'candidate')).toBe(false);
    expect(await verifyPassword('somehash', '')).toBe(false);
  });

  it('should deterministically compute SHA-256 hash for opaque session tokens', () => {
    const token = 'deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
    const hash1 = hashToken(token);
    const hash2 = hashToken(token);

    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });
});

describe('Authentication Schema Validation (Zod)', () => {
  it('should validate compliant registration inputs', () => {
    const validData = {
      email: 'engineer@rebuildiq.dev',
      name: 'Software Architect',
      password: 'ComplexP@ssword123',
    };

    const result = RegisterInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('engineer@rebuildiq.dev');
      expect(result.data.name).toBe('Software Architect');
    }
  });

  it('should normalize and lowercase emails during registration', () => {
    const data = {
      email: '  USER.TEST@Example.COM  ',
      name: 'Test User',
      password: 'ValidP@ssword1!',
    };

    const result = RegisterInputSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user.test@example.com');
    }
  });

  it('should reject malformed email addresses', () => {
    const invalidEmails = ['not-an-email', 'missing@domain', '@nouser.com', 'user@.com'];

    for (const email of invalidEmails) {
      const result = RegisterInputSchema.safeParse({
        email,
        name: 'Valid Name',
        password: 'ValidP@ssword1!',
      });
      expect(result.success).toBe(false);
    }
  });

  it('should enforce strong password complexity rules', () => {
    const weakPasswords = [
      'short1!',           // Too short (< 8 chars)
      'alllowercase123!',  // No uppercase
      'ALLUPPERCASE123!',  // No lowercase
      'NoNumbersHere!!',   // No digits
      'NoSpecialChars123', // No special symbols
    ];

    for (const password of weakPasswords) {
      const result = RegisterInputSchema.safeParse({
        email: 'test@example.com',
        name: 'Valid Name',
        password,
      });
      expect(result.success).toBe(false);
    }
  });

  it('should validate login schema properly', () => {
    const validLogin = {
      email: 'USER@DOMAIN.COM',
      password: 'AnyPasswordProvided',
    };

    const result = LoginInputSchema.safeParse(validLogin);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('user@domain.com');
    }

    const emptyPassword = LoginInputSchema.safeParse({
      email: 'user@domain.com',
      password: '',
    });
    expect(emptyPassword.success).toBe(false);
  });
});
