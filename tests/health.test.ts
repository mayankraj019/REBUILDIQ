import { describe, it, expect } from 'vitest';
import { GET as healthHandler } from '../app/api/health/route';

describe('Health Check API Endpoint (/api/health)', () => {
  it('should return 200 with healthy subsystem statuses', async () => {
    const res = await healthHandler();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
    expect(data.subsystems.api.status).toBe('ok');
    expect(data.subsystems.database.status).toBe('ok');
    expect(data.system.nodeVersion).toBeDefined();
    expect(data.system.memory.heapUsedMb).toBeGreaterThan(0);
  });
});
