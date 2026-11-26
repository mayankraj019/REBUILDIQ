import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { LoginInputSchema } from '@/lib/auth/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthLogin');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = LoginInputSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid login credentials provided',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { email, password } = parsed.data;
    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user || !data.session) {
      const msg = (error?.message || '').toLowerCase();
      if (msg.includes('email not confirmed')) {
        return apiError(
          'EMAIL_NOT_CONFIRMED',
          'Please verify your email address via the confirmation link sent to your inbox before signing in.',
          401
        );
      }
      return apiError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    // Fetch synced public.users row (RLS scoped to authenticated uid)
    const { data: profile } = await supabase
      .from('users')
      .select('id, email, name, role, created_at')
      .eq('id', data.user.id)
      .maybeSingle();

    const fallbackName =
      (typeof data.user.user_metadata?.full_name === 'string' &&
        data.user.user_metadata.full_name.trim()) ||
      email.split('@')[0];

    // Record login event & device details in Supabase public.user_sessions
    const ipAddress = request.headers.get('x-forwarded-for') ?? null;
    const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;
    const expiresAt = data.session.expires_at
      ? new Date(data.session.expires_at * 1000).toISOString()
      : null;

    await supabase.from('user_sessions').insert({
      user_id: data.user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      auth_method: 'password',
      expires_at: expiresAt,
    });

    const response = apiSuccess({
      user: {
        id: profile?.id || data.user.id,
        email: profile?.email || data.user.email || email,
        name: profile?.name || fallbackName,
        role: profile?.role || 'USER',
        createdAt: profile?.created_at || data.user.created_at,
      },
    });

    return applyAuthResponseHeaders(response);
  } catch (error) {
    log.error('Login error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred during login',
      500
    );
  }
}
