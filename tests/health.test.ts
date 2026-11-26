import { describe, it, expect, vi, afterEach } from 'vitest';
import { GET as healthHandler } from '../app/api/health/route';

describe('Health Check API Endpoint (/api/health)', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = origKey;
    vi.restoreAllMocks();
  });

  it('should return 200 with healthy subsystem statuses when configured', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test_key';

    const res = await healthHandler();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.subsystems.api.status).toBe('ok');
    expect(data.subsystems.database.status).toBe('ok');
    expect(data.subsystems.database.provider).toBe('supabase');
    expect(data.system.nodeVersion).toBeDefined();
    expect(data.system.memory.heapUsedMb).toBeGreaterThan(0);
  });

  it('should return 503 degraded when Supabase environment configuration is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const res = await healthHandler();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.status).toBe('degraded');
    expect(data.subsystems.database.status).toBe('error');
  });
});
