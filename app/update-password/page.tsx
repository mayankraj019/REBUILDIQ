import React from 'react';
import { requireServerAuth } from '@/lib/auth/server';
import { AppShell } from '@/components/layout/AppShell';
import { UpdatePasswordForm } from '@/components/auth/UpdatePasswordForm';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ recovery?: string }>;
}) {
  const session = await requireServerAuth('/update-password');
  const params = await searchParams;
  const isRecovery = params?.recovery === '1';

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Settings', href: '/settings' },
        { label: 'Update Password' },
      ]}
    >
      <div className="max-w-lg space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-500">
              {isRecovery ? 'Complete Password Recovery' : 'Update Password'}
            </h1>
            <p className="text-sm text-navy-400 mt-1">
              {isRecovery
                ? 'Choose a new strong password for your verified account. All other active sessions will be signed out.'
                : 'Verify your current credentials and choose a stronger password.'}
            </p>
          </div>
          {isRecovery && (
            <Badge variant="info" size="sm">
              Recovery Verified
            </Badge>
          )}
        </div>

        <div className="bg-white rounded-lg border border-cream-300 p-6 shadow-sm">
          <UpdatePasswordForm
            mode={isRecovery ? 'recovery' : 'change'}
            redirectOnSuccess={isRecovery ? '/dashboard' : '/settings'}
          />
        </div>
      </div>
    </AppShell>
  );
}
