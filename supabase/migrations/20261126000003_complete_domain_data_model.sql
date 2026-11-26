-- Migration: 20261126000003_complete_domain_data_model.sql
-- Implements the full RebuildIQ domain schema in Supabase PostgreSQL:
-- 1. Durable job states, worker lease recovery, idempotency keys & retention windows on `analysis_jobs`
-- 2. New normalized tables: `discovered_pages`, `analysis_results`, `implementation_prompts`, `export_records`, `job_events`
-- 3. Object-storage enforcement (ban inline base64 data URIs), FK indexes & CHECK constraints
-- 4. PostgreSQL status-transition guard trigger + atomic SKIP LOCKED worker claim & recovery functions (in `private`)
-- 5. Least-privilege Row Level Security (`TO authenticated`, cached `(SELECT auth.uid())`, active account checks)

-- =============================================================================
-- 1. Extend existing core tables with durability, idempotency, storage & retention fields
-- =============================================================================

ALTER TABLE public.analysis_jobs
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS worker_id text,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'analysis_jobs_attempt_bounds'
  ) THEN
    ALTER TABLE public.analysis_jobs
      ADD CONSTRAINT analysis_jobs_attempt_bounds
      CHECK (attempt_count >= 0 AND max_attempts >= 1 AND attempt_count <= max_attempts);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_analysis_jobs_user_idempotency
  ON public.analysis_jobs (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_claim_queue
  ON public.analysis_jobs (status, lease_expires_at, created_at)
  WHERE status IN ('PENDING', 'VALIDATING', 'QUEUED', 'INSPECTING', 'EXTRACTING_EVIDENCE', 'ANALYZING_AI', 'GENERATING_BLUEPRINT');

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_expires_at
  ON public.analysis_jobs (expires_at)
  WHERE expires_at IS NOT NULL;

-- =============================================================================
-- 2. Discovered Pages (`public.discovered_pages`) & Evidence Idempotency Links
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.discovered_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  url text NOT NULL,
  normalized_url text NOT NULL,
  depth integer NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 5),
  http_status integer,
  status text NOT NULL DEFAULT 'DISCOVERED' CHECK (
    status IN ('DISCOVERED', 'QUEUED', 'INSPECTING', 'COMPLETED', 'FAILED', 'SKIPPED')
  ),
  is_entry_page boolean NOT NULL DEFAULT false,
  error_code text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  inspected_at timestamptz,
  UNIQUE (job_id, normalized_url)
);

CREATE INDEX IF NOT EXISTS idx_discovered_pages_job_status
  ON public.discovered_pages (job_id, status);

ALTER TABLE public.page_evidence
  ADD COLUMN IF NOT EXISTS discovered_page_id uuid REFERENCES public.discovered_pages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dom_snapshot_storage_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'page_evidence_storage_key_no_inline_data'
  ) THEN
    ALTER TABLE public.page_evidence
      ADD CONSTRAINT page_evidence_storage_key_no_inline_data
      CHECK (dom_snapshot_storage_key IS NULL OR dom_snapshot_storage_key NOT LIKE 'data:%');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_page_evidence_discovered_page
  ON public.page_evidence (discovered_page_id)
  WHERE discovered_page_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_page_evidence_job_url
  ON public.page_evidence (job_id, page_url);

ALTER TABLE public.visual_screenshots
  ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'rebuildiq-artifacts';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'visual_screenshots_no_inline_blob'
  ) THEN
    ALTER TABLE public.visual_screenshots
      ADD CONSTRAINT visual_screenshots_no_inline_blob
      CHECK (storage_key NOT LIKE 'data:%' AND length(storage_key) > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_visual_screenshots_evidence_viewport
  ON public.visual_screenshots (evidence_id, viewport_type);

-- =============================================================================
-- 3. Analysis Results (`public.analysis_results`)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('gemini', 'mock')),
  model_name text NOT NULL,
  architecture_summary text NOT NULL,
  detected_patterns jsonb NOT NULL DEFAULT '[]'::jsonb,
  design_token_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  evidence_coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric(4, 3) CHECK (confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)),
  raw_artifact_storage_key text CHECK (raw_artifact_storage_key IS NULL OR raw_artifact_storage_key NOT LIKE 'data:%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_analysis_results_updated_at ON public.analysis_results;
CREATE TRIGGER trg_analysis_results_updated_at
  BEFORE UPDATE ON public.analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- =============================================================================
-- 4. Blueprint Versioning Link & Normalized Implementation Prompts
-- =============================================================================

ALTER TABLE public.blueprint_artifacts
  ADD COLUMN IF NOT EXISTS analysis_result_id uuid REFERENCES public.analysis_results(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS blueprint_storage_key text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'blueprint_artifacts_storage_key_no_inline'
  ) THEN
    ALTER TABLE public.blueprint_artifacts
      ADD CONSTRAINT blueprint_artifacts_storage_key_no_inline
      CHECK (blueprint_storage_key IS NULL OR blueprint_storage_key NOT LIKE 'data:%');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blueprint_artifacts_result_id
  ON public.blueprint_artifacts (analysis_result_id)
  WHERE analysis_result_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_blueprint_artifacts_job_version
  ON public.blueprint_artifacts (job_id, version);

CREATE TABLE IF NOT EXISTS public.implementation_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_id uuid NOT NULL REFERENCES public.blueprint_artifacts(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  phase_number integer NOT NULL CHECK (phase_number >= 1 AND phase_number <= 10),
  target_tool text NOT NULL DEFAULT 'antigravity' CHECK (
    target_tool IN ('antigravity', 'cursor', 'claude', 'generic')
  ),
  title text NOT NULL,
  objective text NOT NULL,
  prompt_markdown text NOT NULL,
  prompt_hash text NOT NULL,
  is_edited_by_user boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blueprint_id, target_tool, phase_number)
);

CREATE INDEX IF NOT EXISTS idx_implementation_prompts_job_tool
  ON public.implementation_prompts (job_id, target_tool);

DROP TRIGGER IF EXISTS trg_implementation_prompts_updated_at ON public.implementation_prompts;
CREATE TRIGGER trg_implementation_prompts_updated_at
  BEFORE UPDATE ON public.implementation_prompts
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- =============================================================================
-- 5. Export Records (`public.export_records`) & Operational Job Events (`public.job_events`)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.export_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  format text NOT NULL CHECK (
    format IN ('prompts-md', 'blueprint-md', 'blueprint-json', 'tailwind-ts', 'evidence-json', 'zip')
  ),
  storage_key text CHECK (storage_key IS NULL OR storage_key NOT LIKE 'data:%'),
  file_hash text,
  file_size_bytes integer CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  status text NOT NULL DEFAULT 'READY' CHECK (status IN ('PENDING', 'READY', 'FAILED', 'EXPIRED')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_records_user_created
  ON public.export_records (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_export_records_job_format
  ON public.export_records (job_id, format);
CREATE INDEX IF NOT EXISTS idx_export_records_expires_at
  ON public.export_records (expires_at);

CREATE TABLE IF NOT EXISTS public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'JOB_CREATED',
      'STATUS_TRANSITION',
      'WORKER_CLAIMED',
      'HEARTBEAT',
      'STALE_RECOVERED',
      'PAGE_DISCOVERED',
      'EVIDENCE_CAPTURED',
      'AI_COMPLETED',
      'BLUEPRINT_GENERATED',
      'EXPORT_CREATED',
      'JOB_CANCELLED',
      'JOB_FAILED'
    )
  ),
  from_status text,
  to_status text,
  worker_id text,
  attempt_number integer NOT NULL DEFAULT 0 CHECK (attempt_number >= 0),
  message text NOT NULL,
  metadata jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_job_events_job_idempotency
  ON public.job_events (job_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_events_job_created
  ON public.job_events (job_id, created_at ASC);

-- =============================================================================
-- 6. Durable State Transition Guard & Crash Recovery Functions (Postgres)
-- =============================================================================

CREATE OR REPLACE FUNCTION private.enforce_analysis_job_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  allowed := CASE OLD.status
    WHEN 'PENDING' THEN NEW.status IN ('VALIDATING', 'QUEUED', 'FAILED', 'CANCELLED')
    WHEN 'VALIDATING' THEN NEW.status IN ('QUEUED', 'INSPECTING', 'FAILED', 'CANCELLED')
    WHEN 'QUEUED' THEN NEW.status IN ('INSPECTING', 'FAILED', 'CANCELLED')
    WHEN 'INSPECTING' THEN NEW.status IN ('EXTRACTING_EVIDENCE', 'QUEUED', 'FAILED', 'CANCELLED')
    WHEN 'EXTRACTING_EVIDENCE' THEN NEW.status IN ('ANALYZING_AI', 'QUEUED', 'FAILED', 'CANCELLED')
    WHEN 'ANALYZING_AI' THEN NEW.status IN ('GENERATING_BLUEPRINT', 'QUEUED', 'FAILED', 'CANCELLED')
    WHEN 'GENERATING_BLUEPRINT' THEN NEW.status IN ('COMPLETED', 'QUEUED', 'FAILED', 'CANCELLED')
    WHEN 'FAILED' THEN NEW.status IN ('QUEUED')
    WHEN 'COMPLETED' THEN false
    WHEN 'CANCELLED' THEN false
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION 'Invalid analysis job state transition: % -> %', OLD.status, NEW.status;
  END IF;

  IF NEW.status IN ('COMPLETED', 'FAILED', 'CANCELLED') THEN
    NEW.worker_id := NULL;
    NEW.lease_expires_at := NULL;
  END IF;

  IF NEW.status = 'COMPLETED' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
    NEW.progress_percent := 100;
  END IF;

  IF NEW.status = 'CANCELLED' AND NEW.cancelled_at IS NULL THEN
    NEW.cancelled_at := now();
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_analysis_jobs_transition ON public.analysis_jobs;
CREATE TRIGGER trg_analysis_jobs_transition
  BEFORE UPDATE ON public.analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_analysis_job_transition();

-- Atomic SKIP LOCKED worker claim inside non-exposed private schema
CREATE OR REPLACE FUNCTION private.claim_next_analysis_job(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 180
)
RETURNS SETOF public.analysis_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.analysis_jobs%ROWTYPE;
BEGIN
  SELECT j.*
  INTO v_job
  FROM public.analysis_jobs j
  JOIN public.users u ON u.id = j.user_id
  WHERE j.status = 'QUEUED'
    AND j.attempt_count < j.max_attempts
    AND u.deleted_at IS NULL
  ORDER BY j.created_at ASC
  LIMIT 1
  FOR UPDATE OF j SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.analysis_jobs
  SET status = 'INSPECTING',
      worker_id = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      heartbeat_at = now(),
      started_at = COALESCE(started_at, now()),
      attempt_count = attempt_count + 1
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  INSERT INTO public.job_events (
    job_id,
    event_type,
    from_status,
    to_status,
    worker_id,
    attempt_number,
    message
  )
  VALUES (
    v_job.id,
    'WORKER_CLAIMED',
    'QUEUED',
    'INSPECTING',
    p_worker_id,
    v_job.attempt_count,
    format('Worker %s claimed job on attempt %s', p_worker_id, v_job.attempt_count)
  );

  RETURN NEXT v_job;
END;
$$;

REVOKE ALL ON FUNCTION private.claim_next_analysis_job(text, integer) FROM PUBLIC, anon, authenticated;

-- Crash recovery for jobs whose worker lease expired cleanly
CREATE OR REPLACE FUNCTION private.recover_stale_analysis_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec record;
  v_recovered integer := 0;
BEGIN
  FOR v_rec IN
    SELECT *
    FROM public.analysis_jobs
    WHERE status IN ('INSPECTING', 'EXTRACTING_EVIDENCE', 'ANALYZING_AI', 'GENERATING_BLUEPRINT')
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_rec.attempt_count < v_rec.max_attempts THEN
      UPDATE public.analysis_jobs
      SET status = 'QUEUED',
          worker_id = NULL,
          lease_expires_at = NULL
      WHERE id = v_rec.id;

      INSERT INTO public.job_events (
        job_id,
        event_type,
        from_status,
        to_status,
        worker_id,
        attempt_number,
        message
      )
      VALUES (
        v_rec.id,
        'STALE_RECOVERED',
        v_rec.status,
        'QUEUED',
        v_rec.worker_id,
        v_rec.attempt_count,
        format('Recovered stale job after lease expiry (attempt %s/%s)', v_rec.attempt_count, v_rec.max_attempts)
      );
    ELSE
      UPDATE public.analysis_jobs
      SET status = 'FAILED',
          error_code = 'WORKER_CRASH_MAX_RETRIES',
          error_message = 'Analysis halted after exhausting worker retry budget.',
          completed_at = now()
      WHERE id = v_rec.id;

      INSERT INTO public.job_events (
        job_id,
        event_type,
        from_status,
        to_status,
        worker_id,
        attempt_number,
        message
      )
      VALUES (
        v_rec.id,
        'JOB_FAILED',
        v_rec.status,
        'FAILED',
        v_rec.worker_id,
        v_rec.attempt_count,
        'Marked job FAILED after exhausting maximum recovery attempts'
      );
    END IF;

    v_recovered := v_recovered + 1;
  END LOOP;

  RETURN v_recovered;
END;
$$;

REVOKE ALL ON FUNCTION private.recover_stale_analysis_jobs() FROM PUBLIC, anon, authenticated;

-- Automated retention sweep (expired export records + expired analysis jobs)
CREATE OR REPLACE FUNCTION private.purge_expired_retention_data()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_exports integer := 0;
  v_jobs integer := 0;
BEGIN
  DELETE FROM public.export_records WHERE expires_at <= now();
  GET DIAGNOSTICS v_exports = ROW_COUNT;

  DELETE FROM public.analysis_jobs WHERE expires_at IS NOT NULL AND expires_at <= now();
  GET DIAGNOSTICS v_jobs = ROW_COUNT;

  RETURN v_exports + v_jobs;
END;
$$;

REVOKE ALL ON FUNCTION private.purge_expired_retention_data() FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 7. Privileges & Row Level Security for Newly Added Tables
-- =============================================================================

REVOKE ALL ON TABLE
  public.discovered_pages,
  public.analysis_results,
  public.implementation_prompts,
  public.export_records,
  public.job_events
FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.discovered_pages,
  public.analysis_results,
  public.implementation_prompts,
  public.export_records
TO authenticated;

GRANT SELECT, INSERT ON TABLE public.job_events TO authenticated;

ALTER TABLE public.discovered_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.implementation_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;

-- discovered_pages RLS (scoped strictly through owned analysis_jobs + active user)
DROP POLICY IF EXISTS discovered_pages_select_own ON public.discovered_pages;
CREATE POLICY discovered_pages_select_own ON public.discovered_pages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = discovered_pages.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS discovered_pages_insert_own ON public.discovered_pages;
CREATE POLICY discovered_pages_insert_own ON public.discovered_pages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = discovered_pages.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS discovered_pages_update_own ON public.discovered_pages;
CREATE POLICY discovered_pages_update_own ON public.discovered_pages
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = discovered_pages.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = discovered_pages.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS discovered_pages_delete_own ON public.discovered_pages;
CREATE POLICY discovered_pages_delete_own ON public.discovered_pages
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = discovered_pages.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  );

-- analysis_results RLS
DROP POLICY IF EXISTS analysis_results_select_own ON public.analysis_results;
CREATE POLICY analysis_results_select_own ON public.analysis_results
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = analysis_results.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS analysis_results_insert_own ON public.analysis_results;
CREATE POLICY analysis_results_insert_own ON public.analysis_results
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = analysis_results.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS analysis_results_update_own ON public.analysis_results;
CREATE POLICY analysis_results_update_own ON public.analysis_results
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = analysis_results.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = analysis_results.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS analysis_results_delete_own ON public.analysis_results;
CREATE POLICY analysis_results_delete_own ON public.analysis_results
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = analysis_results.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  );

-- implementation_prompts RLS
DROP POLICY IF EXISTS implementation_prompts_select_own ON public.implementation_prompts;
CREATE POLICY implementation_prompts_select_own ON public.implementation_prompts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = implementation_prompts.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS implementation_prompts_insert_own ON public.implementation_prompts;
CREATE POLICY implementation_prompts_insert_own ON public.implementation_prompts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = implementation_prompts.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS implementation_prompts_update_own ON public.implementation_prompts;
CREATE POLICY implementation_prompts_update_own ON public.implementation_prompts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = implementation_prompts.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = implementation_prompts.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS implementation_prompts_delete_own ON public.implementation_prompts;
CREATE POLICY implementation_prompts_delete_own ON public.implementation_prompts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      WHERE j.id = implementation_prompts.job_id
        AND j.user_id = (SELECT auth.uid())
    )
  );

-- export_records RLS
DROP POLICY IF EXISTS export_records_select_own ON public.export_records;
CREATE POLICY export_records_select_own ON public.export_records
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = (SELECT auth.uid()) AND u.deleted_at IS NULL)
  );

DROP POLICY IF EXISTS export_records_insert_own ON public.export_records;
CREATE POLICY export_records_insert_own ON public.export_records
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = export_records.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS export_records_update_own ON public.export_records;
CREATE POLICY export_records_update_own ON public.export_records
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS export_records_delete_own ON public.export_records;
CREATE POLICY export_records_delete_own ON public.export_records
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- job_events RLS (append-only for active owners; no client UPDATE/DELETE)
DROP POLICY IF EXISTS job_events_select_own ON public.job_events;
CREATE POLICY job_events_select_own ON public.job_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = job_events.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS job_events_insert_own ON public.job_events;
CREATE POLICY job_events_insert_own ON public.job_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.analysis_jobs j
      JOIN public.users u ON u.id = j.user_id
      WHERE j.id = job_events.job_id
        AND j.user_id = (SELECT auth.uid())
        AND u.deleted_at IS NULL
    )
  );
