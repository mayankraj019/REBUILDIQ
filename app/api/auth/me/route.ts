import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthMe');

export async function GET(request: NextRequest) {
  try {
    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

    const {
      data: { user: authUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !authUser) {
      return apiError('UNAUTHORIZED', 'Authentication required', 401);
    }

    const { data: profile } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', authUser.id)
      .maybeSingle();

    const fallbackName =
      (typeof authUser.user_metadata?.full_name === 'string' &&
        authUser.user_metadata.full_name.trim()) ||
      (authUser.email ? authUser.email.split('@')[0] : 'User');

    const response = apiSuccess({
      user: {
        id: profile?.id || authUser.id,
        email: profile?.email || authUser.email || '',
        name: profile?.name || fallbackName,
        role: profile?.role || 'USER',
        createdAt: profile?.created_at || authUser.created_at,
      },
    });

    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Get user error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while retrieving user profile',
      500
    );
  }
}
