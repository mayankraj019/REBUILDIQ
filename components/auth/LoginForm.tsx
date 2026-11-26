'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { LoginInputSchema } from '@/lib/auth/schemas';

export interface LoginFormProps {
  nextPath: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ nextPath }) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    const parsed = LoginInputSchema.safeParse({ email, password });
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        email: flat.email?.[0],
        password: flat.password?.[0],
      });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        setServerError(
          payload?.error?.message || 'Unable to sign in. Check your email and password.'
        );
        setIsLoading(false);
        return;
      }

      const safeNext =
        nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/dashboard';
      router.push(safeNext);
      router.refresh();
    } catch {
      setServerError('Network error while connecting to authentication service.');
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="error" title="Sign-in failed" onClose={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      <Input
        label="Email Address"
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

      <div className="relative">
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Enter your password"
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

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        rightIcon={<ArrowRight className="w-4 h-4" />}
        className="w-full"
      >
        Sign in to RebuildIQ
      </Button>

      <div className="pt-2 text-center text-xs text-navy-400">
        Don&apos;t have an account?{' '}
        <Link
          href={nextPath !== '/dashboard' ? `/register?next=${encodeURIComponent(nextPath)}` : '/register'}
          className="font-semibold text-coral-600 hover:text-coral-700 underline underline-offset-2"
        >
          Create one
        </Link>
      </div>
    </form>
  );
};
