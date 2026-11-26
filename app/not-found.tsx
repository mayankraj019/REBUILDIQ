import React from 'react';
import Link from 'next/link';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-cream-100 text-navy-500 flex flex-col justify-between">
      <header className="border-b border-cream-300 bg-white px-6 h-16 flex items-center">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <Logo variant="full" size="sm" asLink href="/" />
          <Link
            href="/dashboard"
            className="text-sm font-medium text-navy-500 hover:text-coral-500 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-md w-full bg-white rounded-lg border border-cream-300 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-cream-100 border border-cream-300 text-navy-500 flex items-center justify-center mx-auto mb-5">
            <SearchX className="w-6 h-6 text-coral-500" aria-hidden="true" />
          </div>

          <p className="text-xs font-mono uppercase tracking-widest text-coral-500 font-semibold mb-2">
            Error 404
          </p>
          <h1 className="text-2xl font-bold text-navy-500 mb-3">
            Page or analysis not found
          </h1>
          <p className="text-sm text-navy-400 leading-relaxed mb-8">
            The resource you requested does not exist, may have been deleted, or belongs to a different account session.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button variant="primary" size="md" className="w-full">
                Go to Dashboard
              </Button>
            </Link>
            <Link href="/" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="md"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
                className="w-full"
              >
                Back Home
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-navy-400">
        RebuildIQ — Application Recovery
      </footer>
    </div>
  );
}
