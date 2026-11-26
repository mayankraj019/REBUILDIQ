'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';
import { getSupabaseConfig } from './config';

/**
 * Browser-side Supabase client using public project URL + publishable key.
 * All data access is strictly scoped by Postgres Row-Level Security.
 */
export function createSupabaseBrowserClient() {
  const { url, publishableKey } = getSupabaseConfig();
  return createBrowserClient<Database>(url, publishableKey);
}
