import React from 'react';
import { ArrowRight, ShieldCheck, Cpu, Code2, Globe } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col justify-between">
      {/* Navigation Header */}
      <header className="border-b border-cream-300 bg-white/80 backdrop-blur-none px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo variant="full" size="sm" asLink />

          <div className="flex items-center space-x-4">
            <a
              href="/design-system"
              className="text-xs font-medium text-navy-500 hover:text-coral-500 transition"
            >
              Design System
            </a>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cream-200 text-navy-600 border border-cream-300">
              Phase 2 Operational
            </span>
            <a
              href="/api/health"
              className="text-xs font-mono text-navy-400 hover:text-navy-600 transition"
              target="_blank"
              rel="noreferrer"
            >
              /api/health
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center justify-center px-3 py-1 mb-6 rounded-full text-xs font-medium bg-coral-50 text-coral-600 border border-coral-200 self-center">
          Reverse-Engineer Any Web Interface into Clean Code
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-navy-500 mb-6">
          Controlled Website Inspection &amp; Reconstruction Blueprints
        </h1>

        <p className="text-lg text-navy-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          RebuildIQ inspects accessible websites using sandboxed browser automation, captures empirical visual ground truth, and synthesizes implementation-ready prompt packages for Antigravity.
        </p>

        {/* Input Bar */}
        <div className="max-w-2xl mx-auto w-full bg-white rounded-lg border border-cream-300 p-2 shadow-sm flex items-center space-x-2">
          <div className="pl-3 text-navy-300">
            <Globe className="w-5 h-5" />
          </div>
          <input
            type="url"
            placeholder="https://example.com"
            disabled
            className="flex-1 px-3 py-2 text-sm text-navy-500 placeholder-navy-300 bg-transparent focus:outline-none"
            defaultValue="https://rebuildiq.dev (UI Available in Phase 5)"
          />
          <button
            type="button"
            disabled
            className="px-5 py-2.5 rounded bg-coral-500 hover:bg-coral-600 text-white font-medium text-sm flex items-center space-x-2 transition opacity-90 cursor-not-allowed"
          >
            <span>Analyze Site</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Feature Signals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 text-left">
          <div className="bg-white rounded-lg border border-cream-300 p-5">
            <div className="w-8 h-8 rounded bg-navy-50 text-navy-500 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5 text-coral-500" />
            </div>
            <h3 className="font-semibold text-sm text-navy-500 mb-1">SSRF Firewall &amp; Isolation</h3>
            <p className="text-xs text-navy-400 leading-relaxed">
              Dual-layer pre-flight and socket route-level validation strictly blocking RFC 1918 and cloud metadata probes.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-cream-300 p-5">
            <div className="w-8 h-8 rounded bg-navy-50 text-navy-500 flex items-center justify-center mb-3">
              <Cpu className="w-5 h-5 text-coral-500" />
            </div>
            <h3 className="font-semibold text-sm text-navy-500 mb-1">Empirical Ground Truth</h3>
            <p className="text-xs text-navy-400 leading-relaxed">
              Extracts computed typography, color palettes, and responsive viewports without conflating facts with AI inferences.
            </p>
          </div>

          <div className="bg-white rounded-lg border border-cream-300 p-5">
            <div className="w-8 h-8 rounded bg-navy-50 text-navy-500 flex items-center justify-center mb-3">
              <Code2 className="w-5 h-5 text-coral-500" />
            </div>
            <h3 className="font-semibold text-sm text-navy-500 mb-1">Antigravity Prompt Packs</h3>
            <p className="text-xs text-navy-400 leading-relaxed">
              Structured 4-phase prompt synthesizers that feed directly into AI coding tools with verified design tokens.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-cream-300 bg-white py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-navy-400">
          <Logo variant="horizontal" size="xs" asLink />
          <p>&copy; {new Date().getFullYear()} RebuildIQ. Built for production-grade website reconstruction.</p>
        </div>
      </footer>
    </main>
  );
}
