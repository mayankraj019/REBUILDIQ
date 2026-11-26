'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { detectObviousPrivateHost } from '@/lib/analysis/types';

export interface LandingQuickFormProps {
  isAuthenticated: boolean;
}

export const LandingQuickForm: React.FC<LandingQuickFormProps> = ({ isAuthenticated }) => {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError('Enter a public website URL (for example, https://example.com).');
      return;
    }

    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
      const parsed = new URL(normalized);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('Only HTTP and HTTPS protocols are permitted.');
        return;
      }
    } catch {
      setError('Please enter a valid website URL.');
      return;
    }

    const privateWarning = detectObviousPrivateHost(normalized);
    if (privateWarning) {
      setError(privateWarning);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const targetPath = `/analysis/new?url=${encodeURIComponent(normalized)}`;
    if (isAuthenticated) {
      router.push(targetPath);
    } else {
      router.push(`/login?next=${encodeURIComponent(targetPath)}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="max-w-2xl mx-auto w-full text-left">
      <div
        className={`bg-white rounded-lg border p-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 transition-colors ${
          error
            ? 'border-red-400 focus-within:border-red-500'
            : 'border-cream-300 focus-within:border-navy-500'
        }`}
      >
        <label htmlFor="landing-target-url" className="sr-only">
          Website URL to analyze
        </label>
        <div className="flex items-center flex-1 px-2">
          <Globe className="w-5 h-5 text-navy-300 shrink-0 mr-2.5" aria-hidden="true" />
          <input
            id="landing-target-url"
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            placeholder="https://example.com"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'landing-url-error' : undefined}
            className="w-full py-2 text-sm text-navy-500 placeholder-navy-300 bg-transparent focus:outline-none"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isSubmitting}
          rightIcon={<ArrowRight className="w-4 h-4" />}
          className="shrink-0"
        >
          Analyze Website
        </Button>
      </div>

      {error && (
        <p
          id="landing-url-error"
          role="alert"
          className="mt-2 text-xs font-medium text-red-600 px-1"
        >
          {error}
        </p>
      )}
    </form>
  );
};
