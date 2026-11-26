import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { apiSuccess } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthLogout');

export async function POST(request: NextRequest) {
  const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await supabase
        .from('user_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .is('revoked_at', null);
    }

    await supabase.auth.signOut();

    const response = apiSuccess({ message: 'Signed out successfully' });
    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Logout error', error);
    const response = apiSuccess({ message: 'Signed out successfully' });
    return applyAuthResponseHeaders(response);
  }
}
