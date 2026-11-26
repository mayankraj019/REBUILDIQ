import { NextResponse } from 'next/server';
import { getSupabaseConfig, hasSupabaseConfig } from '@/lib/supabase/config';
import { logger } from '@/lib/logger';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;

  if (!hasSupabaseConfig()) {
    dbStatus = 'error';
  } else if (process.env.NODE_ENV !== 'test') {
    const dbStart = Date.now();
    try {
      const { url, publishableKey } = getSupabaseConfig();
      const res = await fetch(`${url}/auth/v1/health`, {
        headers: { apikey: publishableKey },
        signal: AbortSignal.timeout(4000),
        cache: 'no-store',
      });
      dbLatencyMs = Date.now() - dbStart;
      if (!res.ok) {
        dbStatus = 'error';
      }
    } catch (error) {
      dbStatus = 'error';
      dbLatencyMs = Date.now() - dbStart;
      logger.error('Health check Supabase probe failed', error);
    }
  }

  const isHealthy = dbStatus === 'ok';
  const memoryUsage = process.memoryUsage();

  const healthPayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    subsystems: {
      api: { status: 'ok', responseTimeMs: Date.now() - startTime },
      database: {
        status: dbStatus,
        provider: 'supabase',
        latencyMs: dbLatencyMs,
      },
    },
    system: {
      memory: {
        rssMb: Math.round(memoryUsage.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
      },
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    },
  };

  return NextResponse.json(healthPayload, {
    status: isHealthy ? 200 : 503,
  });
}
