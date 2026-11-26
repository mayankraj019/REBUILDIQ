# RebuildIQ: Application Interface & Navigation Architecture

**Last Updated:** 2026-11-26  
**Design System Compliance:** Navy (`#14213D`), Cream (`#F4EDE0`), Coral (`#FF6B5B`), crisp White (`#FFFFFF`), `#E2D7C3` hairline borders.

---

## 1. Navigation Model

RebuildIQ uses a deterministic three-tier App Router navigation hierarchy:

1. **Public Header (`components/layout/PublicHeader.tsx`)**
   - Displayed on `/`, `/login`, `/register`.
   - Session-aware: switches cleanly between `Sign in` / `Create Account` (unauthenticated) and `Dashboard` / `New Analysis` (authenticated).
   - Collapses cleanly to an Escape-dismissible mobile menu below `768px`.

2. **Authenticated Workspace Shell (`components/layout/AppShell.tsx`)**
   - Persistent `w-64` structural left sidebar on desktop (`>= 1024px`) and slide-over mobile drawer with backdrop & Escape key dismissal below `1024px`.
   - Primary workspace destinations:
     - **+ New Analysis** (`/analysis/new`)
     - **Dashboard** (`/dashboard`)
     - **Analysis History** (`/history`)
     - **Account Settings** (`/settings`)
   - Reference links:
     - **UI Sample Workspace** (`/analysis/preview` — prominently labeled sample fixture)
     - **Design System** (`/design-system`)
   - User footer with verified account name/email and live `Sign out` trigger (`POST /api/auth/logout`).

3. **Contextual Analysis Workspace Tabs (`components/analysis/AnalysisWorkspaceShell.tsx`)**
   - Route-connected sub-navigation shared across the 4 workspace views:
     - `Details & Evidence` (`/analysis/[id]`)
     - `Blueprint Viewer` (`/analysis/[id]/blueprint`)
     - `Prompt Editor` (`/analysis/[id]/prompts`)
     - `Export` (`/analysis/[id]/export`)

---

## 2. Screen Inventory (All 11 Application Screens)

| # | Screen | Route | Auth Required | Backend Connection |
|---|---|---|---|---|
| 1 | Landing Page | `/` | No (session-aware) | Live session check + URL handoff to `/analysis/new` or `/login` |
| 2 | Sign-In & Registration | `/login`, `/register`, `/auth/confirm` | No (redirects if signed in) | **Live** Supabase Auth (`@supabase/ssr`) + synced `public.users` & `public.user_sessions` |
| 3 | Main Dashboard | `/dashboard` | Yes | **Live** RLS-protected Supabase `analysis_jobs` query |
| 4 | Analysis Creation | `/analysis/new` | Yes | **Client-validated + Disconnected** (`POST /api/jobs` awaits Phases 3–4) |
| 5 | Analysis History | `/history` | Yes | **Live** RLS-protected Supabase `analysis_jobs` list + client search/filter |
| 6 | Analysis Details & Progress | `/analysis/[id]` | Yes | **Live** Supabase multi-tenant query; `/analysis/preview` uses flagged fixture |
| 7 | Blueprint Viewer | `/analysis/[id]/blueprint` | Yes | **Live** Supabase `blueprint_artifacts` read; `/analysis/preview` fixture supported |
| 8 | Implementation-Prompt Editor | `/analysis/[id]/prompts` | Yes | **Browser draft save + Disconnected** `PATCH /api/jobs/[id]/blueprint` |
| 9 | Export Interface | `/analysis/[id]/export` | Yes | **Live client Blob exports** (`.md`, `.json`, `.ts`); ZIP archive disconnected |
| 10 | Account Settings | `/settings` | Yes | **Live** `public.users` profile & active `public.user_sessions` login history + Sign Out; mutations disconnected |
| 11 | Not-Found & Error Boundaries | `/not-found`, `error.tsx`, `global-error.tsx`, `/analysis/[id]/not-found.tsx` | No | Next.js App Router recovery boundaries |

---

## 3. Intentionally Disconnected Backend Services

In strict adherence to architectural honesty (*never presenting mock data as actual completed analysis*):

1. **Empty Workspaces Remain Honest:** Newly registered accounts see zero real jobs on `/dashboard` and `/history` with clear empty states rather than seeded fake scans.
2. **Sample UI Fixture Isolation (`/analysis/preview/*`):** To inspect workspace states (`Completed`, `In Progress`, `SSRF / Failed`, and `Loading Skeleton`) before Phase 3/4 workers exist, `/analysis/preview` loads `UI_PREVIEW_FIXTURE` with a persistent warning banner labeling it as disconnected fixture data.
3. **Disconnected Endpoints Marked in UI:**
   - **URL Job Dispatch (`POST /api/jobs`):** `/analysis/new` validates URL syntax and catches obvious private/loopback hosts locally, calls `/api/jobs`, and explains cleanly when `404` indicates Phases 3–4 browser workers are not yet wired.
   - **Live SSE Progress (`GET /api/jobs/[id]/events`):** Progress view displays deterministic stage indicators and notes SSE subscription awaits background queue integration.
   - **Job Cancellation & Deletion (`POST /api/jobs/[id]/cancel`, `DELETE /api/jobs/[id]`):** Confirmation modal safely explains backend route status without altering DB rows falsely.
   - **Blueprint Save (`PATCH /api/jobs/[id]/blueprint`):** Prompt Editor saves local drafts to `sessionStorage` and clearly tells the user when server persistence is unavailable.
   - **ZIP / Pre-signed Screenshot Bundle (`GET /api/jobs/[id]/export?format=zip`):** Individual `.md`, `.json`, and `.ts` files export cleanly client-side; binary ZIP/S3 export reports its pending backend dependency.
   - **Account Mutations (`PATCH /api/auth/me`, password change, AI preferences):** Shown as disabled/informative controls in `/settings` instead of faking persistence.
