import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { ARTIFACTS_BUCKET } from '@/lib/supabase/storage';
import {
  AuthError,
  NotFoundError,
  buildAuthOrNotFoundResponse,
  requireAuth,
  requireJobOwnership,
} from '@/lib/auth/middleware';
import {
  RATE_LIMIT_POLICIES,
  attachRateLimitHeaders,
  evaluateRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('JobDetailApi');

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;

    // Ownership enforced strictly by verified session user ID + Postgres RLS
    const job = await requireJobOwnership(id, auth.user.id, request);
    const { applyAuthResponseHeaders } = createSupabaseRouteClient(request);

    const response = apiSuccess({ job });
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError || error instanceof NotFoundError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Fetch analysis job error', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to retrieve analysis job', 500);
  }
}

export async function DELETE(
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

    const { id } = await context.params;
    await requireJobOwnership(id, auth.user.id, request);

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);

    // Purge owned objects from private user folder in Supabase Storage (`<userId>/<jobId>/...`)
    if (supabase.storage) {
      try {
        const bucket = supabase.storage.from(ARTIFACTS_BUCKET);
        if (bucket && typeof bucket.list === 'function') {
          const { data: files } = await bucket.list(`${auth.user.id}/${id}`, { limit: 100 });
          if (files && files.length > 0) {
            await bucket.remove(files.map((f: any) => `${auth.user.id}/${id}/${f.name}`));
          }
        }
      } catch (storageErr) {
        log.warn('Storage artifact cleanup warning during job delete', {
          reason: storageErr instanceof Error ? storageErr.message : String(storageErr),
        });
      }
    }

    const { error } = await supabase
      .from('analysis_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.user.id);

    if (error) {
      log.warn('Delete job rejected', { code: error.code });
      return apiError('DELETE_FAILED', 'Unable to delete analysis job', 400);
    }

    const response = apiSuccess({ deleted: true, id });
    attachRateLimitHeaders(response, rateCheck);
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError || error instanceof NotFoundError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Delete analysis job error', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to delete analysis job', 500);
  }
}
