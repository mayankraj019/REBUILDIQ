# RebuildIQ

> **AI-Powered Website Analysis & Reconstruction-Planning Platform**  
> Transform any publicly accessible website into structured design tokens, component architectures, and implementation-ready Antigravity AI prompts.

---

## Brand Identity & Aesthetic Principles

RebuildIQ is built upon a refined, minimal, and high-contrast commercial design language:

| Color | Hex | Role & Usage |
|---|---|---|
| **Navy** | `#14213D` | Primary typography, deep structural containers, dark chrome, code viewports |
| **Cream** | `#F4EDE0` | Warm primary canvas, subtle cards, soft borders |
| **Coral** | `#FF6B5B` | Deliberate focal accents, progress bars, interactive badges, primary actions |

- **Design Philosophy:** Minimal and distraction-free. No glassmorphism, no neon gradients, no generic AI dashboard templates, no excessive card padding.
- **Accessibility:** Full WCAG AA contrast compliance and keyboard navigation support.

---

## Core Capabilities

1. **Controlled Browser Automation & Inspection:**
   - Headless Playwright Chromium sandbox with strict SSRF defense.
   - Subnet filtering: 100% rejection of RFC 1918 private subnets, loopback, and cloud metadata (`169.254.169.254`).
   - Request-level interception and DNS rebinding prevention on all redirects and subresources.
2. **Empirical Evidence Extraction:**
   - Ground truth DOM structural hierarchy.
   - Computed typography (font families, weights, sizes, line heights).
   - Computed color palette (backgrounds, text, borders, accents) with luminance analysis.
   - Responsive multi-viewport screenshots: Mobile (`375px`), Tablet (`768px`), Desktop (`1280px`).
3. **Structured Reconstruction Blueprints:**
   - Component decomposition hierarchy with props and interaction states.
   - Design system CSS tokens and Tailwind scale definitions.
   - Modern framework recommendations (Next.js 15, React 19, Tailwind CSS).
4. **Antigravity Prompt Pack Synthesis:**
   - Phased, copy-paste ready implementation prompts designed specifically for Antigravity, Claude Code, and Cursor.
   - Step-by-step reconstruction workflows from foundation to verification.
5. **Multi-Format Export & Account History:**
   - Export blueprints to JSON, Markdown, Tailwind config, or ZIP bundles.
   - Persistent user dashboard with multi-tenant data isolation.

---

## Project Structure

```
REBUILDIQ/
├── docs/                           # Architecture, threat model, requirements, roadmap
│   ├── PRODUCT_REQUIREMENTS.md     # PRD: Personas, workflows, acceptance criteria
│   ├── PROJECT_ARCHITECTURE.md     # Architecture specifications & system diagrams
│   ├── SECURITY_THREAT_MODEL.md    # STRIDE threat model, SSRF & injection defenses
│   ├── TECHNICAL_DECISIONS.md      # ADRs, unresolved questions, defaults
│   ├── IMPLEMENTATION_ROADMAP.md   # Phased delivery schedule (Phase 0–6)
│   └── PROJECT_STATUS.md           # Living project tracking document
├── app/                            # Next.js App Router UI pages & layouts (Phase 1+)
├── components/                     # Reusable UI component library (Phase 1+)
├── lib/                            # Core backend & worker services
│   ├── security/                   # SSRF firewall, DNS validator, sanitizers
│   ├── browser/                    # Playwright automation, style & DOM extractors
│   ├── ai/                         # Gemini structured output & prompt synthesizers
│   ├── jobs/                       # Job state machine, scheduler, and worker queue
│   └── db/                         # Prisma client & database queries
├── prisma/                         # Database schema & migrations (Phase 2+)
├── storage/                        # Isolated local screenshot & evidence store
├── tests/                          # Vitest unit & integration test suites
├── .env.example                    # Environment variable documentation
├── .gitignore                      # Production git ignore configuration
├── package.json                    # Workspace dependencies & build scripts
└── README.md                       # Main project documentation
```

---

## Development Prerequisites

- **Node.js:** `v20.x` or `v22.x` (Verified with `v22.12.0`)
- **NPM:** `v10.x`
- **Git:** `v2.x`
- **Operating System:** macOS, Linux, or Windows (WSL2)

---

## Environment Setup & Secrets

1. Clone or navigate to the repository.
2. Copy the environment configuration template:
   ```bash
   cp .env.example .env
   ```
3. Configure your environment variables in `.env`:
   - `DATABASE_URL`: SQLite path for local dev (`file:./dev.db`) or PostgreSQL connection string for production.
   - `SESSION_SECRET`: Cryptographically secure 32+ character random string.
   - `GEMINI_API_KEY`: Google Gemini API key (optional in dev; mock provider available for offline testing).

---

## Development Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the local Next.js development server |
| `npm run build` | Build the application for production |
| `npm start` | Start the production Next.js server |
| `npm test` | Run the Vitest automated test suite |
| `npm run test:watch` | Run tests in interactive watch mode |
| `npm run lint` | Run ESLint and TypeScript type checking |
| `npx prisma migrate dev` | Apply database migrations in development |
| `npx prisma studio` | Open the visual database inspector |

---

## Documentation Index

- [Product Requirements (PRD)](docs/PRODUCT_REQUIREMENTS.md)
- [Project Architecture Specification](docs/PROJECT_ARCHITECTURE.md)
- [Security Threat Model & SSRF Defense](docs/SECURITY_THREAT_MODEL.md)
- [Technical Decisions & Proposed Defaults](docs/TECHNICAL_DECISIONS.md)
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [Project Status & Implementation Tracker](docs/PROJECT_STATUS.md)

---

## License

Proprietary & Confidential. All rights reserved.
