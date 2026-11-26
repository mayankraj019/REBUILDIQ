'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Monitor,
  Tablet,
  Smartphone,
  ShieldAlert,
  ShieldCheck,
  ArrowRight,
  Info,
} from 'lucide-react';
import {
  CreateAnalysisFormSchema,
  ViewportPreset,
  detectObviousPrivateHost,
} from '@/lib/analysis/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';

export interface NewAnalysisFormProps {
  initialUrl?: string;
}

const VIEWPORT_OPTIONS: Array<{
  id: ViewportPreset;
  label: string;
  dimensions: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'desktop', label: 'Desktop', dimensions: '1280 × 800', icon: Monitor },
  { id: 'tablet', label: 'Tablet', dimensions: '768 × 1024', icon: Tablet },
  { id: 'mobile', label: 'Mobile', dimensions: '375 × 812', icon: Smartphone },
];

export const NewAnalysisForm: React.FC<NewAnalysisFormProps> = ({ initialUrl = '' }) => {
  const [targetUrl, setTargetUrl] = useState(initialUrl);
  const [crawlDepth, setCrawlDepth] = useState<number>(1);
  const [viewports, setViewports] = useState<ViewportPreset[]>(['desktop', 'tablet', 'mobile']);

  const [urlError, setUrlError] = useState<string | null>(null);
  const [viewportError, setViewportError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{
    type: 'disconnected' | 'error';
    message: string;
  } | null>(null);

  const privateHostWarning = targetUrl.trim()
    ? detectObviousPrivateHost(
        /^https?:\/\//i.test(targetUrl.trim()) ? targetUrl.trim() : `https://${targetUrl.trim()}`
      )
    : null;

  const toggleViewport = (vp: ViewportPreset) => {
    setViewportError(null);
    setViewports((prev) =>
      prev.includes(vp) ? prev.filter((item) => item !== vp) : [...prev, vp]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackendStatus(null);

    const rawTrimmed = targetUrl.trim();
    const normalized =
      rawTrimmed && !/^https?:\/\//i.test(rawTrimmed) && !rawTrimmed.includes('://')
        ? `https://${rawTrimmed}`
        : rawTrimmed;

    const parsed = CreateAnalysisFormSchema.safeParse({
      targetUrl: normalized,
      crawlDepth,
      viewports,
    });

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setUrlError(flat.targetUrl?.[0] ?? null);
      setViewportError(flat.viewports?.[0] ?? null);
      return;
    }

    const ssrfWarning = detectObviousPrivateHost(parsed.data.targetUrl);
    if (ssrfWarning) {
      setUrlError(ssrfWarning);
      return;
    }

    setUrlError(null);
    setViewportError(null);
    setTargetUrl(parsed.data.targetUrl);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      if (res.status === 404 || res.status === 501) {
        setBackendStatus({
          type: 'disconnected',
          message:
            'Your URL and crawl configuration passed pre-flight checks, but the background job API (POST /api/jobs) and Playwright worker are intentionally not connected yet (Phases 3–4).',
        });
        setIsSubmitting(false);
        return;
      }

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setBackendStatus({
          type: 'error',
          message:
            payload?.error?.message ||
            'Unable to enqueue analysis job. Check target URL policies and try again.',
        });
        setIsSubmitting(false);
        return;
      }

      // If /api/jobs is wired in a later phase, navigate directly to the created job
      if (payload?.data?.job?.id) {
        window.location.href = `/analysis/${payload.data.job.id}`;
      }
    } catch {
      setBackendStatus({
        type: 'disconnected',
        message:
          'Unable to reach /api/jobs. Live browser analysis execution is scheduled for Phase 3/4.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-500">
          Create Website Analysis
        </h1>
        <p className="text-sm text-navy-400 mt-1">
          Enter any publicly accessible HTTP or HTTPS URL to configure an isolated browser inspection.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white rounded-lg border border-cream-300 p-6 sm:p-8 space-y-6"
      >
        {/* Target URL Input */}
        <div className="space-y-2">
          <Input
            label="Target Website URL"
            type="url"
            name="targetUrl"
            required
            autoFocus
            value={targetUrl}
            onChange={(e) => {
              setTargetUrl(e.target.value);
              if (urlError) setUrlError(null);
              if (backendStatus) setBackendStatus(null);
            }}
            placeholder="https://example.com"
            leftIcon={<Globe className="w-4 h-4" />}
            errorMessage={urlError || undefined}
            helperText="Only public web routes on standard ports (80, 443, 8080, 8443) are accepted."
            disabled={isSubmitting}
          />

          {privateHostWarning && !urlError && (
            <div
              role="alert"
              className="flex items-start space-x-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-900"
            >
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{privateHostWarning}</span>
            </div>
          )}
        </div>

        {/* Viewports Selector */}
        <fieldset className="space-y-2.5">
          <legend className="text-xs font-semibold uppercase tracking-wider text-navy-500">
            Capture Viewports
          </legend>
          <p className="text-xs text-navy-400">
            Select responsive viewport sizes to inspect and extract CSS layout behavior.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {VIEWPORT_OPTIONS.map((vp) => {
              const Icon = vp.icon;
              const checked = viewports.includes(vp.id);

              return (
                <label
                  key={vp.id}
                  className={`flex items-start space-x-3 p-3.5 rounded-md border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-navy-500 ${
                    checked
                      ? 'border-navy-500 bg-cream-50/70'
                      : 'border-cream-300 bg-white hover:border-cream-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleViewport(vp.id)}
                    disabled={isSubmitting}
                    className="mt-0.5 rounded border-cream-400 text-coral-500 focus:ring-navy-500"
                  />
                  <div>
                    <div className="flex items-center space-x-1.5">
                      <Icon className="w-3.5 h-3.5 text-navy-500" aria-hidden="true" />
                      <span className="text-sm font-semibold text-navy-500">{vp.label}</span>
                    </div>
                    <span className="text-[11px] font-mono text-navy-400 block mt-0.5">
                      {vp.dimensions}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {viewportError && (
            <p role="alert" className="text-xs text-red-600 font-medium">
              {viewportError}
            </p>
          )}
        </fieldset>

        {/* Crawl Depth */}
        <Select
          label="Crawl Scope"
          name="crawlDepth"
          value={String(crawlDepth)}
          onChange={(e) => setCrawlDepth(Number(e.target.value))}
          disabled={isSubmitting}
          helperText="Single page mode yields fastest inspection (< 30s) and focused blueprint output."
          options={[
            { value: '1', label: 'Single page only (Submitted URL)' },
            { value: '2', label: 'Shallow crawl (Up to 2 linked same-domain pages)' },
            { value: '3', label: 'Standard crawl (Up to 3 linked same-domain pages)' },
            { value: '5', label: 'Expanded crawl (Max 5 linked same-domain pages)' },
          ]}
        />

        {/* SSRF Guardrail Disclosure */}
        <div className="flex items-start space-x-2.5 p-3.5 rounded-md bg-cream-50 border border-cream-300 text-xs text-navy-400">
          <ShieldCheck className="w-4 h-4 text-navy-500 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            Every target URL is screened against private IP ranges, loopback interfaces, and cloud metadata endpoints before launch, and never attempts CAPTCHA bypass or authenticated crawling.
          </p>
        </div>

        {/* Submission Result / Disconnected Backend Feedback */}
        {backendStatus?.type === 'disconnected' && (
          <Alert variant="warning" title="Analysis queue not yet connected (Phases 3–4)">
            <p className="mb-2.5">{backendStatus.message}</p>
            <Link
              href="/analysis/preview"
              className="inline-flex items-center space-x-1 font-semibold text-navy-500 underline underline-offset-2 hover:text-coral-600"
            >
              <span>Inspect the Sample UI Preview Workspace instead</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </Alert>
        )}

        {backendStatus?.type === 'error' && (
          <Alert variant="error" title="Could not start analysis">
            {backendStatus.message}
          </Alert>
        )}

        {/* Submit Actions */}
        <div className="pt-2 border-t border-cream-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link href="/dashboard" className="text-xs font-medium text-navy-400 hover:text-navy-500">
            &larr; Cancel and return to Dashboard
          </Link>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={isSubmitting}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Validate &amp; Start Analysis
          </Button>
        </div>
      </form>

      <div className="flex items-start space-x-2 text-xs text-navy-400 px-1">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-navy-400" aria-hidden="true" />
        <span>
          Form validation and SSRF host detection are live. Job submission connects to <code className="font-mono">POST /api/jobs</code> once the background worker phase is implemented.
        </span>
      </div>
    </div>
  );
};
