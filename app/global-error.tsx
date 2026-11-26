'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F4EDE0] text-[#14213D] antialiased flex items-center justify-center px-6">
        <div
          role="alert"
          className="max-w-md w-full bg-white rounded-lg border border-[#E2D7C3] p-8 text-center"
        >
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-[#14213D] mb-2">Critical Application Error</h1>
          <p className="text-sm text-[#4D6EA8] mb-6 leading-relaxed">
            RebuildIQ encountered an unrecoverable layout error. Reload this view to restore your workspace.
          </p>
          {error.digest && (
            <p className="text-xs font-mono text-[#4D6EA8] mb-5">Digest: {error.digest}</p>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-md bg-[#FF6B5B] text-white text-sm font-medium hover:bg-[#E65646] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reload Interface</span>
            </button>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 rounded-md border border-[#E2D7C3] bg-white text-[#14213D] text-sm font-medium hover:bg-[#FAF7F2] transition-colors"
            >
              Go Home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
