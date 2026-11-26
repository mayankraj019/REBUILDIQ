import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  CreateAnalysisFormSchema,
  detectObviousPrivateHost,
  safeJsonParse,
} from '../lib/analysis/types';
import {
  getUserAnalysisJobs,
  splitPromptMarkdownToPhases,
} from '../lib/analysis/loader';
import { UI_PREVIEW_FIXTURE } from '../lib/analysis/preview-fixture';
import { PublicHeader } from '../components/layout/PublicHeader';
import { AppShell } from '../components/layout/AppShell';
import { LandingQuickForm } from '../components/landing/LandingQuickForm';
import { LoginForm } from '../components/auth/LoginForm';
import { RegisterForm } from '../components/auth/RegisterForm';
import { DashboardClient } from '../components/dashboard/DashboardClient';
import { NewAnalysisForm } from '../components/analysis/NewAnalysisForm';
import { HistoryClient } from '../components/history/HistoryClient';
import { AnalysisWorkspaceShell } from '../components/analysis/AnalysisWorkspaceShell';
import { AnalysisOverviewView } from '../components/analysis/AnalysisOverviewView';
import { BlueprintViewerView } from '../components/analysis/BlueprintViewerView';
import { PromptEditorView } from '../components/analysis/PromptEditorView';
import { ExportInterfaceView } from '../components/analysis/ExportInterfaceView';
import { SettingsClient } from '../components/settings/SettingsClient';
import NotFoundPage from '../app/not-found';
import ApplicationError from '../app/error';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  notFound: vi.fn(),
}));

describe('RebuildIQ Application Interface & Routing Verification', () => {
  it('should contain all 11 required App Router screen entrypoints', () => {
    const appDir = path.resolve(__dirname, '../app');
    const expectedRoutes = [
      'page.tsx',                        // 1. Landing page
      'login/page.tsx',                  // 2a. Sign-in
      'register/page.tsx',               // 2b. Account registration
      'dashboard/page.tsx',              // 3. Main dashboard
      'analysis/new/page.tsx',           // 4. Website-analysis creation
      'history/page.tsx',                // 5. Analysis history
      'analysis/[id]/page.tsx',          // 6. Analysis details & progress
      'analysis/[id]/blueprint/page.tsx',// 7. Blueprint viewer
      'analysis/[id]/prompts/page.tsx',  // 8. Implementation-prompt editor
      'analysis/[id]/export/page.tsx',   // 9. Export interface
      'settings/page.tsx',               // 10. Account settings
      'not-found.tsx',                   // 11a. Not-found screen
      'error.tsx',                       // 11b. Application error boundary
      'global-error.tsx',                // 11c. Root global error boundary
    ];

    for (const routeFile of expectedRoutes) {
      expect(fs.existsSync(path.join(appDir, routeFile))).toBe(true);
    }
  });

  it('should validate website analysis submission input strictly', () => {
    const valid = CreateAnalysisFormSchema.safeParse({
      targetUrl: 'https://example.com/pricing',
      crawlDepth: 1,
      viewports: ['desktop', 'mobile'],
    });
    expect(valid.success).toBe(true);

    const invalidProtocol = CreateAnalysisFormSchema.safeParse({
      targetUrl: 'file:///etc/passwd',
      crawlDepth: 1,
      viewports: ['desktop'],
    });
    expect(invalidProtocol.success).toBe(false);

    const noViewports = CreateAnalysisFormSchema.safeParse({
      targetUrl: 'https://example.com',
      crawlDepth: 1,
      viewports: [],
    });
    expect(noViewports.success).toBe(false);
  });

  it('should flag obvious private, loopback, metadata, and disallowed port targets client-side', () => {
    expect(detectObviousPrivateHost('http://localhost:3000')).not.toBeNull();
    expect(detectObviousPrivateHost('http://127.0.0.1')).not.toBeNull();
    expect(detectObviousPrivateHost('http://169.254.169.254/latest/meta-data')).not.toBeNull();
    expect(detectObviousPrivateHost('http://10.0.0.5')).not.toBeNull();
    expect(detectObviousPrivateHost('http://192.168.1.1')).not.toBeNull();
    expect(detectObviousPrivateHost('http://172.16.0.10')).not.toBeNull();
    expect(detectObviousPrivateHost('https://example.com:22')).not.toBeNull();

    expect(detectObviousPrivateHost('https://example.com')).toBeNull();
    expect(detectObviousPrivateHost('https://app.example.com:8443/docs')).toBeNull();
  });

  it('should unambiguously flag UI_PREVIEW_FIXTURE as non-live sample fixture and keep real DB user queries empty', async () => {
    expect(UI_PREVIEW_FIXTURE.id).toBe('preview');
    expect(UI_PREVIEW_FIXTURE.isPreviewFixture).toBe(true);
    expect(UI_PREVIEW_FIXTURE.blueprint?.prompts.length).toBe(4);

    const mockSupabaseEmptyClient = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      }),
    } as any;

    // Ensure a user without DB analyses gets [] rather than injected mock jobs
    const realJobs = await getUserAnalysisJobs(
      'non-existent-user-id-ui-test',
      mockSupabaseEmptyClient
    );
    expect(realJobs).toEqual([]);
  });

  it('should parse serialized JSON and split prompt markdown safely', () => {
    expect(safeJsonParse('["mobile","desktop"]', [])).toEqual(['mobile', 'desktop']);
    expect(safeJsonParse('malformed-json{', ['desktop'])).toEqual(['desktop']);

    const phases = splitPromptMarkdownToPhases(
      '# Phase 1: Setup\nInit project\n---\n# Phase 2: Components\nBuild hero'
    );
    expect(phases).toHaveLength(2);
    expect(phases[0].title).toBe('Phase 1: Setup');
    expect(phases[1].phase).toBe(2);
  });

  it('should render navigation shells, auth forms, dashboard/history empty states, creation form, and error screens with semantic markup', () => {
    const publicHtml = renderToStaticMarkup(
      React.createElement(PublicHeader, { user: null })
    );
    expect(publicHtml).toContain('Sign in');
    expect(publicHtml).toContain('Create Account');
    expect(publicHtml).toContain('Primary Navigation');

    const shellHtml = renderToStaticMarkup(
      React.createElement(AppShell, {
        user: {
          id: 'u1',
          name: 'Mayank Raj',
          email: 'mayank@rebuildiq.dev',
          role: 'USER',
        },
        pageTitle: 'Dashboard',
        children: React.createElement('div', null, 'Workspace Body'),
      })
    );
    expect(shellHtml).toContain('Dashboard');
    expect(shellHtml).toContain('Analysis History');
    expect(shellHtml).toContain('Account Settings');
    expect(shellHtml).toContain('Sign out');
    expect(shellHtml).toContain('Open navigation menu');

    const landingFormHtml = renderToStaticMarkup(
      React.createElement(LandingQuickForm, { isAuthenticated: false })
    );
    expect(landingFormHtml).toContain('Analyze Website');

    const loginHtml = renderToStaticMarkup(
      React.createElement(LoginForm, { nextPath: '/dashboard' })
    );
    expect(loginHtml).toContain('Sign in to RebuildIQ');

    const registerHtml = renderToStaticMarkup(
      React.createElement(RegisterForm, { nextPath: '/dashboard' })
    );
    expect(registerHtml).toContain('Password requirements');

    const dashboardHtml = renderToStaticMarkup(
      React.createElement(DashboardClient, { userName: 'Mayank Raj', jobs: [] })
    );
    expect(dashboardHtml).toContain('No analyses recorded for your account yet');
    expect(dashboardHtml).toContain('Quick URL Launch');

    const newFormHtml = renderToStaticMarkup(
      React.createElement(NewAnalysisForm, { initialUrl: 'https://example.com' })
    );
    expect(newFormHtml).toContain('Target Website URL');
    expect(newFormHtml).toContain('Capture Viewports');
    expect(newFormHtml).toContain('Crawl Scope');

    const historyHtml = renderToStaticMarkup(
      React.createElement(HistoryClient, { jobs: [] })
    );
    expect(historyHtml).toContain('No analysis history yet');
    expect(historyHtml).toContain('role="tablist"');

    const notFoundHtml = renderToStaticMarkup(React.createElement(NotFoundPage));
    expect(notFoundHtml).toContain('Error 404');
    expect(notFoundHtml).toContain('Go to Dashboard');

    const errorHtml = renderToStaticMarkup(
      React.createElement(ApplicationError, {
        error: new Error('Test failure'),
        reset: () => {},
      })
    );
    expect(errorHtml).toContain('Try again');
  });

  it('should render analysis workspace screens cleanly with preview fixture notice, evidence/inference badges, prompts, exports, and settings', () => {
    const workspaceHtml = renderToStaticMarkup(
      React.createElement(AnalysisWorkspaceShell, {
        job: UI_PREVIEW_FIXTURE,
        children: React.createElement(AnalysisOverviewView, { job: UI_PREVIEW_FIXTURE }),
      })
    );
    expect(workspaceHtml).toContain('Sample UI Preview Fixture');
    expect(workspaceHtml).toContain('Observed Ground Truth Inspector');
    expect(workspaceHtml).toContain('Observed Evidence');
    expect(workspaceHtml).toContain('Details &amp; Evidence');
    expect(workspaceHtml).toContain('Blueprint Viewer');
    expect(workspaceHtml).toContain('Prompt Editor');
    expect(workspaceHtml).toContain('Export');

    const blueprintHtml = renderToStaticMarkup(
      React.createElement(BlueprintViewerView, { job: UI_PREVIEW_FIXTURE })
    );
    expect(blueprintHtml).toContain('AI-Inferred Architecture');
    expect(blueprintHtml).toContain('SiteHeader');

    const promptHtml = renderToStaticMarkup(
      React.createElement(PromptEditorView, { job: UI_PREVIEW_FIXTURE })
    );
    expect(promptHtml).toContain('Prompt Sequence');
    expect(promptHtml).toContain('Copy All 4 Phases');
    expect(promptHtml).toContain('Save Draft');

    const exportHtml = renderToStaticMarkup(
      React.createElement(ExportInterfaceView, { job: UI_PREVIEW_FIXTURE })
    );
    expect(exportHtml).toContain('Antigravity Prompt Pack (.md)');
    expect(exportHtml).toContain('Download File');

    const settingsHtml = renderToStaticMarkup(
      React.createElement(SettingsClient, {
        user: {
          id: 'u1',
          name: 'Mayank Raj',
          email: 'mayank@rebuildiq.dev',
          role: 'USER',
          createdAt: '2026-11-24T10:00:00.000Z',
        },
        sessions: [
          {
            id: 's1',
            ipAddress: '127.0.0.1',
            userAgent: 'Test Browser',
            createdAt: '2026-11-26T10:00:00.000Z',
            expiresAt: '2026-12-03T10:00:00.000Z',
            isCurrent: true,
          },
        ],
      })
    );
    expect(settingsHtml).toContain('Account Identity');
    expect(settingsHtml).toContain('Current Session');
    expect(settingsHtml).toContain('Disconnected');
  });
});
