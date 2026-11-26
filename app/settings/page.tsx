import React from 'react';
import { requireServerAuth, getUserActiveSessions } from '@/lib/auth/server';
import { AppShell } from '@/components/layout/AppShell';
import { SettingsClient } from '@/components/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function AccountSettingsPage() {
  const session = await requireServerAuth('/settings');
  const activeSessions = await getUserActiveSessions(
    session.user.id,
    session.session.id
  );

  return (
    <AppShell
      user={session.user}
      breadcrumb={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Account Settings' },
      ]}
    >
      <SettingsClient
        user={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          createdAt: session.user.createdAt.toISOString(),
        }}
        sessions={activeSessions}
      />
    </AppShell>
  );
}
