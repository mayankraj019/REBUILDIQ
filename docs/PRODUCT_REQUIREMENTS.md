# RebuildIQ: Product Requirements Document (PRD)

## 1. Product Overview & Vision

**RebuildIQ** is an AI-powered website analysis and reconstruction-planning SaaS platform. It automates the reverse-engineering and blueprinting of publicly accessible web interfaces. By combining controlled, sandboxed browser automation with structured artificial intelligence analysis, RebuildIQ extracts empirical visual and structural design evidence, produces production-grade reconstruction blueprints, and synthesizes implementation-ready prompt packages for modern AI coding tools such as Antigravity, Claude Code, and Cursor.

### Core Philosophy
1. **Empirical Fact vs. AI Inference Separation:** The system strictly separates observed ground truth (DOM hierarchy, computed typography, color palettes, spacing metrics, responsive screenshots) from AI-generated hypotheses (suggested component architecture, recommended tech stacks, design system abstractions).
2. **Defensive by Design:** All target websites and user-provided URLs are treated as potentially hostile inputs. Browser inspection is isolated against Server-Side Request Forgery (SSRF), DNS rebinding, prompt injection, and browser exploitation.
3. **Actionable Engineering Outputs:** RebuildIQ produces concrete, strongly-typed artifacts, component hierarchies, and copy-paste prompts that eliminate hours of manual discovery for software engineers.

---

## 2. Target Users & Personas

| Persona | Primary Goal | Key Workflows & Needs |
|---|---|---|
| **Full-Stack & Frontend Engineers** | Rebuilding, modernizing, or migrating legacy web applications to modern stacks (Next.js, React, Tailwind). | Needs exact computed CSS tokens (font stacks, sizes, color codes, container widths), DOM hierarchy, and implementation-ready prompt sequences. |
| **Software Architects & Tech Leads** | Scoping architecture, estimating effort, and auditing external sites or competitor UI patterns. | Needs component dependency maps, state/interaction specifications, responsive breakpoint comparisons, and tech stack recommendations. |
| **Product Designers & UI Engineers** | Extracting design systems and UI inventories from production websites. | Needs visual palette clusters, typography scales, spacing grids, and high-fidelity multi-viewport screenshots. |
| **AI-Assisted Developers (Antigravity Users)** | Rapidly generating comprehensive codebases using AI coding assistants. | Needs phased, structured, context-rich Antigravity prompt packs that feed directly into AI coding agents without manual prompt engineering. |

---

## 3. Product Scope & Functional Requirements

### 3.1 Public URL Submission & Pre-Flight Validation (Workflow 1)
- **FR-1.1:** The user must be able to input any publicly accessible HTTP/HTTPS URL.
- **FR-1.2:** The system must validate the URL syntax and enforce protocol restrictions (only `http:` and `https:` permitted).
- **FR-1.3:** The system must execute synchronous pre-flight SSRF and DNS checks before accepting the job, rejecting loopback, RFC 1918 private subnets, link-local metadata (169.254.169.254), and non-standard ports.
- **FR-1.4:** The user can configure job options:
  - Viewports: Mobile (375x812), Tablet (768x1024), Desktop (1280x800).
  - Crawl scope: Single page (default) or shallow crawl (max 5 pages on same domain).

### 3.2 Controlled Browser Inspection & Evidence Gathering (Workflow 2)
- **FR-2.1:** The system must launch a sandboxed headless browser context isolated from internal networks.
- **FR-2.2:** The browser worker must navigate to the destination with a strict 30-second timeout.
- **FR-2.3:** Network requests during navigation must be intercepted; subresource requests and redirects resolving to internal or private IPs must be aborted immediately.
- **FR-2.4:** The browser worker must capture:
  - **DOM Structure:** Cleaned semantic tree (H1-H6, nav, main, section, article, footer, button, a, form, input, table).
  - **Computed Typography:** Unique font families, weights, sizes, line heights, letter spacings, and text-color pairings.
  - **Computed Color System:** Background colors, text colors, border colors, accent colors, categorized by frequency and luminance.
  - **Computed Spacing & Layout:** Padding, margin, gap tokens, container max-widths, flexbox vs. grid usage.
  - **Responsive Evidence:** Screenshots at 375px, 768px, and 1280px widths.
  - **Meta & Asset Signals:** Favicon, title, meta description, OpenGraph tags, linked external stylesheets and script origins.

### 3.3 Evidence Curation & Ground Truth Verification (Workflow 3)
- **FR-3.1:** The platform must present an interactive "Evidence Inspector" displaying observed data without AI interpretation.
- **FR-3.2:** The user must be able to inspect captured screenshots, browse computed color swatches with HEX/RGB values, and view typography scales.
- **FR-3.3:** The system must label all observed facts with an "Observed Evidence" badge to prevent confusion with AI analysis.

### 3.4 AI Analysis & Reconstruction Blueprint Engine (Workflow 4)
- **FR-4.1:** The system must transform raw evidence into a structured reconstruction blueprint using Google Gemini / LLM structured JSON output.
- **FR-4.2:** Inferred blueprint outputs must include:
  - **Component Hierarchy:** Parent-child tree of reusable UI components (e.g., `Header`, `HeroSection`, `FeatureCard`, `TestimonialGrid`, `Footer`).
  - **Design System Tokens:** Synthesized CSS variable definitions for colors, typography, spacing, border radiuses, and shadows.
  - **State & Interaction Specifications:** Inferred interactive elements (form validation states, modal triggers, drawer menus, hover states).
  - **Recommended Tech Stack:** Modern, cohesive framework suggestions (e.g., Next.js 15, React 19, Tailwind CSS, Lucide icons, Zod).
  - **Implementation Roadmap:** Step-by-step phased instructions for building the application.

### 3.5 Antigravity AI Prompt Pack Generation (Workflow 5)
- **FR-5.1:** The platform must synthesize ready-to-run prompt packages tailored for Antigravity, Claude Code, and Cursor.
- **FR-5.2:** Prompts must be structured sequentially:
  - *Phase 1 Prompt:* Project setup, design system tokens, layout wrapper, global CSS.
  - *Phase 2 Prompt:* Static component hierarchy and responsive layout reconstruction.
  - *Phase 3 Prompt:* Dynamic state, client interactions, mock data, and form handling.
  - *Phase 4 Prompt:* Polish, accessibility, edge states, and responsive verification.
- **FR-5.3:** Prompts must include one-click "Copy Prompt" and "Export Prompt Pack (.zip/.md)" actions.

### 3.6 Artifact Review, Editing, and Multi-Format Export (Workflow 6)
- **FR-6.1:** Users can edit component names, modify suggested design tokens, and refine blueprint notes before exporting.
- **FR-6.2:** Export options must include:
  - Complete Reconstruction Blueprint (`blueprint.json` & `blueprint.md`).
  - Tailwind Configuration snippet (`tailwind.config.ts` or CSS theme variables).
  - Antigravity Prompt Pack (`antigravity-prompts.md`).
  - Raw Extracted Evidence Bundle (`evidence.json`).

### 3.7 Historical Analyses & Account Dashboard (Workflow 7)
- **FR-7.1:** Authenticated users can view a paginated history of all past analysis jobs.
- **FR-7.2:** Jobs display status badges (`Completed`, `In Progress`, `Failed`, `Cancelled`), target domain, page count, and timestamp.
- **FR-7.3:** Users can delete or re-run past analyses.

---

## 4. Non-Functional & Quality Requirements

1. **Security & Sandboxing:**
   - Zero access to loopback, private networks, or cloud metadata (SSRF protection).
   - Prompt injection defense: untrusted DOM text is enclosed in strict JSON boundaries with `<untrusted_web_evidence>` barriers.
   - User data isolation: all database records enforce multi-tenant foreign key ownership (`userId`).
2. **Performance & Reliability:**
   - URL pre-flight validation < 1 second.
   - Full single-page inspection & screenshot capture < 30 seconds.
   - AI blueprint synthesis < 45 seconds.
   - Bounded retries: 2 retry attempts for transient network failures; graceful failure state reporting.
3. **UI / UX Excellence:**
   - Adherence to brand palette: Navy (`#14213D`), Cream (`#F4EDE0`), Coral (`#FF6B5B`).
   - Accessible contrast (WCAG AA compliant).
   - Consistent loading, empty, error, and success states across all pages.
   - No glassmorphism, no neon colors, no excessive gradients, no distracting animations.

---

## 5. Explicit Assumptions & Out-of-Scope Boundaries

### Assumptions
- Target websites are publicly accessible via standard Internet routing without requiring internal VPN access or intranet trust.
- Analysis focuses on client-rendered structure, styles, and visual representations.

### Explicitly Out-of-Scope
- **No CAPTCHA / Bot-Wall Circumvention:** RebuildIQ does not solve CAPTCHAs (Cloudflare Turnstile, reCAPTCHA, hCaptcha, etc.) or bypass anti-bot challenges. If a site is blocked by a bot wall, the job terminates with an informative message.
- **No Proprietary Backend Code Recovery:** RebuildIQ never claims to recover backend source code (e.g., Python/Java/Go controllers), private database schemas, or secret API credentials.
- **No Vulnerability Fuzzing or Penetration Testing:** RebuildIQ does not perform security penetration tests, SQLi attacks, or vulnerability scanning against target websites.
- **No Authenticated Intranet Crawling:** RebuildIQ does not accept user login credentials to crawl private user dashboards behind authentication.

---

## 6. Measurable Acceptance Criteria

| ID | Criteria | Measurement Method |
|---|---|---|
| **AC-1** | SSRF Firewall blocks 100% of internal and metadata probes. | Automated test suite submitting `localhost`, `127.0.0.1`, `10.0.0.1`, `169.254.169.254`, `[::1]`, and verifying rejection. |
| **AC-2** | Extracted design evidence contains accurate typography and color swatches. | Browser test comparing computed DOM styles against extracted JSON metrics. |
| **AC-3** | Evidence vs. Inference is visually and structurally distinct in UI and API. | Inspecting API payload structure and verifying separate UI cards with distinct badges. |
| **AC-4** | Blueprint generation conforms to strict JSON schema. | Schema validation test verifying 100% compliance with Zod blueprint schema. |
| **AC-5** | Brand palette compliance. | Automated style review verifying Navy (`#14213D`), Cream (`#F4EDE0`), and Coral (`#FF6B5B`) tokens. |
| **AC-6** | Multi-tenant isolation. | Multi-user test confirming User B cannot access User A's jobs, evidence, or blueprints. |
