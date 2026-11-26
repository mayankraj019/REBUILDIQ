import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

/**
 * Verifies a user's current password against Supabase Auth without modifying
 * or disturbing the caller's SSR cookies (`persistSession: false`).
 */
export async function verifyCurrentPasswordStateless(
  email: string,
  password: string
): Promise<boolean> {
  const { url, publishableKey } = getSupabaseConfig();
  const ephemeralClient = createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await ephemeralClient.auth.signInWithPassword({
    email,
    password,
  });

  return Boolean(!error && data.user);
}
