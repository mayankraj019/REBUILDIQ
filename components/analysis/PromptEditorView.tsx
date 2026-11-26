'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Copy,
  Check,
  RotateCcw,
  Save,
  Terminal,
  ArrowRight,
} from 'lucide-react';
import { AnalysisJobDetail, PromptPhaseItem } from '@/lib/analysis/types';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';

export interface PromptEditorViewProps {
  job: AnalysisJobDetail;
}

export const PromptEditorView: React.FC<PromptEditorViewProps> = ({ job }) => {
  const initialPhases: PromptPhaseItem[] = job.blueprint?.prompts ?? [];
  const [phases, setPhases] = useState<PromptPhaseItem[]>(initialPhases);
  const [selectedPhaseNum, setSelectedPhaseNum] = useState<number>(
    initialPhases[0]?.phase ?? 1
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const draftStorageKey = `rebuildiq_prompt_draft_${job.id}`;

  useEffect(() => {
    try {
      const saved = window.sessionStorage.getItem(draftStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as PromptPhaseItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPhases(parsed);
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }, [draftStorageKey]);

  if (!job.blueprint || initialPhases.length === 0) {
    return (
      <EmptyState
        icon={<Terminal className="w-6 h-6 text-navy-400" />}
        title="No implementation prompts generated yet"
        description="Phased Antigravity prompts become editable here once the AI synthesis pipeline produces a blueprint."
        actionLabel="Return to Details"
        onAction={() => {
          window.location.href = `/analysis/${job.id}`;
        }}
      />
    );
  }

  const activePhase =
    phases.find((p) => p.phase === selectedPhaseNum) || phases[0];

  const handlePromptChange = (newValue: string) => {
    setSaveNotice(null);
    setPhases((prev) =>
      prev.map((item) =>
        item.phase === activePhase.phase ? { ...item, prompt: newValue } : item
      )
    );
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setSaveNotice('Clipboard copy unavailable in this browser context.');
    }
  };

  const handleReset = () => {
    setPhases(initialPhases);
    setSaveNotice('Reset all prompts back to original generated text.');
    try {
      window.sessionStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setSaveNotice(null);

    try {
      window.sessionStorage.setItem(draftStorageKey, JSON.stringify(phases));
    } catch {
      // Ignore
    }

    try {
      const res = await fetch(`/api/jobs/${job.id}/blueprint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          antigravityPrompts: phases.map((p) => p.prompt).join('\n\n---\n\n'),
        }),
      });

      if (res.ok) {
        setSaveNotice('Saved prompt edits to database.');
      } else {
        setSaveNotice(
          'Saved to your browser session draft. Server-side blueprint persistence (/api/jobs/[id]/blueprint) awaits Phases 3–4.'
        );
      }
    } catch {
      setSaveNotice(
        'Saved to your browser session draft. Server persistence awaits Phases 3–4.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const fullMarkdownPack = phases.map((p) => p.prompt).join('\n\n---\n\n');

  return (
    <div className="space-y-6">
      {saveNotice && (
        <Alert variant="info" onClose={() => setSaveNotice(null)}>
          {saveNotice}
        </Alert>
      )}

      <div className="bg-white rounded-lg border border-cream-300 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Phase Selector Rail */}
        <aside className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-cream-300 bg-cream-50/40 p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy-500">Prompt Sequence</h2>
            <span className="text-[11px] font-mono text-navy-400">
              {phases.length} phases
            </span>
          </div>

          <div className="space-y-2" role="tablist" aria-label="Prompt Phases">
            {phases.map((p) => {
              const isSelected = p.phase === activePhase.phase;
              return (
                <button
                  key={p.phase}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedPhaseNum(p.phase)}
                  className={`w-full text-left p-3 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 ${
                    isSelected
                      ? 'bg-white border-navy-500 shadow-sm'
                      : 'bg-white/60 border-cream-300 hover:bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-mono font-bold uppercase text-coral-600">
                      Phase {p.phase}
                    </span>
                    <span className="text-[11px] font-mono text-navy-400">
                      {p.prompt.length} chars
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-navy-500 line-clamp-1">
                    {p.title.replace(/^Phase \d+\s*[—-]\s*/i, '')}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-cream-200 space-y-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={copiedId === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              onClick={() => handleCopy(fullMarkdownPack, 'all')}
              className="w-full"
            >
              {copiedId === 'all' ? 'Copied Complete Pack' : 'Copy All 4 Phases'}
            </Button>

            <Link href={`/analysis/${job.id}/export`} className="block">
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                className="w-full"
              >
                Go to Export Screen
              </Button>
            </Link>
          </div>
        </aside>

        {/* Active Phase Editor */}
        <div className="lg:col-span-8 p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-navy-500">{activePhase.title}</h3>
              <p className="text-xs text-navy-400 mt-0.5">{activePhase.objective}</p>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                leftIcon={
                  copiedId === `phase-${activePhase.phase}` ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )
                }
                onClick={() =>
                  handleCopy(activePhase.prompt, `phase-${activePhase.phase}`)
                }
              >
                {copiedId === `phase-${activePhase.phase}` ? 'Copied' : 'Copy Phase'}
              </Button>
            </div>
          </div>

          <Textarea
            label="Implementation Prompt Markdown"
            value={activePhase.prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            rows={15}
            className="font-mono text-xs leading-relaxed bg-cream-50/30"
            helperText={`Lines: ${activePhase.prompt.split('\n').length} | Characters: ${activePhase.prompt.length} (Editable locally for tailored copy/export)`}
          />

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-cream-200">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={handleReset}
            >
              Reset Edits
            </Button>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              isLoading={isSaving}
              onClick={handleSaveDraft}
            >
              Save Draft
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
