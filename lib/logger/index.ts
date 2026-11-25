/**
 * RebuildIQ Structured Logger with Sensitive Data Redaction
 * Emits JSON-formatted structured logs for production observability.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /key/i,
  /api[_-]?key/i,
  /credential/i,
];

/**
 * Recursively redacts sensitive fields from objects before logging.
 */
export function redactSensitiveData(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact common token formats (Bearer tokens, API keys)
    if (/^bearer\s+/i.test(obj)) {
      return 'Bearer [REDACTED]';
    }
    if (/^(AIza[0-9A-Za-z-_]{35}|sk-[a-zA-Z0-9]{32,})/i.test(obj)) {
      return '[REDACTED_API_KEY]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => redactSensitiveData(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value, depth + 1);
      }
    }
    return redacted;
  }

  return obj;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private context: string;

  constructor(context = 'App') {
    this.context = context;
  }

  forContext(context: string): Logger {
    return new Logger(context);
  }

  private log(level: LogLevel, message: string, data?: unknown, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      message,
    };

    if (data !== undefined) {
      entry.data = redactSensitiveData(data);
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }

    const json = JSON.stringify(entry);

    switch (level) {
      case 'error':
        console.error(json);
        break;
      case 'warn':
        console.warn(json);
        break;
      case 'debug':
        if (process.env.NODE_ENV !== 'production') {
          console.debug(json);
        }
        break;
      case 'info':
      default:
        console.log(json);
        break;
    }
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown, error?: Error): void {
    this.log('warn', message, data, error);
  }

  error(message: string, error?: unknown, data?: unknown): void {
    const err = error instanceof Error ? error : error ? new Error(String(error)) : undefined;
    this.log('error', message, data, err);
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }
}

export const logger = new Logger('RebuildIQ');
