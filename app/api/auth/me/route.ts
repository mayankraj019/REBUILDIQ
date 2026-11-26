import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import type { Database } from '@/lib/supabase/database.types';
import {
  AuthError,
  buildAuthOrNotFoundResponse,
  requireAuth,
} from '@/lib/auth/middleware';
import {
  UpdateProfileInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('AuthMe');

export async function GET(request: NextRequest) {
  try {
    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const auth = await requireAuth(request);

    const response = apiSuccess({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        name: auth.user.name,
        role: auth.user.role,
        emailVerified: auth.user.emailVerified,
        defaultPromptTarget: auth.user.defaultPromptTarget,
        createdAt: auth.user.createdAt,
      },
      session: {
        id: auth.session.id,
        expiresAt: auth.session.expiresAt.toISOString(),
      },
    });

    // Touch supabase client response headers cleanly when refreshed cookies exist
    void supabase;
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Get user error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while retrieving user profile',
      500
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const body = await request.json().catch(() => null);

    const spoofedFields = findForbiddenClientOwnershipFields(body);
    if (
      spoofedFields.length > 0 ||
      (body && typeof body === 'object' && ('id' in body || 'email' in body))
    ) {
      return apiError(
        'FORBIDDEN',
        'Account ID, email, and authorization role cannot be modified through profile updates',
        403
      );
    }

    const parsed = UpdateProfileInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid profile update payload',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const { name, defaultPromptTarget } = parsed.data;

    const updatePayload: Database['public']['Tables']['users']['Update'] = {};
    if (name !== undefined) {
      updatePayload.name = name;
    }
    if (defaultPromptTarget !== undefined) {
      updatePayload.default_prompt_target = defaultPromptTarget;
    }

    // Update public.users strictly scoped to authenticated uid under Postgres RLS
    const { error: dbErr } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', auth.user.id);

    if (dbErr) {
      const msg = (dbErr.message || '').toLowerCase();
      if ((dbErr.code === '42703' || dbErr.code === 'PGRST204' || msg.includes('column')) && name !== undefined) {
        const { error: fallbackErr } = await supabase
          .from('users')
          .update({ name })
          .eq('id', auth.user.id);
        if (fallbackErr) {
          log.warn('Fallback profile update failed', { code: fallbackErr.code });
          return apiError('PROFILE_UPDATE_FAILED', 'Unable to update profile record', 400);
        }
      } else if (!(dbErr.code === '42703' || dbErr.code === 'PGRST204' || msg.includes('column'))) {
        log.warn('Profile DB update rejected', { code: dbErr.code });
        return apiError('PROFILE_UPDATE_FAILED', 'Unable to update profile record', 400);
      }
    }

    // Sync non-privilege display attributes on Supabase Auth user metadata
    const metadataUpdate: Record<string, string> = {};
    if (name !== undefined) metadataUpdate.full_name = name;
    if (defaultPromptTarget !== undefined) {
      metadataUpdate.default_prompt_target = defaultPromptTarget;
    }
    if (Object.keys(metadataUpdate).length > 0 && typeof supabase.auth.updateUser === 'function') {
      await supabase.auth.updateUser({ data: metadataUpdate });
    }

    const response = apiSuccess({
      user: {
        id: auth.user.id,
        email: auth.user.email,
        name: name ?? auth.user.name,
        role: auth.user.role,
        emailVerified: auth.user.emailVerified,
        defaultPromptTarget: defaultPromptTarget ?? auth.user.defaultPromptTarget,
        createdAt: auth.user.createdAt,
      },
    });

    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Update profile error', error);
    return apiError(
      'INTERNAL_SERVER_ERROR',
      'An unexpected error occurred while updating user profile',
      500
    );
  }
}
