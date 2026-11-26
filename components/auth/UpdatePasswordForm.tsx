'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, Check, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { UpdatePasswordInputSchema } from '@/lib/auth/schemas';

export interface UpdatePasswordFormProps {
  mode: 'change' | 'recovery';
  redirectOnSuccess?: string;
}

export const UpdatePasswordForm: React.FC<UpdatePasswordFormProps> = ({
  mode,
  redirectOnSuccess = '/dashboard',
}) => {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checks = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    {
      label: 'Uppercase & lowercase letter',
      met: /[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword),
    },
    {
      label: 'Number & special character',
      met: /[0-9]/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword),
    },
    {
      label: 'Passwords match',
      met: Boolean(newPassword) && newPassword === confirmPassword,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    const parsed = UpdatePasswordInputSchema.safeParse({
      currentPassword: mode === 'change' ? currentPassword : undefined,
      newPassword,
      confirmPassword,
      mode,
    });

    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        currentPassword: flat.currentPassword?.[0],
        newPassword: flat.newPassword?.[0],
        confirmPassword: flat.confirmPassword?.[0],
      });
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setServerError(
          payload?.error?.message || 'Unable to update your password. Please try again.'
        );
        setIsLoading(false);
        return;
      }

      setSuccessMessage(
        payload.data?.message ||
          'Password updated cleanly. All other active device sessions have been signed out.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      router.refresh();
    } catch {
      setServerError('Network error while updating password.');
    } finally {
      setIsLoading(false);
    }
  };

  if (successMessage) {
    return (
      <div className="space-y-5">
        <Alert variant="success" title="Password updated">
          {successMessage}
        </Alert>

        <Link href={redirectOnSuccess} className="block">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Continue to Workspace
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {serverError && (
        <Alert variant="error" title="Password update failed" onClose={() => setServerError(null)}>
          {serverError}
        </Alert>
      )}

      {mode === 'change' && (
        <Input
          label="Current Password"
          type={showPassword ? 'text' : 'password'}
          name="currentPassword"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Enter your existing password"
          leftIcon={<Lock className="w-4 h-4" />}
          errorMessage={fieldErrors.currentPassword}
          disabled={isLoading}
        />
      )}

      <div className="relative">
        <Input
          label="New Password"
          type={showPassword ? 'text' : 'password'}
          name="newPassword"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Create a strong new password"
          leftIcon={<Lock className="w-4 h-4" />}
          errorMessage={fieldErrors.newPassword}
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

      <Input
        label="Confirm New Password"
        type={showPassword ? 'text' : 'password'}
        name="confirmPassword"
        autoComplete="new-password"
        required
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Re-enter your new password"
        leftIcon={<Lock className="w-4 h-4" />}
        errorMessage={fieldErrors.confirmPassword}
        disabled={isLoading}
      />

      <ul className="space-y-1" aria-label="Password requirements">
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

      <Button
        type="submit"
        variant="primary"
        size="lg"
        isLoading={isLoading}
        rightIcon={<ArrowRight className="w-4 h-4" />}
        className="w-full"
      >
        {mode === 'recovery' ? 'Set New Password' : 'Update Password'}
      </Button>
    </form>
  );
};
