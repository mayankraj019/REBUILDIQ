import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Layers, Code2, ArrowRight, Eye } from 'lucide-react';
import { getServerSession } from '@/lib/auth/server';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { LandingQuickForm } from '@/components/landing/LandingQuickForm';
import { Logo } from '@/components/ui/Logo';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const session = await getServerSession();

  return (
    <div className="min-h-screen flex flex-col justify-between bg-cream-100 text-navy-500">
      <PublicHeader user={session?.user ?? null} />

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pt-16 pb-16 sm:pt-24 sm:pb-20 text-center">
          <p className="text-xs font-mono uppercase tracking-widest text-coral-600 font-semibold mb-4">
            Website Architecture &amp; Reconstruction Intelligence
          </p>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-navy-500 leading-[1.12] mb-6">
            Inspect any public web interface.
            <br className="hidden sm:inline" /> Generate its rebuild blueprint.
          </h1>

          <p className="text-base sm:text-lg text-navy-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            RebuildIQ runs isolated browser inspections to capture verified DOM structure and computed styles, then synthesizes implementation blueprints and phased Antigravity prompts without conflating facts with AI guesses.
          </p>

          <LandingQuickForm isAuthenticated={Boolean(session)} />

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-navy-400">
            <Link
              href={session ? '/analysis/preview' : '/register'}
              className="inline-flex items-center space-x-1.5 font-medium text-navy-500 hover:text-coral-500 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{session ? 'Inspect Sample Workspace Preview' : 'Create free account'}</span>
              <ArrowRight className="w-3 h-3" aria-hidden="true" />
            </Link>
            <span aria-hidden="true" className="text-cream-400">|</span>
            <Link
              href="/api/health"
              target="_blank"
              rel="noreferrer"
              className="font-mono hover:text-navy-500 transition-colors"
            >
              System Health: /api/health
            </Link>
          </div>
        </section>

        {/* Workflow Band */}
        <section
          id="workflow"
          className="border-t border-cream-300 bg-white py-16 sm:py-20 px-4 sm:px-6"
        >
          <div className="max-w-5xl mx-auto">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-mono uppercase tracking-wider text-coral-500 font-semibold mb-2">
                Three-Stage Pipeline
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-navy-500">
                Built for deterministic frontend reverse-engineering
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
              <div className="space-y-3">
                <div className="w-9 h-9 rounded-md bg-cream-100 border border-cream-300 flex items-center justify-center text-navy-500">
                  <ShieldCheck className="w-4 h-4 text-coral-500" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-navy-500">
                  1. Controlled Browser Capture
                </h3>
                <p className="text-sm text-navy-400 leading-relaxed">
                  Target URLs pass pre-flight DNS checks and route-level SSRF filtering before Chromium extracts computed fonts, colors, spacing, and mobile/tablet/desktop screenshots.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-9 h-9 rounded-md bg-cream-100 border border-cream-300 flex items-center justify-center text-navy-500">
                  <Layers className="w-4 h-4 text-coral-500" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-navy-500">
                  2. Ground-Truth Separation
                </h3>
                <p className="text-sm text-navy-400 leading-relaxed">
                  Empirical page evidence is isolated from LLM hypotheses inside strict schema boundaries so engineers always know what was measured vs. what is recommended.
                </p>
              </div>

              <div className="space-y-3">
                <div className="w-9 h-9 rounded-md bg-cream-100 border border-cream-300 flex items-center justify-center text-navy-500">
                  <Code2 className="w-4 h-4 text-coral-500" aria-hidden="true" />
                </div>
                <h3 className="text-base font-bold text-navy-500">
                  3. Phased Antigravity Prompts
                </h3>
                <p className="text-sm text-navy-400 leading-relaxed">
                  Review inferred component hierarchies, edit phase prompts directly, and export Tailwind tokens, Markdown blueprints, or raw JSON bundles.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Observed vs Inference Contrast Band */}
        <section
          id="evidence-vs-inference"
          className="border-t border-cream-300 bg-cream-100 py-16 sm:py-20 px-4 sm:px-6"
        >
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-navy-400 font-semibold mb-2">
                Architectural Boundary
              </p>
              <h2 className="text-2xl font-bold text-navy-500 mb-4">
                Zero ambiguity between fact and suggestion
              </h2>
              <p className="text-sm text-navy-400 leading-relaxed mb-6">
                Every analysis workspace separates verifiable measurements from AI architectural inference. Even while browser workers and AI synthesizers are being completed in upcoming backend phases, the interface never presents sample fixture data as a real scan.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href={session ? '/dashboard' : '/login'}
                  className="text-sm font-semibold text-coral-600 hover:text-coral-700 inline-flex items-center space-x-1.5"
                >
                  <span>{session ? 'Open your workspace' : 'Sign in to workspace'}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-cream-300 divide-y divide-cream-200">
              <div className="p-5">
                <span className="inline-block text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
                  Observed Ground Truth
                </span>
                <p className="text-sm text-navy-500 font-medium">
                  Computed CSS styles, DOM hierarchy depth, palette hex frequencies, viewport dimensions, and captured page titles.
                </p>
              </div>
              <div className="p-5">
                <span className="inline-block text-[11px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 mb-2">
                  AI-Inferred Blueprint
                </span>
                <p className="text-sm text-navy-500 font-medium">
                  Component boundary decompositions, recommended stack pairings, state specs, and phased implementation prompts.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-cream-300 bg-white py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-navy-400">
          <Logo variant="horizontal" size="xs" asLink href="/" />
          <div className="flex items-center space-x-5">
            <Link href="/design-system" className="hover:text-navy-500 transition-colors">
              Design System
            </Link>
            <Link href="/login" className="hover:text-navy-500 transition-colors">
              Sign in
            </Link>
            <span>&copy; {new Date().getFullYear()} RebuildIQ</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
