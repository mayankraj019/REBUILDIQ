-- RebuildIQ Supabase PostgreSQL Schema, Triggers, RLS & Storage Policies
-- Applied to project ubnwbkcbixtbaiutrfiv via Supabase MCP migrations.

CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ip_address text,
  user_agent text,
  auth_method text NOT NULL DEFAULT 'password',
  logged_in_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_logged_in
  ON public.user_sessions (user_id, logged_in_at DESC);

CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_url text NOT NULL,
  normalized_domain text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (
    status IN (
      'PENDING',
      'VALIDATING',
      'QUEUED',
      'INSPECTING',
      'EXTRACTING_EVIDENCE',
      'ANALYZING_AI',
      'GENERATING_BLUEPRINT',
      'COMPLETED',
      'FAILED',
      'CANCELLED'
    )
  ),
  progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  crawl_depth integer NOT NULL DEFAULT 1 CHECK (crawl_depth >= 1 AND crawl_depth <= 5),
  viewports_config jsonb NOT NULL DEFAULT '["desktop","tablet","mobile"]'::jsonb,
  error_code text,
  error_message text,
  duration_ms integer,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_created
  ON public.analysis_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_status
  ON public.analysis_jobs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_normalized_domain
  ON public.analysis_jobs (normalized_domain);

CREATE TABLE IF NOT EXISTS public.page_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  page_title text NOT NULL,
  meta_tags jsonb NOT NULL DEFAULT '{}'::jsonb,
  dom_structure jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_typography jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_spacing jsonb NOT NULL DEFAULT '[]'::jsonb,
  detected_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  dom_node_count integer NOT NULL DEFAULT 0,
  extracted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_evidence_job_id
  ON public.page_evidence (job_id);

CREATE TABLE IF NOT EXISTS public.visual_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES public.page_evidence(id) ON DELETE CASCADE,
  viewport_type text NOT NULL CHECK (viewport_type IN ('MOBILE', 'TABLET', 'DESKTOP')),
  width integer NOT NULL,
  height integer NOT NULL,
  storage_key text NOT NULL,
  file_hash text NOT NULL,
  file_size_bytes integer NOT NULL,
  mime_type text NOT NULL DEFAULT 'image/png',
  captured_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visual_screenshots_evidence_id
  ON public.visual_screenshots (evidence_id);

CREATE TABLE IF NOT EXISTS public.blueprint_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT '1.0.0',
  design_system_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  component_architecture jsonb NOT NULL DEFAULT '[]'::jsonb,
  state_interactions jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_stack jsonb NOT NULL DEFAULT '[]'::jsonb,
  antigravity_prompts text NOT NULL DEFAULT '',
  is_edited_by_user boolean NOT NULL DEFAULT false,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_artifacts_job_id
  ON public.blueprint_artifacts (job_id);

CREATE TABLE IF NOT EXISTS public.job_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  level text NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR')),
  message text NOT NULL,
  metadata jsonb,
  "timestamp" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_audit_logs_job_time
  ON public.job_audit_logs (job_id, "timestamp" ASC);
