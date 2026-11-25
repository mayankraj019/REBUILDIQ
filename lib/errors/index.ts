/**
 * Centralized Application Error Hierarchy for RebuildIQ
 */

export class AppError extends Error {
  code: string;
  statusCode: number;
  details?: unknown;
  isOperational: boolean;

  constructor(
    message: string,
    code = 'INTERNAL_ERROR',
    statusCode = 500,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request parameters', details?: unknown) {
    super(message, 'VALIDATION_FAILED', 400, details);
  }
}

export class AuthError extends AppError {
  constructor(message = 'Authentication required to access this resource') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Access to this resource is forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict detected', code = 'CONFLICT') {
    super(message, code, 409);
  }
}

export class SSRFError extends AppError {
  constructor(message = 'Target destination blocked by SSRF firewall policy') {
    super(message, 'SSRF_VIOLATION', 400);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded. Please try again later.') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 'SERVICE_UNAVAILABLE', 503);
  }
}
