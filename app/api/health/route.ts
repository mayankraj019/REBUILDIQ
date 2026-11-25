import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerEnv } from '@/lib/config/env';
import { logger } from '@/lib/logger';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'ok';
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    // Execute a lightweight query to verify database connectivity
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (error) {
    dbStatus = 'error';
    logger.error('Health check database probe failed', error);
  }

  const isHealthy = dbStatus === 'ok';
  const memoryUsage = process.memoryUsage();

  const healthPayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    subsystems: {
      api: { status: 'ok', responseTimeMs: Date.now() - startTime },
      database: { status: dbStatus, latencyMs: dbLatencyMs },
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
