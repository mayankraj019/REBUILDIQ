'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  Cpu,
  MousePointerClick,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  FileCode2,
} from 'lucide-react';
import { AnalysisJobDetail, ComponentNode } from '@/lib/analysis/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Tabs } from '@/components/ui/Tabs';

export interface BlueprintViewerViewProps {
  job: AnalysisJobDetail;
}

const ComponentTreeNode: React.FC<{ node: ComponentNode; depth?: number }> = ({
  node,
  depth = 0,
}) => {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = Boolean(node.children && node.children.length > 0);

  return (
    <div className={depth > 0 ? 'ml-5 pl-4 border-l border-cream-300 mt-2' : ''}>
      <div className="p-4 rounded-md border border-cream-300 bg-cream-50/40 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center space-x-2">
            {hasChildren && (
              <button
                type="button"
                onClick={() => setExpanded((prev) => !prev)}
                aria-expanded={expanded}
                aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.name}`}
                className="p-0.5 rounded text-navy-400 hover:text-navy-500 hover:bg-cream-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
              >
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            )}
            <code className="text-sm font-bold text-navy-500 font-mono">
              &lt;{node.name} /&gt;
            </code>
          </div>
          <span className="text-[11px] font-mono text-navy-400 bg-white px-2 py-0.5 rounded border border-cream-200">
            {node.observedSource}
          </span>
        </div>

        <p className="text-xs text-navy-400 leading-relaxed">{node.purpose}</p>

        {node.props.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {node.props.map((prop) => (
              <span
                key={prop}
                className="text-[11px] font-mono px-2 py-0.5 rounded bg-white border border-cream-300 text-navy-500"
              >
                {prop}
              </span>
            ))}
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <ComponentTreeNode key={child.name} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const BlueprintViewerView: React.FC<BlueprintViewerViewProps> = ({ job }) => {
  const [sectionTab, setSectionTab] = useState<'components' | 'tokens' | 'interactions' | 'stack'>(
    'components'
  );

  const blueprint = job.blueprint;

  if (!blueprint) {
    return (
      <EmptyState
        icon={<FileCode2 className="w-6 h-6 text-navy-400" />}
        title="No blueprint artifact generated yet"
        description="Structured reconstruction blueprints are synthesized after browser evidence extraction finishes in the AI pipeline."
        actionLabel="Return to Details & Progress"
        onAction={() => {
          window.location.href = `/analysis/${job.id}`;
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Blueprint Intro Header */}
      <section className="bg-white rounded-lg border border-cream-300 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-navy-500">
                Reconstruction Blueprint
              </h2>
              <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                AI-Inferred Architecture
              </span>
              <span className="text-xs font-mono text-navy-400">
                v{blueprint.version}
              </span>
            </div>
            <p className="text-sm text-navy-400 mt-1.5 leading-relaxed max-w-3xl">
              {blueprint.summary}
            </p>
          </div>

          <div className="flex items-center space-x-2.5 shrink-0">
            <Link href={`/analysis/${job.id}/prompts`}>
              <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Open Prompt Editor
              </Button>
            </Link>
          </div>
        </div>

        <Tabs
          activeTab={sectionTab}
          onChange={(t) => setSectionTab(t as typeof sectionTab)}
          tabs={[
            {
              id: 'components',
              label: 'Component Hierarchy',
              icon: <Layers className="w-3.5 h-3.5" />,
              count: blueprint.components.length,
            },
            {
              id: 'tokens',
              label: 'Design Tokens',
              icon: <FileCode2 className="w-3.5 h-3.5" />,
              count: blueprint.designTokens.colors.length,
            },
            {
              id: 'interactions',
              label: 'State & Interactions',
              icon: <MousePointerClick className="w-3.5 h-3.5" />,
              count: blueprint.interactions.length,
            },
            {
              id: 'stack',
              label: 'Recommended Stack',
              icon: <Cpu className="w-3.5 h-3.5" />,
              count: blueprint.recommendedStack.length,
            },
          ]}
        />

        {/* Components View */}
        {sectionTab === 'components' && (
          <div className="space-y-3 pt-2">
            {blueprint.components.map((comp) => (
              <ComponentTreeNode key={comp.name} node={comp} />
            ))}
          </div>
        )}

        {/* Design Tokens View */}
        {sectionTab === 'tokens' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                Semantic Color System
              </h3>
              <div className="border border-cream-200 rounded-md divide-y divide-cream-200">
                {blueprint.designTokens.colors.map((c) => (
                  <div key={c.name} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      <span
                        className="w-6 h-6 rounded border border-cream-400 shrink-0"
                        style={{ backgroundColor: c.hex }}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-xs font-mono font-bold text-navy-500">{c.name}</p>
                        <p className="text-xs text-navy-400">{c.role}</p>
                      </div>
                    </div>
                    <code className="text-xs font-mono text-navy-500">{c.hex}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-navy-400">
                  Typography Scale Tokens
                </h3>
                <div className="border border-cream-200 rounded-md divide-y divide-cream-200">
                  {blueprint.designTokens.typography.map((t) => (
                    <div key={t.token} className="p-3.5 flex items-center justify-between text-xs gap-2">
                      <div>
                        <code className="font-mono font-bold text-navy-500">{t.token}</code>
                        <p className="text-navy-400">{t.font}</p>
                      </div>
                      <span className="font-mono text-navy-500">
                        {t.size} &middot; w{t.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-md border border-cream-200 bg-cream-50/50 space-y-2 text-xs">
                <p className="font-semibold text-navy-500">
                  Spacing Scale:{' '}
                  <span className="font-mono font-normal text-navy-400">
                    {blueprint.designTokens.spacingScale.join(' / ')}
                  </span>
                </p>
                <p className="font-semibold text-navy-500">
                  Corner Radii:{' '}
                  <span className="font-mono font-normal text-navy-400">
                    {blueprint.designTokens.radii.join(' / ')}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Interactions View */}
        {sectionTab === 'interactions' && (
          <div className="border border-cream-200 rounded-md divide-y divide-cream-200 mt-2">
            {blueprint.interactions.map((spec, idx) => (
              <div key={idx} className="p-4 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-navy-500">{spec.component}</span>
                  <span className="text-xs font-mono text-coral-600">
                    Trigger: {spec.trigger}
                  </span>
                </div>
                <p className="text-xs text-navy-500">{spec.expectedState}</p>
                <p className="text-xs text-navy-400">
                  <strong className="text-navy-500">A11y:</strong> {spec.accessibilityNote}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Recommended Stack View */}
        {sectionTab === 'stack' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {blueprint.recommendedStack.map((item) => (
              <div
                key={item.layer}
                className="p-4 rounded-md border border-cream-300 bg-cream-50/40 space-y-1.5"
              >
                <span className="text-[11px] font-mono uppercase tracking-wider text-navy-400">
                  {item.layer}
                </span>
                <h3 className="text-sm font-bold text-navy-500">{item.choice}</h3>
                <p className="text-xs text-navy-400 leading-relaxed">{item.rationale}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
