-- Migration: 20261126000002_production_auth_hardening.sql
-- Hardens Supabase PostgreSQL schema for production authentication & authorization:
-- 1. Account deletion / data-retention lifecycle columns & non-PII retention ledger
-- 2. Auth session correlation (`auth_session_id`) for immediate server-side revocation
-- 3. Strict least-privilege column grants & trigger guards blocking role/ID/email tampering
-- 4. Active-account RLS guards across tables and storage objects (blocks deleted accounts)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS default_prompt_target text NOT NULL DEFAULT 'antigravity'
    CHECK (default_prompt_target IN ('antigravity', 'cursor', 'claude')),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_reason text;

CREATE INDEX IF NOT EXISTS idx_users_active_id
  ON public.users (id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled
  ON public.users (deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;

ALTER TABLE public.user_sessions
  ADD COLUMN IF NOT EXISTS auth_session_id uuid,
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_sessions_auth_session_id
  ON public.user_sessions (auth_session_id, revoked_at)
  WHERE auth_session_id IS NOT NULL;

-- Strip anonymous & default public privileges across exposed public tables
REVOKE ALL ON TABLE
  public.users,
  public.user_sessions,
  public.analysis_jobs,
  public.page_evidence,
  public.visual_screenshots,
  public.blueprint_artifacts,
  public.job_audit_logs
FROM PUBLIC, anon;

-- Least-privilege grants for authenticated users (users cannot mutate id, email, or role)
REVOKE ALL ON TABLE public.users FROM authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT UPDATE (name, default_prompt_target, deleted_at, deletion_scheduled_at, deletion_reason)
  ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.user_sessions,
  public.analysis_jobs,
  public.page_evidence,
  public.visual_screenshots,
  public.blueprint_artifacts
TO authenticated;
GRANT SELECT, INSERT ON TABLE public.job_audit_logs TO authenticated;

-- Trigger guard preventing role elevation, ID/email spoofing, and reactivation of soft-deleted accounts
CREATE OR REPLACE FUNCTION private.guard_user_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Account identifier cannot be modified';
    END IF;
    IF NEW.email IS DISTINCT FROM OLD.email THEN
      RAISE EXCEPTION 'Account email cannot be modified directly';
    END IF;
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Account role cannot be self-modified';
    END IF;
    IF OLD.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Account marked for deletion cannot be reactivated';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_guard_update ON public.users;
CREATE TRIGGER trg_users_guard_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION private.guard_user_profile_update();

-- Non-PII data-retention ledger in private schema (inaccessible via Data API)
CREATE TABLE IF NOT EXISTS private.account_deletion_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id_hash text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  purge_after timestamptz NOT NULL,
  auth_identity_deleted boolean NOT NULL DEFAULT false,
  jobs_purged integer NOT NULL DEFAULT 0,
  storage_objects_removed integer NOT NULL DEFAULT 0,
  retention_note text
);

REVOKE ALL ON TABLE private.account_deletion_ledger FROM PUBLIC, anon, authenticated;

-- Retention cleanup routine callable via scheduled job (pg_cron) or service role maintenance
CREATE OR REPLACE FUNCTION private.purge_expired_deleted_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  purged_count integer := 0;
BEGIN
  WITH expired AS (
    SELECT id
    FROM public.users
    WHERE deleted_at IS NOT NULL
      AND deletion_scheduled_at IS NOT NULL
      AND deletion_scheduled_at <= now()
  )
  DELETE FROM auth.users a
  USING expired e
  WHERE a.id = e.id;

  GET DIAGNOSTICS purged_count = ROW_COUNT;
  RETURN purged_count;
END;
$$;

REVOKE ALL ON FUNCTION private.purge_expired_deleted_accounts() FROM PUBLIC, anon, authenticated;

-- Active-account RLS guards (immediately block soft-deleted accounts even before JWT exp)
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id AND deleted_at IS NULL);

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id AND deleted_at IS NULL)
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND (
      deleted_at IS NULL
      OR (deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at >= deleted_at)
    )
  );

DROP POLICY IF EXISTS user_sessions_select_own ON public.user_sessions;
CREATE POLICY user_sessions_select_own ON public.user_sessions
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS user_sessions_insert_own ON public.user_sessions;
CREATE POLICY user_sessions_insert_own ON public.user_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS analysis_jobs_select_own ON public.analysis_jobs;
CREATE POLICY analysis_jobs_select_own ON public.analysis_jobs
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS analysis_jobs_insert_own ON public.analysis_jobs;
CREATE POLICY analysis_jobs_insert_own ON public.analysis_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS analysis_jobs_update_own ON public.analysis_jobs;
CREATE POLICY analysis_jobs_update_own ON public.analysis_jobs
  FOR UPDATE TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS rebuildiq_artifacts_select_own ON storage.objects;
CREATE POLICY rebuildiq_artifacts_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rebuildiq-artifacts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS rebuildiq_artifacts_insert_own ON storage.objects;
CREATE POLICY rebuildiq_artifacts_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'rebuildiq-artifacts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS rebuildiq_artifacts_update_own ON storage.objects;
CREATE POLICY rebuildiq_artifacts_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'rebuildiq-artifacts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  )
  WITH CHECK (
    bucket_id = 'rebuildiq-artifacts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );
