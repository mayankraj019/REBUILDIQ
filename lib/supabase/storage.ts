import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export const ARTIFACTS_BUCKET = 'rebuildiq-artifacts';

export interface StorageService {
  upload(key: string, buffer: Buffer | Uint8Array, contentType: string): Promise<string>;
  getDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;
  delete(key: string): Promise<void>;
}

/**
 * Generates deterministic per-user object keys compliant with Supabase Storage RLS:
 * `<userId>/<jobId>/<filename>`
 */
export function buildUserArtifactKey(
  userId: string,
  jobId: string,
  filename: string
): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${userId}/${jobId}/${safeName}`;
}

/**
 * Supabase Storage implementation using the private `rebuildiq-artifacts` bucket.
 * Enforces user folder RLS (`(storage.foldername(name))[1] = auth.uid()`) and serves
 * short-lived signed URLs (default 15 minutes).
 */
export class SupabaseStorageService implements StorageService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async upload(
    key: string,
    buffer: Buffer | Uint8Array,
    contentType: string
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(ARTIFACTS_BUCKET)
      .upload(key, buffer, {
        contentType,
        upsert: true,
      });

    if (error || !data) {
      throw new Error(`Supabase Storage upload failed: ${error?.message || 'unknown error'}`);
    }

    return data.path;
  }

  async getDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(ARTIFACTS_BUCKET)
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new Error(
        `Supabase Storage signed URL generation failed: ${error?.message || 'unknown error'}`
      );
    }

    return data.signedUrl;
  }

  async delete(key: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(ARTIFACTS_BUCKET)
      .remove([key]);

    if (error) {
      throw new Error(`Supabase Storage delete failed: ${error.message}`);
    }
  }
}
