import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import {
  AuthError,
  NotFoundError,
  buildAuthOrNotFoundResponse,
  requireAuth,
  requireBlueprintOwnership,
} from '@/lib/auth/middleware';
import {
  UpdateBlueprintInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import {
  RATE_LIMIT_POLICIES,
  attachRateLimitHeaders,
  evaluateRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('JobBlueprintApi');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;
    const { blueprint } = await requireBlueprintOwnership(id, auth.user.id, request);
    const { applyAuthResponseHeaders } = createSupabaseRouteClient(request);

    const response = apiSuccess({ blueprint });
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError || error instanceof NotFoundError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Get blueprint error', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to retrieve blueprint', 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);

    const clientIp = extractClientIp(request);
    const rateCheck = evaluateRateLimits([
      { policy: RATE_LIMIT_POLICIES.JOBS_WRITE, identifier: `${auth.user.id}:${clientIp}` },
    ]);
    if (!rateCheck.allowed) {
      return rateLimitExceededResponse(rateCheck);
    }

    const body = await request.json().catch(() => null);
    const spoofed = findForbiddenClientOwnershipFields(body);
    if (
      spoofed.length > 0 ||
      (body && typeof body === 'object' && ('jobId' in body || 'job_id' in body))
    ) {
      return apiError(
        'FORBIDDEN',
        'Client-supplied ownership or job reference fields are not permitted',
        403
      );
    }

    const parsed = UpdateBlueprintInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid blueprint update payload',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const { id } = await context.params;
    const { blueprint } = await requireBlueprintOwnership(id, auth.user.id, request);

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const { data: updated, error } = await supabase
      .from('blueprint_artifacts')
      .update({
        antigravity_prompts: parsed.data.antigravityPrompts,
        is_edited_by_user: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', blueprint.id)
      .eq('job_id', id)
      .select('*')
      .maybeSingle();

    if (error || !updated) {
      log.warn('Blueprint update failed', { code: error?.code });
      return apiError('BLUEPRINT_UPDATE_FAILED', 'Unable to update blueprint prompts', 400);
    }

    const response = apiSuccess({ blueprint: updated });
    attachRateLimitHeaders(response, rateCheck);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError || error instanceof NotFoundError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Patch blueprint error', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to update blueprint', 500);
  }
}
