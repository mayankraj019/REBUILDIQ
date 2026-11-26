'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ForgotPasswordInputSchema } from '@/lib/auth/schemas';

export const ForgotPasswordForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const parsed = ForgotPasswordInputSchema.safeParse({ email });
    if (!parsed.success) {
      setFieldError(parsed.error.flatten().fieldErrors.email?.[0]);
      return;
    }

    setFieldError(undefined);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setServerError(
          payload?.error?.message || 'Unable to process recovery request right now.'
        );
        setIsLoading(false);
        return;
      }

      setSubmittedMessage(
        payload.data?.message ||
          'If an account matches this email address, password recovery instructions have been sent.'
      );
    } catch {
      setServerError('Network error while connecting to password recovery service.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submittedMessage) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Check your inbox">
          {submittedMessage} Use the single-use recovery link sent to your inbox to set a new password.
        </Alert>

        <Link href="/login" className="block">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Return to Sign In
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="error" title="Recovery request failed" onClose={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <Input
        label="Account Email Address"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        leftIcon={<Mail className="w-4 h-4" />}
        errorMessage={fieldError}
        disabled={isLoading}
      />

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        rightIcon={<ArrowRight className="w-4 h-4" />}
        className="w-full"
      >
        Send Recovery Link
      </Button>

      <div className="pt-2 text-center text-xs text-navy-400">
        Remembered your password?{' '}
        <Link
          href="/login"
          className="font-semibold text-coral-600 hover:text-coral-700 underline underline-offset-2"
        >
          Back to sign in
        </Link>
      </div>
    </form>
  );
};
