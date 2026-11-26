import React from 'react';
import Link from 'next/link';
import { SearchX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export default function AnalysisNotFoundPage() {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-500 flex flex-col justify-between">
      <header className="border-b border-cream-300 bg-white px-6 h-16 flex items-center">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <Logo variant="full" size="sm" asLink href="/dashboard" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full bg-white rounded-lg border border-cream-300 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-cream-100 border border-cream-300 flex items-center justify-center mx-auto mb-5">
            <SearchX className="w-6 h-6 text-coral-500" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-navy-500 mb-2">Analysis not found</h1>
          <p className="text-sm text-navy-400 leading-relaxed mb-6">
            This analysis ID does not exist in your workspace or you do not have permission to view it.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <Link href="/history">
              <Button variant="primary" size="md">
                Back to History
              </Button>
            </Link>
            <Link href="/analysis/preview">
              <Button variant="outline" size="md">
                Open UI Preview
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-navy-400">RebuildIQ</footer>
    </div>
  );
}
