import { NextRequest } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import {
  AuthError,
  buildAuthOrNotFoundResponse,
  requireAuth,
} from '@/lib/auth/middleware';
import {
  CreateJobInputSchema,
  findForbiddenClientOwnershipFields,
} from '@/lib/auth/schemas';
import { detectObviousPrivateHost } from '@/lib/analysis/types';
import { getUserAnalysisJobs } from '@/lib/analysis/loader';
import {
  RATE_LIMIT_POLICIES,
  attachRateLimitHeaders,
  evaluateRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
} from '@/lib/security/rate-limit';
import { apiSuccess, apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('JobsCollection');

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const requestedUserId =
      request.nextUrl.searchParams.get('userId') ||
      request.nextUrl.searchParams.get('user_id');
    if (requestedUserId && requestedUserId !== auth.user.id) {
      return apiError(
        'FORBIDDEN',
        'Cross-tenant query parameter is forbidden. Analyses are scoped to your authenticated account.',
        403
      );
    }

    const { supabase, applyAuthResponseHeaders } = createSupabaseRouteClient(request);
    const jobs = await getUserAnalysisJobs(auth.user.id, supabase);

    const response = apiSuccess({ jobs });
    return applyAuthResponseHeaders(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('List analysis jobs error', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to load analysis jobs', 500);
  }
}

export async function POST(request: NextRequest) {
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
    if (spoofed.length > 0) {
      return apiError(
        'FORBIDDEN',
        'Client-supplied ownership fields are not permitted',
        403
      );
    }

    const parsed = CreateJobInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        'VALIDATION_FAILED',
        'Invalid analysis submission parameters',
        400,
        parsed.error.flatten().fieldErrors
      );
    }

    const ssrfWarning = detectObviousPrivateHost(parsed.data.targetUrl);
    if (ssrfWarning) {
      return apiError('SSRF_VIOLATION', ssrfWarning, 400);
    }

    const res = apiError(
      'WORKER_NOT_CONNECTED',
      'Authentication and URL validation succeeded, but the Playwright crawler worker (Phases 3–4) is not yet enabled.',
      501
    );
    attachRateLimitHeaders(res, rateCheck);
    return res;
  } catch (error) {
    if (error instanceof AuthError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Create analysis job error', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to enqueue analysis job', 500);
  }
}
