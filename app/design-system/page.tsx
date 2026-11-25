'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { Dialog } from '@/components/ui/Dialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { Progress } from '@/components/ui/Progress';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { Table, Column } from '@/components/ui/Table';
import { Logo, LogoMark } from '@/components/ui/Logo';
import {
  Globe,
  Search,
  Code2,
  CheckCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Inbox,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface AnalysisRow {
  id: string;
  domain: string;
  status: 'COMPLETED' | 'INSPECTING' | 'FAILED';
  pageCount: number;
  date: string;
}

export default function DesignSystemShowcase() {
  const [activeTab, setActiveTab] = useState('components');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [progressVal, setProgressVal] = useState(68);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [inputVal, setInputVal] = useState('https://github.com');
  const [selectVal, setSelectVal] = useState('nextjs');

  const sampleRows: AnalysisRow[] = [
    {
      id: 'job-1',
      domain: 'linear.app',
      status: 'COMPLETED',
      pageCount: 4,
      date: '2026-11-25 14:15',
    },
    {
      id: 'job-2',
      domain: 'vercel.com',
      status: 'INSPECTING',
      pageCount: 1,
      date: '2026-11-25 14:20',
    },
    {
      id: 'job-3',
      domain: 'internal.corp (blocked)',
      status: 'FAILED',
      pageCount: 0,
      date: '2026-11-25 14:22',
    },
  ];

  const columns: Column<AnalysisRow>[] = [
    {
      header: 'Domain',
      accessor: (row) => (
        <div className="flex items-center space-x-2">
          <Globe className="w-4 h-4 text-navy-400" />
          <span className="font-semibold text-navy-500 font-mono text-xs">{row.domain}</span>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row) => {
        if (row.status === 'COMPLETED') {
          return <Badge variant="success" hasDot>Completed</Badge>;
        }
        if (row.status === 'INSPECTING') {
          return <Badge variant="coral" hasDot>Inspecting</Badge>;
        }
        return <Badge variant="error" hasDot>SSRF Blocked</Badge>;
      },
    },
    {
      header: 'Pages',
      accessor: (row) => <span className="font-mono text-xs">{row.pageCount}</span>,
      align: 'center',
    },
    {
      header: 'Timestamp',
      accessor: 'date',
    },
    {
      header: 'Action',
      accessor: () => (
        <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
          View
        </Button>
      ),
      align: 'right',
    },
  ];

  return (
    <div className="min-h-screen bg-cream-100 text-navy-500 pb-24">
      {/* Top Header */}
      <header className="border-b border-cream-300 bg-white px-6 py-4 sticky top-0 z-30 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Logo variant="full" size="sm" asLink href="/" />
            <span className="text-xs text-navy-400 font-mono">/ design-system</span>
          </div>

          <div className="flex items-center space-x-2">
            <Badge variant="coral" size="sm">Brand Palette Verified</Badge>
            <Badge variant="default" size="sm">WCAG AA Compliant</Badge>
          </div>
        </div>
      </header>

      {/* Main Content Showcase */}
      <main className="max-w-6xl mx-auto px-6 pt-10 space-y-12">
        {/* Intro */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-navy-500">
            RebuildIQ Design System &amp; Component Primitives
          </h1>
          <p className="text-sm text-navy-400 mt-2 max-w-2xl leading-relaxed">
            Engineered exclusively with the approved brand palette: Navy (<code className="text-navy-500 font-bold">#14213D</code>),
            Cream (<code className="text-navy-500 font-bold">#F4EDE0</code>), and Coral (<code className="text-coral-500 font-bold">#FF6B5B</code>).
            Zero glassmorphism, zero neon colors, zero excessive gradients.
          </p>
        </div>

        {/* Section 1: Brand Palette & Contrast Swatches */}
        <section className="bg-white rounded-lg border border-cream-300 p-6 shadow-sm">
          <h2 className="text-base font-bold text-navy-500 mb-4 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-coral-500" />
            <span>1. Mandatory Brand Palette Tokens</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Navy Card */}
            <div className="rounded-lg border border-cream-300 overflow-hidden bg-navy-500 text-cream-100 p-5 flex flex-col justify-between h-40 shadow-sm">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-cream-300/80">Primary Structural Navy</span>
                <h3 className="text-2xl font-bold font-mono mt-1">#14213D</h3>
              </div>
              <div className="text-xs space-y-0.5 text-cream-200/90">
                <p>Usage: Typography, headers, dark containers</p>
                <p className="font-semibold text-white">Contrast on White: 12.8:1 (AAA Pass)</p>
              </div>
            </div>

            {/* Cream Card */}
            <div className="rounded-lg border border-cream-300 overflow-hidden bg-cream-100 text-navy-500 p-5 flex flex-col justify-between h-40 shadow-sm">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-navy-400">Primary Brand Canvas</span>
                <h3 className="text-2xl font-bold font-mono mt-1">#F4EDE0</h3>
              </div>
              <div className="text-xs space-y-0.5 text-navy-400">
                <p>Usage: Warm page canvas, card backdrops</p>
                <p className="font-semibold text-navy-500">Subtle border tone: #E2D7C3</p>
              </div>
            </div>

            {/* Coral Card */}
            <div className="rounded-lg border border-coral-200 overflow-hidden bg-coral-500 text-white p-5 flex flex-col justify-between h-40 shadow-sm">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-white/80">Deliberate Focal Accent</span>
                <h3 className="text-2xl font-bold font-mono mt-1">#FF6B5B</h3>
              </div>
              <div className="text-xs space-y-0.5 text-white/90">
                <p>Usage: CTAs, progress bars, active highlights</p>
                <p className="font-semibold">Hover state: #E85A4A</p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Official Brand Logo & Identity Lockups */}
        <section className="bg-white rounded-lg border border-cream-300 p-6 shadow-sm">
          <h2 className="text-base font-bold text-navy-500 mb-2 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-coral-500" />
            <span>2. Official Brand Logo &amp; Identity System</span>
          </h2>
          <p className="text-xs text-navy-400 mb-6 max-w-2xl">
            The RebuildIQ logo features a minimalist head profile silhouette in Navy (<code className="text-navy-500 font-bold">#14213D</code>), a 4-point AI spark in Coral (<code className="text-coral-500 font-bold">#FF6B5B</code>), a structural dividing bar, and precision typography with the uppercase &ldquo;AI AGENT&rdquo; descriptor.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Full Lockup (Cream Canvas) */}
            <div className="bg-cream-100 rounded-lg border border-cream-300 p-5 flex flex-col justify-between items-center text-center space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-navy-400">Full Lockup (Cream Canvas)</span>
              <div className="py-2">
                <Logo variant="full" size="md" />
              </div>
              <span className="text-[11px] text-navy-400 font-mono">variant=&quot;full&quot; size=&quot;md&quot;</span>
            </div>

            {/* Horizontal Header Lockup */}
            <div className="bg-white rounded-lg border border-cream-300 p-5 flex flex-col justify-between items-center text-center space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-navy-400">Horizontal Header Lockup</span>
              <div className="py-3">
                <Logo variant="horizontal" size="md" />
              </div>
              <span className="text-[11px] text-navy-400 font-mono">variant=&quot;horizontal&quot;</span>
            </div>

            {/* Icon Mark Only */}
            <div className="bg-white rounded-lg border border-cream-300 p-5 flex flex-col justify-between items-center text-center space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-navy-400">Brand Icon Mark (App / Favicon)</span>
              <div className="py-1">
                <LogoMark size={44} />
              </div>
              <span className="text-[11px] text-navy-400 font-mono">&lt;LogoMark size=&#123;44&#125; /&gt;</span>
            </div>

            {/* Inverted / Dark Container Lockup */}
            <div className="bg-navy-500 rounded-lg border border-navy-600 p-5 flex flex-col justify-between items-center text-center space-y-4 text-white">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cream-300/80">Inverted (Dark Mode / Footer)</span>
              <div className="py-2">
                <Logo variant="full" size="md" theme="inverted" />
              </div>
              <span className="text-[11px] text-cream-300/80 font-mono">theme=&quot;inverted&quot;</span>
            </div>
          </div>

          {/* Raster Image Asset Integration */}
          <div className="mt-6 pt-5 border-t border-cream-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded border border-cream-300 bg-cream-100 flex items-center justify-center p-1.5">
                <LogoMark size={24} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-navy-500">Production Brand Assets in <code className="text-navy-500 font-mono">/public/brand/</code></h4>
                <p className="text-[11px] text-navy-400">
                  Includes <code className="font-mono">logo.png</code> (transparent), <code className="font-mono">logo-cream.png</code>, <code className="font-mono">icon.png</code>, <code className="font-mono">icon-square.png</code>, and multi-resolution <code className="font-mono">favicon.ico</code>.
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href="/brand/rebuildiq-logo.jpg"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-coral-500 hover:text-coral-600 underline underline-offset-2"
              >
                View High-Res Master Asset
              </a>
            </div>
          </div>
        </section>

        {/* Section 3: Buttons & Interactive Triggers */}
        <section className="bg-white rounded-lg border border-cream-300 p-6 shadow-sm">
          <h2 className="text-base font-bold text-navy-500 mb-4 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-coral-500" />
            <span>3. Button Primitives (Sizes, Variants &amp; Loading States)</span>
          </h2>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Primary Coral Action
              </Button>

              <Button variant="secondary" size="md">
                Secondary Navy
              </Button>

              <Button variant="outline" size="md">
                Outline White
              </Button>

              <Button variant="ghost" size="md">
                Ghost Action
              </Button>

              <Button variant="danger" size="md">
                Danger Action
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="sm" variant="primary">Small (32px)</Button>
              <Button size="md" variant="primary">Medium (40px)</Button>
              <Button size="lg" variant="primary">Large (48px)</Button>
              <Button
                variant="primary"
                size="md"
                isLoading={buttonLoading}
                onClick={() => {
                  setButtonLoading(true);
                  setTimeout(() => setButtonLoading(false), 2000);
                }}
              >
                {buttonLoading ? 'Analyzing...' : 'Click to Test Loading Spinner'}
              </Button>
              <Button variant="primary" disabled size="md">Disabled</Button>
            </div>
          </div>
        </section>

        {/* Section 3: Form Fields & Inputs */}
        <section className="bg-white rounded-lg border border-cream-300 p-6 shadow-sm">
          <h2 className="text-base font-bold text-navy-500 mb-4 flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-coral-500" />
            <span>3. Form Inputs, Selects &amp; Textareas</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Target Website URL"
              helperText="Enforce public HTTP/HTTPS endpoints only. Private subnets are blocked."
              placeholder="https://example.com"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              leftIcon={<Globe className="w-4 h-4" />}
            />

            <Input
              label="Error State Input"
              errorMessage="Target destination resolved to RFC 1918 private subnet (10.0.0.1)"
              defaultValue="http://10.0.0.1/admin"
            />

            <Select
              label="Reconstruction Tech Stack"
              helperText="Choose the target framework for Antigravity prompt synthesis."
              value={selectVal}
              onChange={(e) => setSelectVal(e.target.value)}
              options={[
                { value: 'nextjs', label: 'Next.js 15 (App Router) + Tailwind' },
                { value: 'react-vite', label: 'React 19 + Vite + Tailwind' },
                { value: 'sveltekit', label: 'SvelteKit + Tailwind' },
              ]}
            />

            <Textarea
              label="Blueprint Customization Notes"
              helperText="Optional architectural constraints passed to the AI blueprint engine."
              placeholder="e.g. Separate the Hero section into three distinct modular subcomponents."
              rows={3}
            />
          </div>
        </section>

        {/* Section 4: Navigation, Tabs & Dialogs */}
        <section className="bg-white rounded-lg border border-cream-300 p-6 shadow-sm">
          <h2 className="text-base font-bold text-navy-500 mb-4 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-coral-500" />
            <span>4. Tabs, Dialogs &amp; Tooltips</span>
          </h2>

          <div className="space-y-6">
            <Tabs
              tabs={[
                { id: 'components', label: 'Component Architecture', count: 12 },
                { id: 'styles', label: 'Computed Styles & Tokens', count: 4 },
                { id: 'prompts', label: 'Antigravity Prompts' },
              ]}
              activeTab={activeTab}
              onChange={setActiveTab}
            />

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button
                variant="primary"
                onClick={() => setIsDialogOpen(true)}
              >
                Open Accessible Dialog
              </Button>

              <Tooltip content="SSRF Firewall actively monitors all socket routes">
                <Button variant="outline">
                  Hover for Tooltip (Top)
                </Button>
              </Tooltip>

              <Tooltip content="Captures 375px, 768px, and 1280px viewports" position="bottom">
                <Button variant="ghost">
                  Hover for Tooltip (Bottom)
                </Button>
              </Tooltip>
            </div>
          </div>
        </section>

        {/* Section 5: Status Badges, Progress & Alerts */}
        <section className="bg-white rounded-lg border border-cream-300 p-6 shadow-sm">
          <h2 className="text-base font-bold text-navy-500 mb-4">
            5. Status Badges, Progress Indicators &amp; Alerts
          </h2>

          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-2.5 items-center">
              <Badge variant="coral" hasDot>Coral Accent</Badge>
              <Badge variant="default" hasDot>Default Muted</Badge>
              <Badge variant="success" hasDot>Success / Done</Badge>
              <Badge variant="warning" hasDot>Warning / Retrying</Badge>
              <Badge variant="error" hasDot>Error / Blocked</Badge>
              <Badge variant="info" hasDot>Info / Queued</Badge>
            </div>

            {/* Progress */}
            <div className="space-y-3 max-w-xl">
              <Progress value={progressVal} label="Analysis Job Progress" showPercent />
              <div className="flex space-x-2">
                <Button size="sm" variant="outline" onClick={() => setProgressVal(Math.max(0, progressVal - 15))}>-15%</Button>
                <Button size="sm" variant="outline" onClick={() => setProgressVal(Math.min(100, progressVal + 15))}>+15%</Button>
              </div>
            </div>

            {/* Alerts */}
            <div className="space-y-3">
              <Alert variant="info" title="Browser Worker Ready">
                Isolated Chromium sandbox initialized with `--disable-local-file-access` and route-level IP verification.
              </Alert>

              <Alert variant="warning" title="DNS Rebinding Defense Triggered">
                Target domain resolved to a private link-local address on secondary redirect. Request was cleanly aborted.
              </Alert>
            </div>

            {/* Skeletons & Spinners */}
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy-400 mb-2">Loading Skeletons &amp; Spinners</p>
              <div className="flex items-center space-x-6">
                <Spinner size="md" variant="coral" />
                <Spinner size="md" variant="navy" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Responsive Data Table */}
        <section className="space-y-4">
          <h2 className="text-base font-bold text-navy-500">
            6. Responsive Data Table &amp; Empty State
          </h2>

          <Table
            columns={columns}
            data={sampleRows}
            keyExtractor={(row) => row.id}
          />

          <div className="pt-4">
            <EmptyState
              icon={<Inbox className="w-6 h-6 text-navy-400" />}
              title="No Historical Analyses Found"
              description="Submit any public URL to initiate your first automated reverse-engineering blueprint."
              actionLabel="Start New Analysis"
              onAction={() => alert('EmptyState action triggered')}
            />
          </div>
        </section>
      </main>

      {/* Accessible Modal Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Website Analysis Blueprint Modal"
        description="Review extracted design tokens and component hierarchy"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={() => setIsDialogOpen(false)}>
              Save Blueprint
            </Button>
          </>
        }
      >
        <p className="text-sm text-navy-500 leading-relaxed">
          This accessible modal dialog traps keyboard focus, listens for the <kbd className="px-1.5 py-0.5 bg-cream-200 rounded text-xs font-mono">Escape</kbd> key, and dims the background with an accessible navy backdrop.
        </p>
      </Dialog>
    </div>
  );
}
