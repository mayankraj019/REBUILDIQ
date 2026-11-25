import { describe, it, expect } from 'vitest';
import { ServerEnvSchema, ClientEnvSchema, getClientConfig } from '../lib/config/env';

describe('Environment Configuration & Secrets Separation', () => {
  it('should validate complete valid server environment', () => {
    const validEnv = {
      NODE_ENV: 'test',
      PORT: '3000',
      APP_URL: 'http://localhost:3000',
      DATABASE_URL: 'file:./test.db',
      SESSION_SECRET: 'a-very-long-and-secure-session-secret-key-32-chars',
      AI_PROVIDER: 'mock',
      STORAGE_DRIVER: 'local',
    };

    const parsed = ServerEnvSchema.safeParse(validEnv);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.NODE_ENV).toBe('test');
      expect(parsed.data.PORT).toBe(3000);
      expect(parsed.data.SESSION_SECRET).toBe('a-very-long-and-secure-session-secret-key-32-chars');
    }
  });

  it('should reject server environment when SESSION_SECRET is too short (< 32 chars)', () => {
    const invalidEnv = {
      DATABASE_URL: 'file:./test.db',
      SESSION_SECRET: 'too-short-secret',
    };

    const parsed = ServerEnvSchema.safeParse(invalidEnv);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      expect(errors.SESSION_SECRET).toBeDefined();
    }
  });

  it('should reject server environment when DATABASE_URL is missing', () => {
    const invalidEnv = {
      SESSION_SECRET: 'a-very-long-and-secure-session-secret-key-32-chars',
    };

    const parsed = ServerEnvSchema.safeParse(invalidEnv);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors;
      expect(errors.DATABASE_URL).toBeDefined();
    }
  });

  it('should provide safe client configuration without server secrets', () => {
    const clientConfig = getClientConfig();

    expect(clientConfig).toBeDefined();
    expect(clientConfig.brandName).toBe('RebuildIQ');
    expect(clientConfig.brandPalette.navy).toBe('#14213D');
    expect(clientConfig.brandPalette.cream).toBe('#F4EDE0');
    expect(clientConfig.brandPalette.coral).toBe('#FF6B5B');

    // Guarantee that no secrets exist on client config
    expect((clientConfig as any).SESSION_SECRET).toBeUndefined();
    expect((clientConfig as any).DATABASE_URL).toBeUndefined();
    expect((clientConfig as any).GEMINI_API_KEY).toBeUndefined();
  });
});
