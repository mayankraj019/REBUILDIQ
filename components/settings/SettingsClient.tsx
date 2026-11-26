'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  ShieldCheck,
  Laptop,
  Lock,
  Sliders,
  Trash2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { SafeSessionSummary } from '@/lib/auth/server';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Table, Column } from '@/components/ui/Table';
import { Dialog } from '@/components/ui/Dialog';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';

export interface SettingsClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    emailVerified?: boolean;
    defaultPromptTarget?: 'antigravity' | 'cursor' | 'claude';
    createdAt: string;
  };
  sessions: SafeSessionSummary[];
}

export const SettingsClient: React.FC<SettingsClientProps> = ({
  user,
  sessions: initialSessions,
}) => {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(user.name);
  const [promptTarget, setPromptTarget] = useState<'antigravity' | 'cursor' | 'claude'>(
    user.defaultPromptTarget || 'antigravity'
  );
  const [sessions, setSessions] = useState<SafeSessionSummary[]>(initialSessions);

  const [statusNotice, setStatusNotice] = useState<{
    variant: 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
  } | null>(null);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [isResendingEmail, setIsResendingEmail] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setStatusNotice(null);
    setIsSavingProfile(true);

    try {
      const res = await fetch('/api/auth/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: displayName.trim(),
          defaultPromptTarget: promptTarget,
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setStatusNotice({
          variant: 'error',
          title: 'Profile update failed',
          message: payload?.error?.message || 'Unable to update your account profile.',
        });
        return;
      }

      setStatusNotice({
        variant: 'success',
        title: 'Account saved',
        message: 'Your display name and default workspace preferences have been saved.',
      });
      router.refresh();
    } catch {
      setStatusNotice({
        variant: 'error',
        title: 'Network error',
        message: 'Unable to contact account profile service.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSignOut = async (scope: 'local' | 'global') => {
    if (scope === 'global') setIsSigningOutAll(true);
    else setIsSigningOut(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      });
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  const handleRevokeOtherSessions = async () => {
    setIsRevokingOthers(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'others' }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setStatusNotice({
          variant: 'error',
          title: 'Revocation failed',
          message: payload?.error?.message || 'Unable to revoke other device sessions.',
        });
        return;
      }

      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setStatusNotice({
        variant: 'success',
        title: 'Other sessions signed out',
        message: payload.data?.message || 'All other sessions were terminated.',
      });
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const handleRevokeSingleSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/auth/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'single', sessionId }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setStatusNotice({
          variant: 'error',
          title: 'Unable to revoke session',
          message: payload?.error?.message || 'Session revocation failed.',
        });
        return;
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setStatusNotice({
        variant: 'success',
        title: 'Session revoked',
        message: 'The selected session has been revoked.',
      });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleResendVerification = async () => {
    setIsResendingEmail(true);
    setStatusNotice(null);
    try {
      const res = await fetch('/api/auth/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email }),
      });
      const payload = await res.json().catch(() => null);
      setStatusNotice({
        variant: res.ok && payload?.success ? 'info' : 'error',
        title: res.ok ? 'Verification email requested' : 'Verification request failed',
        message:
          payload?.data?.message ||
          payload?.error?.message ||
          'Check your inbox shortly.',
      });
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    if (deletePhrase !== 'DELETE') {
      setDeleteError('Type DELETE in capital letters to confirm account removal.');
      return;
    }
    if (!deletePassword) {
      setDeleteError('Enter your current password to verify ownership before deletion.');
      return;
    }

    setIsDeletingAccount(true);
    try {
      const res = await fetch('/api/auth/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmation: deletePhrase,
          currentPassword: deletePassword,
          reason: deleteReason.trim() || undefined,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        setDeleteError(
          payload?.error?.message || 'Account deletion failed. Verify your password.'
        );
        setIsDeletingAccount(false);
        return;
      }

      setDeleteModalOpen(false);
      router.push('/login?notice=account_deleted');
      router.refresh();
    } catch {
      setDeleteError('Network error while contacting account removal service.');
      setIsDeletingAccount(false);
    }
  };

  const sessionColumns: Column<SafeSessionSummary>[] = [
    {
      header: 'Client / User Agent',
      accessor: (row) => (
        <div className="flex items-center space-x-2.5 min-w-0">
          <Laptop className="w-4 h-4 text-navy-400 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-navy-500 truncate max-w-[260px]">
              {row.userAgent || 'Browser / API Client'}
            </p>
            <p className="text-[11px] font-mono text-navy-400">
              {row.ipAddress || 'Local / Unknown IP'} &middot; {row.authMethod || 'password'}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) =>
        row.isCurrent ? (
          <Badge variant="success" size="sm" hasDot>
            Current Session
          </Badge>
        ) : (
          <Badge variant="default" size="sm">
            Active
          </Badge>
        ),
    },
    {
      header: 'Issued',
      accessor: (row) => (
        <span className="text-xs text-navy-400">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Expires',
      accessor: (row) => (
        <span className="text-xs text-navy-400">
          {new Date(row.expiresAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      accessor: (row) =>
        row.isCurrent ? (
          <span className="text-[11px] font-mono text-navy-300">This device</span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            isLoading={revokingSessionId === row.id}
            onClick={() => handleRevokeSingleSession(row.id)}
          >
            Revoke
          </Button>
        ),
    },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-500">
          Account Settings
        </h1>
        <p className="text-sm text-navy-400 mt-1">
          Manage your verified RebuildIQ identity, password security, active sessions, and account retention.
        </p>
      </div>

      {statusNotice && (
        <Alert
          variant={statusNotice.variant}
          title={statusNotice.title}
          onClose={() => setStatusNotice(null)}
        >
          {statusNotice.message}
        </Alert>
      )}

      {/* Account Identity & Workspace Defaults */}
      <form
        onSubmit={handleSaveProfile}
        aria-labelledby="profile-heading"
        className="bg-white rounded-lg border border-cream-300 p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-cream-200">
          <div>
            <h2 id="profile-heading" className="text-base font-bold text-navy-500">
              Account Identity &amp; Preferences
            </h2>
            <p className="text-xs text-navy-400">
              Synced cleanly with Supabase Auth &amp; Postgres RLS (<code className="font-mono">/api/auth/me</code>).
            </p>
          </div>
          <div className="flex items-center space-x-2">
            {user.emailVerified === false ? (
              <>
                <Badge variant="warning" size="sm" hasDot>
                  Email Pending Verification
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<RefreshCw className="w-3 h-3" />}
                  isLoading={isResendingEmail}
                  onClick={handleResendVerification}
                >
                  Verify
                </Button>
              </>
            ) : (
              <Badge variant="success" size="sm" hasDot>
                Email Verified
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            disabled={isSavingProfile}
            helperText="Stored in public.users and scoped by RLS."
          />
          <Input
            label="Email Address"
            value={user.email}
            readOnly
            disabled
            helperText={`Member since ${new Date(user.createdAt).toLocaleDateString()}`}
          />
        </div>

        <div className="max-w-sm">
          <Select
            label="Default Prompt Target"
            value={promptTarget}
            onChange={(e) =>
              setPromptTarget(e.target.value as 'antigravity' | 'cursor' | 'claude')
            }
            disabled={isSavingProfile}
            options={[
              { value: 'antigravity', label: 'Antigravity 4-Phase Pack' },
              { value: 'cursor', label: 'Cursor Rules + Tasks' },
              { value: 'claude', label: 'Claude Code Implementation Spec' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-cream-200">
          <span className="text-xs font-mono text-navy-400">
            Account ID: {user.id} &middot; Role: {user.role}
          </span>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            leftIcon={<Sliders className="w-3.5 h-3.5" />}
            isLoading={isSavingProfile}
          >
            Save Profile &amp; Preferences
          </Button>
        </div>
      </form>

      {/* Active Sessions */}
      <section
        aria-labelledby="sessions-heading"
        className="bg-white rounded-lg border border-cream-300 p-6 space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-coral-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="sessions-heading" className="text-base font-bold text-navy-500">
                Active Login Sessions ({sessions.length})
              </h2>
              <p className="text-xs text-navy-400">
                Verified HTTP-only Supabase SSR cookies correlated with <code className="font-mono">public.user_sessions</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {sessions.some((s) => !s.isCurrent) && (
              <Button
                variant="outline"
                size="sm"
                isLoading={isRevokingOthers}
                onClick={handleRevokeOtherSessions}
              >
                Sign Out Other Devices
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              isLoading={isSigningOut}
              onClick={() => handleSignOut('local')}
            >
              Sign Out This Device
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={isSigningOutAll}
              onClick={() => handleSignOut('global')}
            >
              Sign Out All Devices
            </Button>
          </div>
        </div>

        <div className="hidden md:block">
          <Table
            columns={sessionColumns}
            data={sessions}
            keyExtractor={(s) => s.id}
            emptyMessage="No active sessions recorded"
          />
        </div>

        <div className="md:hidden space-y-2.5">
          {sessions.map((row) => (
            <div
              key={row.id}
              className="p-3.5 rounded-md border border-cream-300 bg-cream-50/40 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-navy-500 truncate">
                  {row.userAgent || 'Browser Session'}
                </span>
                {row.isCurrent ? (
                  <Badge variant="success" size="sm">Current</Badge>
                ) : (
                  <Badge variant="default" size="sm">Active</Badge>
                )}
              </div>
              <p className="font-mono text-[11px] text-navy-400">
                IP: {row.ipAddress || 'Unknown'} &middot; Expires {new Date(row.expiresAt).toLocaleDateString()}
              </p>
              {!row.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  isLoading={revokingSessionId === row.id}
                  onClick={() => handleRevokeSingleSession(row.id)}
                >
                  Revoke Session
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Password Rotation & Account Deletion Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <section
          aria-labelledby="security-heading"
          className="bg-white rounded-lg border border-cream-300 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-navy-500" aria-hidden="true" />
              <h2 id="security-heading" className="text-sm font-bold text-navy-500">
                Change Password
              </h2>
            </div>
            <Link
              href="/update-password"
              className="text-xs font-medium text-coral-600 hover:text-coral-700 underline underline-offset-2"
            >
              Full-page view
            </Link>
          </div>

          <UpdatePasswordForm mode="change" redirectOnSuccess="/settings" />
        </section>

        <section
          aria-labelledby="danger-heading"
          className="bg-white rounded-lg border border-red-200 p-6 space-y-4"
        >
          <div className="flex items-center space-x-2 text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <h2 id="danger-heading" className="text-sm font-bold">
              Delete Account &amp; Data Retention
            </h2>
          </div>

          <p className="text-xs text-navy-400 leading-relaxed">
            Permanently remove all website analyses, captured DOM evidence, blueprints, and Storage screenshots owned by your account, revoke every active device session, and terminate account access immediately.
          </p>

          <Button
            variant="danger"
            size="sm"
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
            onClick={() => {
              setDeleteError(null);
              setDeletePhrase('');
              setDeletePassword('');
              setDeleteModalOpen(true);
            }}
          >
            Delete Account...
          </Button>
        </section>
      </div>

      {/* Account Deletion Confirmation Dialog */}
      <Dialog
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!isDeletingAccount) setDeleteModalOpen(false);
        }}
        title="Permanently delete your RebuildIQ account?"
        description="All saved analysis jobs, blueprints, screenshots in private Storage, and active sessions will be erased immediately and cannot be recovered."
      >
        <form onSubmit={handleDeleteAccount} className="space-y-4">
          {deleteError && (
            <Alert variant="error" onClose={() => setDeleteError(null)}>
              {deleteError}
            </Alert>
          )}

          <Input
            label="Type DELETE to confirm"
            value={deletePhrase}
            onChange={(e) => setDeletePhrase(e.target.value)}
            placeholder="DELETE"
            required
            disabled={isDeletingAccount}
          />

          <Input
            label="Current Password"
            type="password"
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Confirm your password"
            required
            disabled={isDeletingAccount}
          />

          <Input
            label="Reason (optional)"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="e.g., Finished project evaluation"
            disabled={isDeletingAccount}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeletingAccount}
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              isLoading={isDeletingAccount}
            >
              Confirm Account Deletion
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
