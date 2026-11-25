import { describe, it, expect } from 'vitest';
import { redactSensitiveData } from '../lib/logger';

describe('Structured Logger & Sensitive Data Redaction', () => {
  it('should redact sensitive password, secret, and token fields', () => {
    const payload = {
      userId: 'user-123',
      password: 'PlaintextPassword123!',
      sessionToken: 'opaque-token-abc',
      apiKey: 'secret-key-value',
      nested: {
        authorization: 'Bearer secret-jwt-token',
        userCookie: 'cookie-session-id',
        publicNote: 'Visible note',
      },
    };

    const redacted = redactSensitiveData(payload) as any;

    expect(redacted.userId).toBe('user-123');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.sessionToken).toBe('[REDACTED]');
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.nested.authorization).toBe('[REDACTED]');
    expect(redacted.nested.userCookie).toBe('[REDACTED]');
    expect(redacted.nested.publicNote).toBe('Visible note');
  });

  it('should redact standalone Bearer token strings', () => {
    const authString = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const redacted = redactSensitiveData(authString);
    expect(redacted).toBe('Bearer [REDACTED]');
  });

  it('should preserve benign metadata and arrays', () => {
    const benignPayload = {
      targetUrl: 'https://example.com',
      viewport: 'desktop',
      width: 1280,
      tags: ['h1', 'section', 'footer'],
    };

    const redacted = redactSensitiveData(benignPayload) as any;
    expect(redacted).toEqual(benignPayload);
  });
});
