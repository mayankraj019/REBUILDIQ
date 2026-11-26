'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { Button } from '@/components/ui/Button';

export default function ApplicationError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Application boundary caught error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-cream-100 text-navy-500 flex flex-col justify-between">
      <header className="border-b border-cream-300 bg-white px-6 h-16 flex items-center">
        <div className="max-w-6xl w-full mx-auto flex items-center justify-between">
          <Logo variant="full" size="sm" asLink href="/" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div
          role="alert"
          className="max-w-lg w-full bg-white rounded-lg border border-cream-300 p-8 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>

          <p className="text-xs font-mono uppercase tracking-widest text-red-600 font-semibold mb-2">
            Application Error
          </p>
          <h1 className="text-2xl font-bold text-navy-500 mb-3">
            Something went wrong while rendering this view
          </h1>
          <p className="text-sm text-navy-400 leading-relaxed mb-6">
            An unexpected error interrupted this screen. Your saved account and analysis data remain safe.
          </p>

          {error.digest && (
            <p className="text-xs font-mono text-navy-400 bg-cream-50 border border-cream-300 rounded px-3 py-2 mb-6">
              Reference ID: {error.digest}
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              leftIcon={<RotateCcw className="w-4 h-4" />}
              onClick={reset}
              className="w-full sm:w-auto"
            >
              Try again
            </Button>
            <Link href="/dashboard" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="md"
                leftIcon={<Home className="w-4 h-4" />}
                className="w-full"
              >
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-navy-400">
        RebuildIQ — Application Error Boundary
      </footer>
    </div>
  );
}
