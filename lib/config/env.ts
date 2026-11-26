import { z } from 'zod';

/**
 * Server-Side Environment Variables Schema (Includes secrets)
 * These must NEVER be exposed to the client bundle.
 */
export const ServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Persistence
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Authentication Secrets
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters long for security'),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().default(604800), // 7 days

  // AI Provider
  AI_PROVIDER: z.enum(['gemini', 'mock']).default('mock'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.5-flash'),

  // Storage & Supabase (Public URL + Publishable Key + Strictly Server-Only Secret Key)
  STORAGE_DRIVER: z.enum(['local', 's3', 'supabase']).default('supabase'),
  LOCAL_STORAGE_PATH: z.string().default('./storage'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
  SUPABASE_SECRET_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  ACCOUNT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  // Crawler / Worker Guardrails
  MAX_CONCURRENT_BROWSER_JOBS: z.coerce.number().default(2),
  BROWSER_PAGE_TIMEOUT_MS: z.coerce.number().default(30000),
  BROWSER_JOB_TIMEOUT_MS: z.coerce.number().default(180000),
  MAX_CRAWL_DEPTH: z.coerce.number().min(1).max(5).default(1),
  MAX_PAGES_PER_JOB: z.coerce.number().min(1).max(10).default(5),
  ENABLE_SSRF_FIREWALL: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
});

/**
 * Client-Safe Configuration Schema (No secrets allowed)
 * Safely exposed to browser environments.
 */
export const ClientEnvSchema = z.object({
  brandName: z.string().default('RebuildIQ'),
  brandPalette: z.object({
    navy: z.string().default('#14213D'),
    cream: z.string().default('#F4EDE0'),
    coral: z.string().default('#FF6B5B'),
  }),
  appUrl: z.string().default('http://localhost:3000'),
  isProduction: z.boolean().default(false),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;
export type ClientEnv = z.infer<typeof ClientEnvSchema>;

let cachedServerEnv: ServerEnv | null = null;

/**
 * Parses and validates server-only environment variables.
 * Fails fast with descriptive error if configuration is invalid.
 */
export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const result = ServerEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errorDetails = result.error.flatten().fieldErrors;
    console.error('Invalid server environment variables:', errorDetails);
    throw new Error(
      `Invalid server environment configuration:\n${JSON.stringify(errorDetails, null, 2)}`
    );
  }

  cachedServerEnv = result.data;
  return cachedServerEnv;
}

/**
 * Returns safe, non-sensitive client configuration.
 */
export function getClientConfig(): ClientEnv {
  return {
    brandName: 'RebuildIQ',
    brandPalette: {
      navy: '#14213D',
      cream: '#F4EDE0',
      coral: '#FF6B5B',
    },
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    isProduction: process.env.NODE_ENV === 'production',
  };
}
