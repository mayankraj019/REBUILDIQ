# RebuildIQ: Technical Decisions & Architectural Records

## 1. Summary of Architectural Decisions

| Decision ID | Domain | Chosen Approach | Alternatives Evaluated | Rationale |
|---|---|---|---|---|
| **ADR-001** | Full-Stack Framework | Next.js 15 (App Router) + React 19 + TypeScript | Remix, SvelteKit, Vite + Express | Standardized industry framework, unified API route handlers, server-side data fetching, streaming UI, and single-language codebase. |
| **ADR-002** | Design System & Styling | Tailwind CSS (Brand Palette: Navy `#14213D`, Cream `#F4EDE0`, Coral `#FF6B5B`) | CSS Modules, Styled Components, Emotion | Zero runtime CSS overhead, strict design token enforcement, fast prototyping, predictable utility classes. |
| **ADR-003** | Browser Automation Engine | Playwright (Chromium) | Puppeteer, Selenium, Cheerio | Playwright provides low-level CDP access, reliable network request interception (`page.route`), multi-viewport emulation, and superior isolation flags. |
| **ADR-004** | Data Persistence Layer | Prisma ORM (SQLite for Dev/Test, PostgreSQL for Prod) | Drizzle ORM, TypeORM, Raw SQL | Prisma offers declarative schema modeling, automated migrations, strict type-safe query generation, and seamless local SQLite testing without requiring a running Docker database. |
| **ADR-005** | Schema Validation | Zod 3.x | Yup, Joi, TypeBox | De facto standard for TypeScript schema validation; shares schemas seamlessly between API routes, form controls, and AI structured outputs. |
| **ADR-006** | AI Provider & Generation | Google Gemini API with Structured Output (`responseSchema`) + Mock Provider | OpenAI API, Anthropic Claude API | Gemini offers low latency, large context window for ingesting full DOM/CSS trees, native JSON schema enforcement, and cost-effective synthesis. Modular provider interface allows plugging in OpenAI/Anthropic. |
| **ADR-007** | Testing Framework | Vitest | Jest, Mocha | Native ESM and TypeScript support without Babel transform overhead; identical matchers to Jest; ultra-fast in-memory execution. |

---

## 2. Unresolved Architectural Questions & Proposed Sensible Defaults

Rather than silently making high-impact architectural decisions, we record the key architectural questions and propose sensible, production-ready defaults.

### Question 1: Browser Automation Execution Model — In-Process Background Worker vs. Standalone Microservice?
- **Context:** Running headless Chromium can be memory-intensive. In high-traffic SaaS systems, browser automation is typically offloaded to dedicated worker pools (e.g., BullMQ on Redis or Celery).
- **Options Evaluated:**
  - *Option A:* Standalone Redis + BullMQ microservice container.
  - *Option B:* Modular in-process background worker with execution concurrency limits.
- **Proposed Default:** **Option B for initial phases**, designed behind a clean `JobWorker` interface. The in-process worker utilizes concurrency semaphores (max 2 concurrent browser sessions) and strict timeouts (30s). When scaling to multi-server production, the `JobWorker` interface can be swapped to BullMQ/Redis without touching application or UI code.

### Question 2: Real-Time Client Updates — Server-Sent Events (SSE) vs. WebSockets vs. Polling?
- **Context:** Analysis jobs take 15–60 seconds. The frontend needs real-time status updates without blocking the browser.
- **Options Evaluated:**
  - *Option A:* Periodic HTTP polling (e.g., every 2 seconds).
  - *Option B:* Full-duplex WebSockets.
  - *Option C:* Server-Sent Events (SSE) over HTTP (`text/event-stream`).
- **Proposed Default:** **Option C: Server-Sent Events (SSE)** with a client polling fallback. SSE is unidirectional, lightweight, operates over standard HTTP/2, traverses corporate proxies cleanly, and requires no persistent stateful socket servers.

### Question 3: Screenshot & Asset Storage — Local Disk vs. S3/GCS Object Storage?
- **Context:** Page screenshots and DOM snapshots must be stored and served to the user.
- **Options Evaluated:**
  - *Option A:* Direct Amazon S3 / Google Cloud Storage integration.
  - *Option B:* Abstract `StorageService` interface with local disk driver for dev/test and S3/GCS driver for production.
- **Proposed Default:** **Option B.** In development and testing, screenshots are written to `storage/screenshots/` and served via authenticated streaming API routes. In production, setting `STORAGE_DRIVER=s3` switches to pre-signed S3 URLs without changing business logic.

### Question 4: Multi-Page Crawl Scope — Single Page vs. Deep Crawl?
- **Context:** Web reconstruction planning can target a single landing page or explore internal navigation routes. Unbounded crawling creates denial-of-service risks.
- **Options Evaluated:**
  - *Option A:* Single-page analysis only.
  - *Option B:* Unbounded recursive crawler.
  - *Option C:* Configurable shallow crawl (default: 1 page; maximum allowed: 5 pages on identical domain).
- **Proposed Default:** **Option C.** Default to single-page inspection (`crawlDepth: 1`). Allow users to optionally enable shallow discovery of up to 5 linked internal pages on the same domain, with a hard job limit of 5 pages and 180 seconds to prevent resource exhaustion.

---

## 3. Environment Requirements & Operating Cost Projections

| Environment | Database | Browser Worker | Storage | External Services | Expected Cost Profile |
|---|---|---|---|---|---|
| **Development** | SQLite (`prisma/dev.db`) | Local Headless Chromium | Local Disk (`storage/`) | Gemini API (free tier / pay-as-you-go) | $0 / month |
| **Testing / CI** | In-Memory SQLite | Playwright Chromium (headless) | Ephemeral `/tmp` | Mock AI Provider (deterministic JSON) | $0 / month |
| **Staging** | Managed PostgreSQL (Neon / Supabase / RDS) | 1x Dedicated Worker Node (2 vCPU, 4GB RAM) | S3 / Cloud Storage Bucket | Gemini API | ~$20–$40 / month |
| **Production** | High-Availability PostgreSQL | Auto-scaling Worker Nodes (2–4 vCPU, 8GB RAM) | S3 Bucket with CDN CloudFront | Gemini 2.5 API with production quota | ~$50–$150 / month (scales with job volume) |

---

## 4. Git Hygiene & Secrets Management Approach

1. **Zero Secret Ingestion:** No secrets (`.env`, credentials, PEM keys) may ever be committed to git.
2. **Environment Variable Naming:**
   - Server-only variables: `DATABASE_URL`, `GEMINI_API_KEY`, `SESSION_SECRET`, `STORAGE_DRIVER`.
   - Client-accessible variables: Strictly prefixed with `NEXT_PUBLIC_` (limited only to app metadata and public brand URLs).
3. **Template Documentation:** `.env.example` committed to git with safe placeholder values and configuration notes.
4. **Log Redaction:** All application loggers must redact sensitive keys, authorization tokens, and credentials before writing to stdout or file.
