import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSupabaseConfig, hasSupabaseConfig } from '../lib/supabase/config';
import {
  ARTIFACTS_BUCKET,
  SupabaseStorageService,
  buildUserArtifactKey,
} from '../lib/supabase/storage';

describe('Supabase Configuration & Storage Service', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = origKey;
  });

  it('should read Supabase URL and publishable key when configured', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_demo';

    expect(hasSupabaseConfig()).toBe(true);
    expect(getSupabaseConfig()).toEqual({
      url: 'https://demo.supabase.co',
      publishableKey: 'sb_publishable_demo',
    });
  });

  it('should throw descriptive error when Supabase env configuration is missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(hasSupabaseConfig()).toBe(false);
    expect(() => getSupabaseConfig()).toThrow('Missing Supabase configuration');
  });

  it('should build RLS-compliant per-user folder artifact keys', () => {
    const key = buildUserArtifactKey(
      'user-123',
      'job-456',
      'desktop screenshot (1280).png'
    );
    expect(key).toBe('user-123/job-456/desktop_screenshot__1280_.png');
    expect(key.startsWith('user-123/')).toBe(true);
  });

  it('should upload, sign URL, and delete objects inside rebuildiq-artifacts bucket', async () => {
    const uploadMock = vi.fn().mockResolvedValue({
      data: { path: 'user-1/job-2/desktop.png' },
      error: null,
    });
    const signedUrlMock = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://demo.supabase.co/storage/v1/object/sign/...' },
      error: null,
    });
    const removeMock = vi.fn().mockResolvedValue({ data: [], error: null });

    const mockClient = {
      storage: {
        from: vi.fn((bucket: string) => {
          expect(bucket).toBe(ARTIFACTS_BUCKET);
          return {
            upload: uploadMock,
            createSignedUrl: signedUrlMock,
            remove: removeMock,
          };
        }),
      },
    } as any;

    const storage = new SupabaseStorageService(mockClient);
    const key = buildUserArtifactKey('user-1', 'job-2', 'desktop.png');

    const path = await storage.upload(key, Buffer.from('png'), 'image/png');
    expect(path).toBe('user-1/job-2/desktop.png');
    expect(uploadMock).toHaveBeenCalledWith(key, expect.any(Buffer), {
      contentType: 'image/png',
      upsert: true,
    });

    const signed = await storage.getDownloadUrl(key, 900);
    expect(signed).toContain('https://');
    expect(signedUrlMock).toHaveBeenCalledWith(key, 900);

    await storage.delete(key);
    expect(removeMock).toHaveBeenCalledWith([key]);
  });
});
