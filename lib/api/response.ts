import { NextResponse } from 'next/server';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function apiSuccess<T>(data: T, status = 200, meta?: Record<string, unknown>) {
  return NextResponse.json({ success: true, data, meta }, { status });
}

export function apiError(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
    },
    { status }
  );
}

/**
 * Centralized API Error Handler:
 * Maps domain errors (AppError, ValidationError, AuthError) to standardized JSON responses.
 * Logs unexpected server exceptions with sensitive data redaction.
 */
export function handleApiError(error: unknown, context = 'API') {
  const log = logger.forContext(context);

  if (error instanceof AppError) {
    if (error.statusCode >= 500) {
      log.error(`Operational server error: ${error.message}`, error);
    } else {
      log.warn(`Operational client error: ${error.message}`, {
        code: error.code,
        details: error.details,
      });
    }

    return apiError(error.code, error.message, error.statusCode, error.details);
  }

  // Unhandled internal exception
  log.error('Unhandled internal server error', error);
  return apiError(
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred while processing the request',
    500
  );
}
