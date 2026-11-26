'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, Laptop, Lock, Sliders } from 'lucide-react';
import { SafeSessionSummary } from '@/lib/auth/server';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Table, Column } from '@/components/ui/Table';

export interface SettingsClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
  };
  sessions: SafeSessionSummary[];
}

export const SettingsClient: React.FC<SettingsClientProps> = ({ user, sessions }) => {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [disconnectedNotice, setDisconnectedNotice] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
      router.refresh();
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
              {row.ipAddress || 'Local / Unknown IP'}
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
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-500">
          Account Settings
        </h1>
        <p className="text-sm text-navy-400 mt-1">
          Manage your verified RebuildIQ identity, active sessions, and workspace defaults.
        </p>
      </div>

      {disconnectedNotice && (
        <Alert
          variant="info"
          title="Backend Settings Endpoint Disconnected"
          onClose={() => setDisconnectedNotice(null)}
        >
          {disconnectedNotice}
        </Alert>
      )}

      {/* Account Identity (Live Backend Data) */}
      <section
        aria-labelledby="profile-heading"
        className="bg-white rounded-lg border border-cream-300 p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-cream-200">
          <div>
            <h2 id="profile-heading" className="text-base font-bold text-navy-500">
              Account Identity
            </h2>
            <p className="text-xs text-navy-400">
              Loaded directly from your verified server-side session (<code className="font-mono">/api/auth/me</code>).
            </p>
          </div>
          <Badge variant="success" size="sm" hasDot>
            Connected
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Full Name"
            value={user.name}
            readOnly
            disabled
            helperText="Profile editing endpoint is not yet implemented."
          />
          <Input
            label="Email Address"
            value={user.email}
            readOnly
            disabled
            helperText={`Member since ${new Date(user.createdAt).toLocaleDateString()}`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <span className="text-xs font-mono text-navy-400">
            Account ID: {user.id} &middot; Role: {user.role}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDisconnectedNotice(
                'Profile update (PATCH /api/auth/me) is intentionally disconnected until the account management API is added.'
              )
            }
          >
            Update Profile
          </Button>
        </div>
      </section>

      {/* Active Sessions (Live DB Records) */}
      <section
        aria-labelledby="sessions-heading"
        className="bg-white rounded-lg border border-cream-300 p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-coral-500 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <h2 id="sessions-heading" className="text-base font-bold text-navy-500">
                Active Login Sessions ({sessions.length})
              </h2>
              <p className="text-xs text-navy-400">
                Managed via Supabase Auth cookies &amp; audited in <code className="font-mono">public.user_sessions</code> with Row-Level Security.
              </p>
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
            isLoading={isSigningOut}
            onClick={handleSignOut}
          >
            Sign Out Current Session
          </Button>
        </div>

        <div className="hidden md:block">
          <Table
            columns={sessionColumns}
            data={sessions}
            keyExtractor={(s) => s.id}
            emptyMessage="No active sessions found"
          />
        </div>

        <div className="md:hidden space-y-2.5">
          {sessions.map((row) => (
            <div
              key={row.id}
              className="p-3.5 rounded-md border border-cream-300 bg-cream-50/40 space-y-1.5 text-xs"
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
            </div>
          ))}
        </div>
      </section>

      {/* Workspace Defaults & Password (Intentionally Disconnected UI Placeholders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section
          aria-labelledby="preferences-heading"
          className="bg-white rounded-lg border border-cream-300 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-navy-500" aria-hidden="true" />
              <h2 id="preferences-heading" className="text-sm font-bold text-navy-500">
                Analysis Preferences
              </h2>
            </div>
            <Badge variant="default" size="sm">Disconnected</Badge>
          </div>

          <Select
            label="Default Prompt Target"
            defaultValue="antigravity"
            disabled
            options={[
              { value: 'antigravity', label: 'Antigravity 4-Phase Pack' },
              { value: 'cursor', label: 'Cursor Rules + Tasks' },
              { value: 'claude', label: 'Claude Code Implementation Spec' },
            ]}
            helperText="Preference persistence awaits backend user-settings storage."
          />

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDisconnectedNotice(
                'Workspace preference persistence is not yet connected to the backend database.'
              )
            }
          >
            Save Preferences
          </Button>
        </section>

        <section
          aria-labelledby="security-heading"
          className="bg-white rounded-lg border border-cream-300 p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Lock className="w-4 h-4 text-navy-500" aria-hidden="true" />
              <h2 id="security-heading" className="text-sm font-bold text-navy-500">
                Password &amp; Security
              </h2>
            </div>
            <Badge variant="default" size="sm">Disconnected</Badge>
          </div>

          <p className="text-xs text-navy-400 leading-relaxed">
            Authentication credentials and password hashes are managed securely in Supabase Auth. Self-service password rotation routes will be added alongside profile mutations.
          </p>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDisconnectedNotice(
                'Password rotation (POST /api/auth/change-password) is intentionally disconnected.'
              )
            }
          >
            Change Password
          </Button>
        </section>
      </div>
    </div>
  );
};
