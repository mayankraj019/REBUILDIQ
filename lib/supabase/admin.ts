import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Strictly server-only Supabase admin helper.
 * Uses `SUPABASE_SECRET_KEY` (sb_secret_...) or legacy `SUPABASE_SERVICE_ROLE_KEY`.
 * NEVER prefixed with `NEXT_PUBLIC_` and explicitly throws if imported in a browser context.
 */
export function hasSupabaseAdminConfig(): boolean {
  if (typeof window !== 'undefined') {
    return false;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  return Boolean(url && secretKey);
}

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'SECURITY VIOLATION: Privileged Supabase admin client cannot be instantiated in a browser context.'
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !secretKey) {
    throw new Error(
      'Missing privileged Supabase server credentials: set SUPABASE_SECRET_KEY on the server.'
    );
  }

  return createClient<Database>(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
