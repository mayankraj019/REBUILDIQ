import { AnalysisJobDetail, PromptPhaseItem } from './types';

/**
 * Static, explicitly badged UI Fixture used solely on /analysis/preview/*
 * so interface layout, tabs, prompt editor, and exports can be inspected
 * before Phase 3/4 browser automation and AI backend services are wired.
 *
 * IMPORTANT: Never store or display this inside a user's real job list as
 * an actual completed scan. Every surface rendering this fixture must show
 * an unmistakable "Sample UI Preview Fixture" notice.
 */
export const PREVIEW_PROMPT_PHASES: PromptPhaseItem[] = [
  {
    phase: 1,
    title: 'Phase 1 — Project Setup, Design Tokens & Layout Shell',
    objective: 'Establish the Next.js 15 TypeScript structure, brand CSS variables, and shared navigation rail.',
    prompt: `# Phase 1: Foundation & Design System Setup

Target Reference (Sample Fixture): example-studio.dev
Observed Canvas Colors: #F4EDE0 (Warm Cream), #14213D (Deep Navy), #FF6B5B (Focal Coral)

Instructions for Antigravity:
1. Initialize a Next.js 15 App Router project with strict TypeScript and Tailwind CSS.
2. Configure CSS custom properties and Tailwind theme colors:
   - Primary Navy: #14213D (headings, structural borders, primary text)
   - Warm Cream: #F4EDE0 (primary background canvas)
   - Focal Coral: #FF6B5B (primary CTAs, active indicators)
3. Create the shared responsive TopNavigation and Footer landmarks matching the semantic structure:
   - Single row navigation (64px desktop height) with 4 links and 1 primary CTA.
   - Accessible focus-visible outlines (2px solid #14213D).`,
  },
  {
    phase: 2,
    title: 'Phase 2 — Core Section & Component Hierarchy Reconstruction',
    objective: 'Implement the Hero band, Split Value Grid, Comparison Table, and Pricing Strip without decorative clutter.',
    prompt: `# Phase 2: Component Hierarchy Reconstruction

Component Tree to Implement:
- SiteHeader (sticky: false, max-width: 1200px)
- EditorialHero (max-width: 760px headline container, dual CTA group)
- WorkflowGrid (3-column CSS Grid on >=1024px, 1-column on mobile)
- SpecificationMatrix (responsive table with sticky first column)
- SiteFooter (3-column directory + newsletter form)

Rules:
- Avoid glassmorphism, heavy box shadows, or unrequested background gradients.
- Maintain generous vertical rhythm (64px–80px section padding on desktop).`,
  },
  {
    phase: 3,
    title: 'Phase 3 — Interactive States, Forms & Validation',
    objective: 'Wire accessible tab switching, keyboard-trapped modals, and Zod-validated form inputs.',
    prompt: `# Phase 3: State & Client Interactions

Interactive Specifications:
1. Navigation Drawer (Mobile < 768px): Escape-to-close, focus return on trigger.
2. Blueprint Tabs: WAI-ARIA role="tablist" with Left/Right arrow keyboard navigation.
3. Lead Capture Form: Inline validation states with aria-invalid and role="alert" error messaging.`,
  },
  {
    phase: 4,
    title: 'Phase 4 — Accessibility, Edge States & Responsive QA',
    objective: 'Verify contrast ratios, prefers-reduced-motion behavior, and 375px / 768px / 1280px breakpoints.',
    prompt: `# Phase 4: Verification & Polish

Acceptance Checks:
- Verify WCAG AA contrast on all Navy/Cream and White/Coral button pairings.
- Verify no horizontal scroll overflow at 375px viewport width.
- Verify loading skeleton, empty state, and error recovery views.`,
  },
];

export const UI_PREVIEW_FIXTURE: AnalysisJobDetail = {
  id: 'preview',
  targetUrl: 'https://example-studio.dev',
  normalizedDomain: 'example-studio.dev',
  status: 'COMPLETED',
  progressPercent: 100,
  crawlDepth: 1,
  viewports: ['desktop', 'tablet', 'mobile'],
  errorCode: null,
  errorMessage: null,
  durationMs: 14820,
  createdAt: '2026-11-26T10:15:00.000Z',
  startedAt: '2026-11-26T10:15:02.000Z',
  completedAt: '2026-11-26T10:15:17.000Z',
  pageCount: 1,
  hasBlueprint: true,
  isPreviewFixture: true,
  evidence: [
    {
      id: 'preview-ev-1',
      pageUrl: 'https://example-studio.dev/',
      pageTitle: 'Example Studio — Architectural Software & Editorial Systems (Sample Fixture)',
      domNodeCount: 418,
      extractedAt: '2026-11-26T10:15:09.000Z',
      metaTags: {
        description: 'Sample fixture metadata representing extracted OpenGraph and meta head attributes.',
        viewport: 'width=device-width, initial-scale=1',
        'og:type': 'website',
      },
      typography: [
        {
          role: 'Hero Display (h1)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '48px',
          fontWeight: '800',
          lineHeight: '1.1',
          sampleText: 'Build durable web software with clarity',
        },
        {
          role: 'Section Heading (h2)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '28px',
          fontWeight: '700',
          lineHeight: '1.25',
          sampleText: 'Architectural Foundations',
        },
        {
          role: 'Body Copy (p)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '16px',
          fontWeight: '400',
          lineHeight: '1.6',
          sampleText: 'Clean spatial hierarchy and semantic markup.',
        },
        {
          role: 'Technical Token (code)',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '13px',
          fontWeight: '500',
          lineHeight: '1.5',
          sampleText: 'grid-template-columns: repeat(3, minmax(0, 1fr))',
        },
      ],
      colors: [
        { hex: '#F4EDE0', rgb: 'rgb(244, 237, 224)', usage: 'Page Canvas Background', frequencyPercent: 52 },
        { hex: '#FFFFFF', rgb: 'rgb(255, 255, 255)', usage: 'Elevated Container Surface', frequencyPercent: 24 },
        { hex: '#14213D', rgb: 'rgb(20, 33, 61)', usage: 'Primary Typography & Chrome', frequencyPercent: 16 },
        { hex: '#E2D7C3', rgb: 'rgb(226, 215, 195)', usage: 'Hairline Dividers & Borders', frequencyPercent: 5 },
        { hex: '#FF6B5B', rgb: 'rgb(255, 107, 91)', usage: 'Primary CTA Accent', frequencyPercent: 3 },
      ],
      spacing: [
        { token: 'Container Max Width', value: '1200px', context: 'header, main > section, footer' },
        { token: 'Section Vertical Padding', value: '72px', context: 'main > section' },
        { token: 'Grid Gutter Gap', value: '24px', context: '.feature-grid (CSS Grid)' },
        { token: 'Button Padding', value: '10px 20px', context: 'a.cta-primary, button' },
      ],
      domOutline: [
        { tag: 'header', role: 'banner', label: 'Primary Navigation Bar (4 links + CTA)', childrenCount: 6, depth: 1 },
        { tag: 'section', role: 'region', label: 'Hero Block (h1 + lead copy + email bar)', childrenCount: 4, depth: 1 },
        { tag: 'section', role: 'region', label: '3-Column Capability Breakdown', childrenCount: 3, depth: 1 },
        { tag: 'section', role: 'region', label: 'Architecture Specification Table', childrenCount: 2, depth: 1 },
        { tag: 'footer', role: 'contentinfo', label: 'Directory & Copyright Footer', childrenCount: 4, depth: 1 },
      ],
      detectedSections: ['Header Navigation', 'Editorial Hero', '3-Column Feature Grid', 'Specification Matrix', 'Footer'],
      screenshots: [
        {
          id: 'preview-shot-desktop',
          viewportType: 'DESKTOP',
          width: 1280,
          height: 800,
          storageKey: 'preview-fixture://desktop-1280x800.png',
          fileSizeBytes: 0,
          capturedAt: '2026-11-26T10:15:08.000Z',
        },
        {
          id: 'preview-shot-tablet',
          viewportType: 'TABLET',
          width: 768,
          height: 1024,
          storageKey: 'preview-fixture://tablet-768x1024.png',
          fileSizeBytes: 0,
          capturedAt: '2026-11-26T10:15:08.500Z',
        },
        {
          id: 'preview-shot-mobile',
          viewportType: 'MOBILE',
          width: 375,
          height: 812,
          storageKey: 'preview-fixture://mobile-375x812.png',
          fileSizeBytes: 0,
          capturedAt: '2026-11-26T10:15:09.000Z',
        },
      ],
    },
  ],
  blueprint: {
    id: 'preview-bp-1',
    version: '1.0.0-sample',
    isEditedByUser: false,
    generatedAt: '2026-11-26T10:15:16.000Z',
    updatedAt: '2026-11-26T10:15:16.000Z',
    summary:
      'Editorial, low-noise multi-section web layout structured around a 1200px centered grid, high-contrast Navy typography on Cream canvas, and single-tier interactive controls.',
    designTokens: {
      colors: [
        { name: 'bg-canvas', hex: '#F4EDE0', role: 'Root background' },
        { name: 'bg-surface', hex: '#FFFFFF', role: 'Content panel surface' },
        { name: 'ink-primary', hex: '#14213D', role: 'Headings and body text' },
        { name: 'border-hairline', hex: '#E2D7C3', role: '1px structural dividers' },
        { name: 'accent-action', hex: '#FF6B5B', role: 'Primary conversion CTA' },
      ],
      typography: [
        { token: '--text-display', font: 'Inter', size: '3rem / 1.1', weight: '800' },
        { token: '--text-h2', font: 'Inter', size: '1.75rem / 1.25', weight: '700' },
        { token: '--text-body', font: 'Inter', size: '1rem / 1.6', weight: '400' },
        { token: '--text-code', font: 'JetBrains Mono', size: '0.8125rem / 1.5', weight: '500' },
      ],
      spacingScale: ['4px', '8px', '16px', '24px', '32px', '48px', '72px'],
      radii: ['4px (inputs/buttons)', '8px (panels)', '9999px (status badges)'],
    },
    components: [
      {
        name: 'SiteHeader',
        purpose: 'Top-level landmark holding brand wordmark, 4 navigation links, and 1 primary CTA.',
        observedSource: 'header[role="banner"] (64px height, flex justify-between)',
        props: ['navLinks: NavItem[]', 'ctaHref: string', 'isAuthenticated: boolean'],
        children: [
          {
            name: 'MobileNavDrawer',
            purpose: 'Collapsible vertical menu triggered below 768px breakpoint.',
            observedSource: 'nav > button[aria-expanded]',
            props: ['isOpen: boolean', 'onClose: () => void'],
          },
        ],
      },
      {
        name: 'EditorialHero',
        purpose: 'Communicates primary product proposition with single-row inline URL input.',
        observedSource: 'main > section:first-child (max-width 760px)',
        props: ['headline: string', 'subheading: string', 'onSubmitUrl: (url: string) => void'],
      },
      {
        name: 'SpecificationMatrix',
        purpose: 'Tabular comparison of extracted architecture layers without heavy card borders.',
        observedSource: 'section > table (4 columns, hairline row dividers)',
        props: ['rows: SpecRow[]', 'sortable?: boolean'],
      },
    ],
    interactions: [
      {
        component: 'MobileNavDrawer',
        trigger: 'Click hamburger button or press Escape',
        expectedState: 'Toggles aria-expanded and slides drawer cleanly without scroll bleed',
        accessibilityNote: 'Return keyboard focus to trigger button on Escape dismissal',
      },
      {
        component: 'EditorialHero Form',
        trigger: 'Submit malformed or private URL',
        expectedState: 'Prevents dispatch and renders role="alert" inline error below input',
        accessibilityNote: 'Connect aria-describedby from input to error message element',
      },
    ],
    recommendedStack: [
      { layer: 'Framework', choice: 'Next.js 15 (App Router)', rationale: 'Matches multi-route editorial structure with Server Components.' },
      { layer: 'Styling', choice: 'Tailwind CSS + CSS Variables', rationale: 'Directly maps extracted 4px spacing and exact hex tokens.' },
      { layer: 'Validation', choice: 'Zod', rationale: 'Strict schema enforcement for URL input and structured JSON outputs.' },
      { layer: 'Icons', choice: 'Lucide React', rationale: 'Consistent 1.5px–2px stroke line weight complementing minimalist geometry.' },
    ],
    prompts: PREVIEW_PROMPT_PHASES,
    rawAntigravityMarkdown: PREVIEW_PROMPT_PHASES.map((p) => p.prompt).join('\n\n---\n\n'),
  },
  auditLogs: [
    {
      id: 'log-1',
      stage: 'VALIDATING',
      level: 'INFO',
      message: 'Sample preview event: Pre-flight DNS check format demonstrated (live worker not executed).',
      timestamp: '2026-11-26T10:15:01.000Z',
    },
    {
      id: 'log-2',
      stage: 'INSPECTING',
      level: 'INFO',
      message: 'Sample preview event: Multi-viewport layout structure (1280px, 768px, 375px).',
      timestamp: '2026-11-26T10:15:08.000Z',
    },
    {
      id: 'log-3',
      stage: 'GENERATING_BLUEPRINT',
      level: 'INFO',
      message: 'Sample preview event: Component hierarchy and 4-phase Antigravity prompt bundle ready.',
      timestamp: '2026-11-26T10:15:16.000Z',
    },
  ],
};
