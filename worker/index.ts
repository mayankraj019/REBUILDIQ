/**
 * RebuildIQ Decoupled Browser & AI Worker
 * 
 * Runs as a standalone background process or container independently from the Next.js web application.
 * Shares domain models, Prisma persistence, and logging from lib/ without code duplication.
 */

import { prisma } from '../lib/db/prisma';
import { logger } from '../lib/logger';
import { getServerEnv } from '../lib/config/env';

const log = logger.forContext('Worker');

export interface WorkerStatus {
  isRunning: boolean;
  activeJobs: number;
  pid: number;
  concurrency: number;
}

let isShuttingDown = false;
let activeJobCount = 0;

export async function startWorker(): Promise<void> {
  const env = getServerEnv();

  log.info('Initializing RebuildIQ Browser & AI Worker...', {
    nodeEnv: env.NODE_ENV,
    concurrency: env.MAX_CONCURRENT_BROWSER_JOBS,
    ssrfFirewallEnabled: env.ENABLE_SSRF_FIREWALL,
    aiProvider: env.AI_PROVIDER,
  });

  // Verify database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    log.info('Worker database connection established successfully.');
  } catch (error) {
    log.error('Worker failed to connect to database', error);
    process.exit(1);
  }

  log.info('Worker ready and listening for analysis jobs.', {
    pid: process.pid,
    concurrencyLimit: env.MAX_CONCURRENT_BROWSER_JOBS,
  });

  // Keep worker process alive
  const heartbeat = setInterval(() => {
    if (!isShuttingDown) {
      log.debug('Worker heartbeat', {
        activeJobs: activeJobCount,
        memoryUsageMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      });
    }
  }, 60000);

  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    log.info(`Received ${signal}. Shutting down worker gracefully...`);
    clearInterval(heartbeat);

    // Wait for in-flight jobs to conclude (up to 10 seconds)
    const deadline = Date.now() + 10000;
    while (activeJobCount > 0 && Date.now() < deadline) {
      log.info(`Waiting for ${activeJobCount} active jobs to complete...`);
      await new Promise((r) => setTimeout(r, 1000));
    }

    await prisma.$disconnect();
    log.info('Worker disconnected from database. Exiting cleanly.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Allow direct CLI execution: node --loader ts-node/esm worker/index.ts
if (process.argv[1]?.endsWith('worker/index.ts') || process.argv[1]?.endsWith('worker/index.js')) {
  startWorker().catch((err) => {
    log.error('Fatal unhandled error in worker runner', err);
    process.exit(1);
  });
}
