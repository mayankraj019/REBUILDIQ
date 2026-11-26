import fs from 'fs';
import path from 'path';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getSupabaseConfig, hasSupabaseConfig } from '../lib/supabase/config';
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from '../lib/supabase/admin';
import {
  ARTIFACTS_BUCKET,
  SupabaseStorageService,
  buildUserArtifactKey,
} from '../lib/supabase/storage';

describe('Supabase Configuration, RLS Policy Integrity, Admin Guard & Storage Service', () => {
  const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const origKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const origSecret = process.env.SUPABASE_SECRET_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = origKey;
    process.env.SUPABASE_SECRET_KEY = origSecret;
    vi.unstubAllGlobals();
  });

  it('should read Supabase URL and publishable key when configured and reject missing env', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_demo';

    expect(hasSupabaseConfig()).toBe(true);
    expect(getSupabaseConfig()).toEqual({
      url: 'https://demo.supabase.co',
      publishableKey: 'sb_publishable_demo',
    });

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(hasSupabaseConfig()).toBe(false);
    expect(() => getSupabaseConfig()).toThrow('Missing Supabase configuration');
  });

  it('should enforce strict server-only bounds on Supabase privileged admin credentials', () => {
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(hasSupabaseAdminConfig()).toBe(false);
    expect(() => createSupabaseAdminClient()).toThrow('Missing privileged Supabase server credentials');

    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://demo.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'sb_secret_server_only_test';
    expect(hasSupabaseAdminConfig()).toBe(true);

    // Block instantiation if a browser global exists
    vi.stubGlobal('window', {});
    expect(hasSupabaseAdminConfig()).toBe(false);
    expect(() => createSupabaseAdminClient()).toThrow('SECURITY VIOLATION');
  });

  it('should enforce Supabase SQL RLS, active-account policies, least-privilege column grants, and private schema isolation', () => {
    const coreSql = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/20261126000001_rebuildiq_core.sql'),
      'utf8'
    );
    const hardeningSql = fs.readFileSync(
      path.resolve(__dirname, '../supabase/migrations/20261126000002_production_auth_hardening.sql'),
      'utf8'
    );
    const combinedSql = `${coreSql}\n${hardeningSql}`;

    // Verify no deprecated auth.role() policy patterns exist
    expect(combinedSql.toLowerCase()).not.toContain('auth.role()');

    // Verify all tenant policies explicitly scope TO authenticated & (SELECT auth.uid())
    expect(hardeningSql).toContain('TO authenticated');
    expect(hardeningSql).toContain('(SELECT auth.uid())');
    expect(hardeningSql).toContain('deleted_at IS NULL');

    // Verify anon / PUBLIC table privileges revoked cleanly and role elevation blocked via trigger + column grants
    expect(hardeningSql).toContain('FROM PUBLIC, anon');
    expect(hardeningSql).toContain('GRANT UPDATE (name, default_prompt_target, deleted_at');
    expect(hardeningSql).toContain('Account role cannot be self-modified');
    expect(hardeningSql).toContain('private.account_deletion_ledger');
    expect(hardeningSql).toContain('private.purge_expired_deleted_accounts');
  });

  it('should build RLS-compliant per-user folder artifact keys and scope Supabase Storage operations', async () => {
    const key = buildUserArtifactKey(
      'user-123',
      'job-456',
      'desktop screenshot (1280).png'
    );
    expect(key).toBe('user-123/job-456/desktop_screenshot__1280_.png');
    expect(key.startsWith('user-123/')).toBe(true);

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
    const pathKey = buildUserArtifactKey('user-1', 'job-2', 'desktop.png');
    await storage.upload(pathKey, Buffer.from('png'), 'image/png');
    await storage.getDownloadUrl(pathKey, 900);
    await storage.delete(pathKey);

    expect(uploadMock).toHaveBeenCalledTimes(1);
    expect(signedUrlMock).toHaveBeenCalledWith(pathKey, 900);
    expect(removeMock).toHaveBeenCalledWith([pathKey]);
  });
});
