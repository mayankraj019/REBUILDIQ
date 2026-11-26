import { notFound } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  AnalysisJobDetail,
  AnalysisJobSummary,
  BlueprintArtifactView,
  JobStatus,
  ObservedEvidenceView,
  PromptPhaseItem,
  ViewportPreset,
} from './types';
import { UI_PREVIEW_FIXTURE } from './preview-fixture';
import { isValidUuid } from '@/lib/auth/schemas';

function parseJsonValue<T>(raw: Json | string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return raw as T;
}

/**
 * Fetches real, RLS-protected and user-scoped analysis jobs from Supabase PostgreSQL.
 * Never returns mock data as completed real analyses.
 */
export async function getUserAnalysisJobs(
  userId: string,
  client?: SupabaseClient<Database>
): Promise<AnalysisJobSummary[]> {
  if (!userId) return [];

  const supabase = client ?? (await createSupabaseServerClient());

  const { data, error } = await supabase
    .from('analysis_jobs')
    .select(
      `
      id,
      target_url,
      normalized_domain,
      status,
      progress_percent,
      crawl_depth,
      viewports_config,
      error_code,
      error_message,
      duration_ms,
      created_at,
      started_at,
      completed_at,
      page_evidence(id),
      blueprint_artifacts(id)
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const viewports = parseJsonValue<ViewportPreset[]>(row.viewports_config, ['desktop']);
    const evidenceList = Array.isArray(row.page_evidence) ? row.page_evidence : [];
    const blueprintList = Array.isArray(row.blueprint_artifacts) ? row.blueprint_artifacts : [];

    return {
      id: row.id,
      targetUrl: row.target_url,
      normalizedDomain: row.normalized_domain,
      status: row.status as JobStatus,
      progressPercent: row.progress_percent,
      crawlDepth: row.crawl_depth,
      viewports,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      pageCount: evidenceList.length,
      hasBlueprint: blueprintList.length > 0,
      isPreviewFixture: false,
    };
  });
}

/**
 * Parses markdown into 4 phase items when stored as plain text in blueprint_artifacts.
 */
export function splitPromptMarkdownToPhases(markdown: string): PromptPhaseItem[] {
  if (!markdown.trim()) {
    return [];
  }

  const sections = markdown.split(/\n---\n/).filter((s) => s.trim().length > 0);
  if (sections.length === 0) {
    return [
      {
        phase: 1,
        title: 'Implementation Prompt',
        objective: 'Generated reconstruction instructions',
        prompt: markdown,
      },
    ];
  }

  return sections.map((section, idx) => {
    const firstLine = section.trim().split('\n')[0] || `Phase ${idx + 1}`;
    const cleanedTitle = firstLine.replace(/^#+\s*/, '').trim();
    return {
      phase: idx + 1,
      title: cleanedTitle || `Phase ${idx + 1}`,
      objective: `Phase ${idx + 1} implementation workflow`,
      prompt: section.trim(),
    };
  });
}

/**
 * Loads an AnalysisJobDetail either from the explicit UI Preview Fixture (`id === 'preview'`)
 * or via RLS-enforced Supabase PostgreSQL query (`WHERE id = jobId AND user_id = userId`).
 * Calls notFound() if absent or owned by another user.
 */
export async function loadAnalysisDetailOrNotFound(
  jobId: string,
  userId: string,
  client?: SupabaseClient<Database>
): Promise<AnalysisJobDetail> {
  if (jobId === 'preview') {
    return UI_PREVIEW_FIXTURE;
  }

  if (!isValidUuid(jobId)) {
    notFound();
  }

  const supabase = client ?? (await createSupabaseServerClient());

  const { data: job, error } = await supabase
    .from('analysis_jobs')
    .select(
      `
      *,
      page_evidence(*, visual_screenshots(*)),
      blueprint_artifacts(*),
      job_audit_logs(*)
    `
    )
    .eq('id', jobId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !job) {
    notFound();
  }

  const viewports = parseJsonValue<ViewportPreset[]>(job.viewports_config, ['desktop']);

  const rawEvidence = Array.isArray(job.page_evidence) ? job.page_evidence : [];
  const evidence: ObservedEvidenceView[] = rawEvidence.map((ev) => {
    const rawShots = Array.isArray(ev.visual_screenshots) ? ev.visual_screenshots : [];
    return {
      id: ev.id,
      pageUrl: ev.page_url,
      pageTitle: ev.page_title,
      domNodeCount: ev.dom_node_count,
      extractedAt: ev.extracted_at,
      metaTags: parseJsonValue<Record<string, string>>(ev.meta_tags, {}),
      typography: parseJsonValue(ev.computed_typography, []),
      colors: parseJsonValue(ev.computed_colors, []),
      spacing: parseJsonValue(ev.computed_spacing, []),
      domOutline: parseJsonValue(ev.dom_structure, []),
      detectedSections: parseJsonValue(ev.detected_components, []),
      screenshots: rawShots.map((s) => ({
        id: s.id,
        viewportType: (s.viewport_type as 'MOBILE' | 'TABLET' | 'DESKTOP') || 'DESKTOP',
        width: s.width,
        height: s.height,
        storageKey: s.storage_key,
        fileSizeBytes: s.file_size_bytes,
        capturedAt: s.captured_at,
      })),
    };
  });

  const rawBlueprints = Array.isArray(job.blueprint_artifacts) ? job.blueprint_artifacts : [];
  const latestBlueprint = rawBlueprints[0];

  const [normalizedPromptsRes, analysisResultRes, jobEventsRes] = await Promise.all([
    latestBlueprint
      ? supabase
          .from('implementation_prompts')
          .select('phase_number, target_tool, title, objective, prompt_markdown')
          .eq('blueprint_id', latestBlueprint.id)
          .order('phase_number', { ascending: true })
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('analysis_results')
      .select('architecture_summary')
      .eq('job_id', jobId)
      .maybeSingle(),
    supabase
      .from('job_events')
      .select('id, event_type, to_status, message, created_at')
      .eq('job_id', jobId)
      .order('created_at', { ascending: true }),
  ]);

  let blueprint: BlueprintArtifactView | null = null;

  if (latestBlueprint) {
    const designSpec = parseJsonValue<BlueprintArtifactView['designTokens']>(
      latestBlueprint.design_system_spec,
      { colors: [], typography: [], spacingScale: [], radii: [] }
    );
    const components = parseJsonValue<BlueprintArtifactView['components']>(
      latestBlueprint.component_architecture,
      []
    );
    const interactions = parseJsonValue<BlueprintArtifactView['interactions']>(
      latestBlueprint.state_interactions,
      []
    );
    const stack = parseJsonValue<BlueprintArtifactView['recommendedStack']>(
      latestBlueprint.recommended_stack,
      []
    );

    const dbPrompts =
      !normalizedPromptsRes.error &&
      Array.isArray(normalizedPromptsRes.data) &&
      normalizedPromptsRes.data.length > 0
        ? normalizedPromptsRes.data
        : null;

    const prompts: PromptPhaseItem[] = dbPrompts
      ? Array.from(
          dbPrompts
            .reduce((acc, row) => {
              const existing = acc.get(row.phase_number);
              if (!existing || row.target_tool === 'antigravity') {
                acc.set(row.phase_number, {
                  phase: row.phase_number,
                  title: row.title,
                  objective: row.objective,
                  prompt: row.prompt_markdown,
                });
              }
              return acc;
            }, new Map<number, PromptPhaseItem>())
            .values()
        )
      : splitPromptMarkdownToPhases(latestBlueprint.antigravity_prompts);

    const resolvedSummary =
      !analysisResultRes.error && analysisResultRes.data?.architecture_summary
        ? analysisResultRes.data.architecture_summary
        : 'Synthesized reconstruction specification generated from captured page evidence.';

    blueprint = {
      id: latestBlueprint.id,
      version: latestBlueprint.version,
      isEditedByUser: latestBlueprint.is_edited_by_user,
      generatedAt: latestBlueprint.generated_at,
      updatedAt: latestBlueprint.updated_at,
      summary: resolvedSummary,
      designTokens: designSpec,
      components,
      interactions,
      recommendedStack: stack,
      prompts,
      rawAntigravityMarkdown: latestBlueprint.antigravity_prompts,
    };
  }

  const rawLogs = Array.isArray(job.job_audit_logs) ? job.job_audit_logs : [];
  const rawEvents =
    !jobEventsRes.error && Array.isArray(jobEventsRes.data) ? jobEventsRes.data : [];

  const auditLogs =
    rawLogs.length > 0
      ? rawLogs.map((entry) => ({
          id: entry.id,
          stage: entry.stage,
          level: (entry.level as 'INFO' | 'WARN' | 'ERROR') || 'INFO',
          message: entry.message,
          timestamp: entry.timestamp,
        }))
      : rawEvents.map((ev) => ({
          id: ev.id,
          stage: ev.to_status || ev.event_type,
          level: (ev.event_type === 'JOB_FAILED'
            ? 'ERROR'
            : ev.event_type === 'JOB_CANCELLED' || ev.event_type === 'STALE_RECOVERED'
            ? 'WARN'
            : 'INFO') as 'INFO' | 'WARN' | 'ERROR',
          message: ev.message,
          timestamp: ev.created_at,
        }));

  return {
    id: job.id,
    targetUrl: job.target_url,
    normalizedDomain: job.normalized_domain,
    status: job.status as JobStatus,
    progressPercent: job.progress_percent,
    crawlDepth: job.crawl_depth,
    viewports,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    durationMs: job.duration_ms,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    pageCount: evidence.length,
    hasBlueprint: blueprint !== null,
    isPreviewFixture: false,
    evidence,
    blueprint,
    auditLogs,
  };
}
