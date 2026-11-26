import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { SupabaseStorageService } from '@/lib/supabase/storage';
import {
  AuthError,
  NotFoundError,
  buildAuthOrNotFoundResponse,
  requireAuth,
  requireJobOwnership,
} from '@/lib/auth/middleware';
import { apiError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const log = logger.forContext('JobExportApi');

const SUPPORTED_FORMATS = new Set([
  'prompts-md',
  'blueprint-md',
  'blueprint-json',
  'tailwind-ts',
  'evidence-json',
  'zip',
]);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await context.params;
    const format = request.nextUrl.searchParams.get('format') || 'blueprint-json';

    if (!SUPPORTED_FORMATS.has(format)) {
      return apiError('VALIDATION_FAILED', 'Unsupported export format requested', 400);
    }

    // Strict ownership enforcement before touching DB records or storage artifacts
    const job: any = await requireJobOwnership(id, auth.user.id, request);

    if (format === 'zip') {
      return apiError(
        'ZIP_EXPORT_DISCONNECTED',
        'Server-side ZIP bundle packaging awaits Phase 3/4 Playwright worker artifacts. Individual formats remain downloadable directly.',
        501
      );
    }

    const { supabase } = createSupabaseRouteClient(request);
    const blueprints = Array.isArray(job.blueprint_artifacts) ? job.blueprint_artifacts : [];
    const blueprint = blueprints[0] || null;
    const evidence = Array.isArray(job.page_evidence) ? job.page_evidence : [];
    const safeDomain = String(job.normalized_domain || 'export').replace(/[^a-zA-Z0-9.-]/g, '_');

    let filename = `${safeDomain}-export.json`;
    let contentType = 'application/json;charset=utf-8';
    let body = '';

    if (format === 'prompts-md') {
      if (!blueprint) {
        throw new NotFoundError('Blueprint prompts not yet available for this analysis');
      }
      filename = `${safeDomain}-antigravity-prompts.md`;
      contentType = 'text/markdown;charset=utf-8';
      body = String(blueprint.antigravity_prompts || '');
    } else if (format === 'blueprint-md') {
      if (!blueprint) {
        throw new NotFoundError('Blueprint artifact not yet available for this analysis');
      }
      filename = `${safeDomain}-blueprint.md`;
      contentType = 'text/markdown;charset=utf-8';
      const components = Array.isArray(blueprint.component_architecture)
        ? blueprint.component_architecture
        : [];
      const stack = Array.isArray(blueprint.recommended_stack)
        ? blueprint.recommended_stack
        : [];

      body = [
        `# RebuildIQ Reconstruction Blueprint: ${job.normalized_domain}`,
        `Target URL: ${job.target_url}`,
        '',
        '## Component Hierarchy',
        ...components.map(
          (c: any) => `- **${c.name || 'Component'}** (${c.observedSource || 'observed'}): ${c.purpose || ''}`
        ),
        '',
        '## Recommended Stack',
        ...stack.map(
          (s: any) => `- **${s.layer || 'Layer'}**: ${s.choice || ''} — ${s.rationale || ''}`
        ),
      ].join('\n');
    } else if (format === 'tailwind-ts') {
      if (!blueprint) {
        throw new NotFoundError('Blueprint artifact not yet available for this analysis');
      }
      filename = 'tailwind.theme.ts';
      contentType = 'text/typescript;charset=utf-8';
      const colors = Array.isArray(blueprint.design_system_spec?.colors)
        ? blueprint.design_system_spec.colors
        : [];
      const colorLines = colors
        .map((c: any) => `        '${String(c.name || 'token')}': '${String(c.hex || '#14213D')}',`)
        .join('\n');
      body = `import type { Config } from 'tailwindcss';\n\nconst config: Partial<Config> = {\n  theme: {\n    extend: {\n      colors: {\n${colorLines}\n      },\n    },\n  },\n};\n\nexport default config;\n`;
    } else if (format === 'evidence-json') {
      filename = `${safeDomain}-observed-evidence.json`;
      contentType = 'application/json;charset=utf-8';

      // Issue time-limited pre-signed URLs strictly scoped to the verified user's folder prefix
      const storageService = new SupabaseStorageService(supabase);
      const signedScreenshots: Record<string, string> = {};

      for (const page of evidence) {
        const shots = Array.isArray(page?.visual_screenshots) ? page.visual_screenshots : [];
        for (const shot of shots) {
          const storageKey = typeof shot?.storage_key === 'string' ? shot.storage_key : '';
          if (storageKey.startsWith(`${auth.user.id}/`)) {
            try {
              signedScreenshots[shot.id] = await storageService.getDownloadUrl(storageKey, 900);
            } catch {
              // Ignore missing storage object gracefully
            }
          }
        }
      }

      body = JSON.stringify(
        {
          meta: {
            jobId: job.id,
            targetUrl: job.target_url,
            classification: 'OBSERVED_GROUND_TRUTH',
            exportedAt: new Date().toISOString(),
          },
          evidence,
          signedScreenshotUrls: signedScreenshots,
        },
        null,
        2
      );
    } else {
      filename = `${safeDomain}-blueprint.json`;
      contentType = 'application/json;charset=utf-8';
      body = JSON.stringify(
        {
          meta: {
            jobId: job.id,
            targetUrl: job.target_url,
            exportedAt: new Date().toISOString(),
          },
          blueprint,
        },
        null,
        2
      );
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
      },
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof NotFoundError) {
      return buildAuthOrNotFoundResponse(error, request);
    }

    log.error('Export artifact error', error);
    return apiError('INTERNAL_SERVER_ERROR', 'Unable to generate artifact export', 500);
  }
}
