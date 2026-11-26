'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, Check, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { RegisterInputSchema } from '@/lib/auth/schemas';

export interface RegisterFormProps {
  nextPath: string;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ nextPath }) => {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmationSentEmail, setConfirmationSentEmail] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checks = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase & lowercase letter', met: /[A-Z]/.test(password) && /[a-z]/.test(password) },
    { label: 'Number & special character', met: /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const parsed = RegisterInputSchema.safeParse({ name, email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        if (payload?.error?.details && typeof payload.error.details === 'object') {
          const d = payload.error.details as Record<string, string[]>;
          setFieldErrors({
            name: d.name?.[0],
            email: d.email?.[0],
            password: d.password?.[0],
          });
        }
        setServerError(
          payload?.error?.message || 'Unable to create your account. Please review the form.'
        );
        setIsLoading(false);
        return;
      }

      if (payload?.data?.requiresEmailConfirmation) {
        setConfirmationSentEmail(parsed.data.email);
        setIsLoading(false);
        return;
      }

      const safeNext =
        nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/dashboard';
      router.push(safeNext);
      router.refresh();
    } catch {
      setServerError('Network error while connecting to registration service.');
      setIsLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!confirmationSentEmail) return;
    setIsResending(true);
    setResendMessage(null);

    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: confirmationSentEmail }),
      });
      const payload = await res.json().catch(() => null);
      if (res.ok && payload?.success) {
        setResendMessage(payload.data?.message || 'Confirmation email re-sent.');
      } else {
        setResendMessage(payload?.error?.message || 'Unable to resend right now. Wait a moment.');
      }
    } catch {
      setResendMessage('Network error while requesting another verification link.');
    } finally {
      setIsResending(false);
    }
  };

  if (confirmationSentEmail) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Account created — Verify Email">
          We registered <span className="font-semibold">{confirmationSentEmail}</span> and sent a verification link to your inbox. Confirm your email address, then sign in.
        </Alert>

        {resendMessage && (
          <Alert variant="info" onClose={() => setResendMessage(null)}>
            {resendMessage}
          </Alert>
        )}

        <Button
          type="button"
          variant="outline"
          size="md"
          isLoading={isResending}
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={handleResendConfirmation}
          className="w-full"
        >
          Resend Confirmation Email
        </Button>

        <Link href="/login" className="block">
          <Button variant="primary" size="lg" className="w-full" rightIcon={<ArrowRight className="w-4 h-4" />}>
            Continue to Sign In
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="error" title="Registration error" onClose={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <Input
        label="Full Name"
        type="text"
        name="name"
        autoComplete="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Maya Lin"
        leftIcon={<User className="w-4 h-4" />}
        errorMessage={fieldErrors.name}
        disabled={isLoading}
      />

      <Input
        label="Work Email"
        type="email"
        name="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        leftIcon={<Mail className="w-4 h-4" />}
        errorMessage={fieldErrors.email}
        disabled={isLoading}
      />

      <div>
        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            leftIcon={<Lock className="w-4 h-4" />}
            errorMessage={fieldErrors.password}
            disabled={isLoading}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2.5 top-[31px] p-1 text-navy-400 hover:text-navy-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-500"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <ul className="mt-2.5 space-y-1" aria-label="Password requirements">
          {checks.map((item) => (
            <li
              key={item.label}
              className={`flex items-center space-x-2 text-xs ${
                item.met ? 'text-emerald-700 font-medium' : 'text-navy-400'
              }`}
            >
              <Check
                className={`w-3.5 h-3.5 shrink-0 ${item.met ? 'text-emerald-600' : 'text-cream-400'}`}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        rightIcon={<ArrowRight className="w-4 h-4" />}
        className="w-full"
      >
        Create Account
      </Button>

      <div className="pt-2 text-center text-xs text-navy-400">
        Already have an account?{' '}
        <Link
          href={nextPath !== '/dashboard' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login'}
          className="font-semibold text-coral-600 hover:text-coral-700 underline underline-offset-2"
        >
          Sign in
        </Link>
      </div>
    </form>
  );
};
