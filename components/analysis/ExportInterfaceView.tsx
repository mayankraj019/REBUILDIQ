'use client';

import React, { useMemo, useState } from 'react';
import { Download, Copy, Check, FileText, FileCode2, FileJson, Archive } from 'lucide-react';
import { AnalysisJobDetail } from '@/lib/analysis/types';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';

export interface ExportInterfaceViewProps {
  job: AnalysisJobDetail;
}

type ExportFormatId = 'prompts-md' | 'blueprint-md' | 'blueprint-json' | 'tailwind-ts' | 'evidence-json';

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export const ExportInterfaceView: React.FC<ExportInterfaceViewProps> = ({ job }) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>('prompts-md');
  const [copied, setCopied] = useState(false);
  const [zipMessage, setZipMessage] = useState<string | null>(null);

  const artifacts = useMemo(() => {
    const bp = job.blueprint;
    const prefix = job.isPreviewFixture ? 'sample-preview' : job.normalizedDomain;

    const promptsMd = bp
      ? bp.rawAntigravityMarkdown
      : '# No prompts generated yet';

    const blueprintMd = bp
      ? [
          `# RebuildIQ Reconstruction Blueprint: ${job.normalizedDomain}`,
          `Target URL: ${job.targetUrl}`,
          job.isPreviewFixture ? '> Note: Sample UI Preview Fixture (Not a real scan)' : '',
          '',
          '## Summary',
          bp.summary,
          '',
          '## Component Hierarchy',
          ...bp.components.map(
            (c) => `- **${c.name}** (${c.observedSource}): ${c.purpose}`
          ),
          '',
          '## Recommended Stack',
          ...bp.recommendedStack.map(
            (s) => `- **${s.layer}**: ${s.choice} — ${s.rationale}`
          ),
        ]
          .filter(Boolean)
          .join('\n')
      : '# Blueprint unavailable';

    const blueprintJson = JSON.stringify(
      {
        meta: {
          jobId: job.id,
          targetUrl: job.targetUrl,
          isPreviewFixture: Boolean(job.isPreviewFixture),
          exportedAt: new Date().toISOString(),
        },
        blueprint: bp,
      },
      null,
      2
    );

    const colorObjectLines =
      bp?.designTokens.colors
        .map((c) => `        '${c.name}': '${c.hex}', // ${c.role}`)
        .join('\n') || '';

    const tailwindTs = `import type { Config } from 'tailwindcss';

// Synthesized by RebuildIQ (${job.isPreviewFixture ? 'Sample Preview Fixture' : job.normalizedDomain})
const config: Partial<Config> = {
  theme: {
    extend: {
      colors: {
${colorObjectLines}
      },
    },
  },
};

export default config;`;

    const evidenceJson = JSON.stringify(
      {
        meta: {
          jobId: job.id,
          classification: 'OBSERVED_GROUND_TRUTH',
          isPreviewFixture: Boolean(job.isPreviewFixture),
        },
        evidence: job.evidence,
      },
      null,
      2
    );

    return {
      'prompts-md': {
        id: 'prompts-md' as const,
        filename: `${prefix}-antigravity-prompts.md`,
        title: 'Antigravity Prompt Pack (.md)',
        description: 'Complete 4-phase sequential implementation prompt suite.',
        mime: 'text/markdown;charset=utf-8',
        icon: FileText,
        content: promptsMd,
      },
      'blueprint-md': {
        id: 'blueprint-md' as const,
        filename: `${prefix}-blueprint.md`,
        title: 'Architecture Blueprint (.md)',
        description: 'Human-readable summary, components, and stack rationale.',
        mime: 'text/markdown;charset=utf-8',
        icon: FileText,
        content: blueprintMd,
      },
      'blueprint-json': {
        id: 'blueprint-json' as const,
        filename: `${prefix}-blueprint.json`,
        title: 'Structured Blueprint (.json)',
        description: 'Schema-validated machine-readable architecture specification.',
        mime: 'application/json;charset=utf-8',
        icon: FileJson,
        content: blueprintJson,
      },
      'tailwind-ts': {
        id: 'tailwind-ts' as const,
        filename: 'tailwind.theme.ts',
        title: 'Tailwind Theme Tokens (.ts)',
        description: 'Extracted brand & surface color configuration.',
        mime: 'text/typescript;charset=utf-8',
        icon: FileCode2,
        content: tailwindTs,
      },
      'evidence-json': {
        id: 'evidence-json' as const,
        filename: `${prefix}-observed-evidence.json`,
        title: 'Observed Evidence Bundle (.json)',
        description: 'Measured DOM landmarks, typography, palette frequencies, and spacing.',
        mime: 'application/json;charset=utf-8',
        icon: FileJson,
        content: evidenceJson,
      },
    };
  }, [job]);

  if (!job.blueprint && job.evidence.length === 0) {
    return (
      <EmptyState
        icon={<Download className="w-6 h-6 text-navy-400" />}
        title="No exportable artifacts ready"
        description="Complete an inspection and blueprint generation before exporting artifacts."
        actionLabel="Return to Details"
        onAction={() => {
          window.location.href = `/analysis/${job.id}`;
        }}
      />
    );
  }

  const activeArtifact = artifacts[selectedFormat];

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(activeArtifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setZipMessage('Clipboard unavailable in this browser session.');
    }
  };

  const handleServerZipRequest = async () => {
    setZipMessage(null);
    try {
      const res = await fetch(`/api/jobs/${job.id}/export?format=zip`);
      if (!res.ok) {
        setZipMessage(
          'Server-generated ZIP & pre-signed screenshot bundle (GET /api/jobs/[id]/export) is awaiting Phase 3/4 storage integration. Use individual artifact downloads on the left now.'
        );
        return;
      }
      window.location.href = `/api/jobs/${job.id}/export?format=zip`;
    } catch {
      setZipMessage(
        'Server-generated ZIP export is disconnected until Phase 3/4 storage endpoints are built.'
      );
    }
  };

  return (
    <div className="space-y-6">
      {zipMessage && (
        <Alert variant="warning" title="Server Bundle Disconnected" onClose={() => setZipMessage(null)}>
          {zipMessage}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Format Selector */}
        <div className="lg:col-span-5 space-y-3">
          <div className="bg-white rounded-lg border border-cream-300 divide-y divide-cream-200">
            {(Object.keys(artifacts) as ExportFormatId[]).map((key) => {
              const item = artifacts[key];
              const Icon = item.icon;
              const isSelected = selectedFormat === key;

              return (
                <div
                  key={key}
                  className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-cream-50' : 'hover:bg-cream-50/40'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedFormat(key)}
                    className="text-left flex items-start space-x-3 flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 rounded"
                  >
                    <Icon
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        isSelected ? 'text-coral-500' : 'text-navy-400'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy-500">{item.title}</p>
                      <p className="text-xs text-navy-400 mt-0.5">{item.description}</p>
                    </div>
                  </button>

                  <Button
                    variant={isSelected ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => downloadTextFile(item.filename, item.content, item.mime)}
                    aria-label={`Download ${item.filename}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Disconnected ZIP Bundle Option */}
          <div className="bg-white rounded-lg border border-cream-300 p-4 flex items-center justify-between gap-3">
            <div className="flex items-start space-x-3">
              <Archive className="w-4 h-4 text-navy-400 mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold text-navy-500">
                  Full Archive + Screenshots (.zip)
                </p>
                <p className="text-[11px] text-navy-400">
                  Server-side archive route awaiting Phase 3/4 object storage.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleServerZipRequest}>
              Check ZIP
            </Button>
          </div>
        </div>

        {/* Live File Preview Pane */}
        <div className="lg:col-span-7 bg-white rounded-lg border border-cream-300 overflow-hidden">
          <div className="px-4 py-3 border-b border-cream-300 bg-cream-50/70 flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-xs font-semibold text-navy-500">
              {activeArtifact.filename}
            </span>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                onClick={handleCopyContent}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() =>
                  downloadTextFile(
                    activeArtifact.filename,
                    activeArtifact.content,
                    activeArtifact.mime
                  )
                }
              >
                Download File
              </Button>
            </div>
          </div>

          <pre className="p-4 sm:p-5 bg-navy-500 text-cream-100 font-mono text-xs leading-relaxed overflow-x-auto max-h-[540px]">
            <code>{activeArtifact.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
