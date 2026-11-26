import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { getSupabaseConfig } from './config';

/**
 * Creates a fresh per-request Supabase Server Client for React Server Components
 * and Server Actions using Next.js cookies().
 */
export async function createSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot mutate response headers directly;
          // Next.js middleware handles token refresh and response cookie persistence.
        }
      },
    },
  });
}
