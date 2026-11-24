# RebuildIQ: Technical Stack Justification & Engineering Decisions

## 1. Guiding Principles

Our technology choices are governed by three criteria:
1. **Reliability & Determinism:** Production systems must fail gracefully, handle network interruptions, and maintain state across asynchronous operations.
2. **Security & Sandbox Isolation:** We execute untrusted inputs against remote websites; our tools must support deep network-level interception and process isolation.
3. **Simplicity & Maintainability:** Avoid ephemeral fad technologies, bloated frameworks, and unnecessary microservices when a cohesive, strongly typed architecture satisfies the requirements with greater speed and fewer failure points.

---

## 2. Technology Selections

| Layer | Selected Technology | Version | Rationale & Alternatives Evaluated |
|---|---|---|---|
| **Language & Typing** | TypeScript | `^5.6` | End-to-end type safety, unified type sharing between backend schemas, browser extractors, and UI components. Eliminates entire classes of runtime errors. |
| **Full-Stack Framework** | Next.js (App Router) | `15.x` | Industry-standard, robust server components, server actions, route handlers, and streaming capabilities. Unifies API and UI without cross-origin configuration friction. |
| **UI Library** | React 19 | `19.x` | Native async transitions, high performance, compatible with the Next.js App Router ecosystem. |
| **Styling & Design Tokens** | Tailwind CSS v4 / v3.4 | `^3.4` | Predictable utility-first styling with exact configuration of brand tokens: Navy (`#14213D`), Cream (`#F4EDE0`), and Coral (`#FF6B5B`). Zero runtime CSS overhead. |
| **Iconography** | Lucide React | `^0.460` | Clean, accessible, lightweight SVG icons matching our minimal design aesthetic. |
| **Browser Automation** | Playwright (Chromium) | `^1.48` | Superior network interception (`page.route`), CDP access for computed style extraction, headless performance, and isolated browser context capabilities compared to Puppeteer or Selenium. |
| **Schema Validation** | Zod | `^3.23` | Runtime validation at all trust boundaries: API payloads, SSRF parameters, extracted evidence schemas, and AI structured output definitions. |
| **AI Integration** | Google Gemini API (`@google/genai` / REST) | `v1beta / Gemini 2.5` | Fast response times, large context window for ingesting complete DOM and CSS extracts, native JSON structured schema enforcement (`responseSchema`), and superior code synthesis capabilities for Antigravity prompt packs. |
| **Database & ORM** | Prisma ORM with SQLite (dev) / PostgreSQL (prod) | `^5.22` | Declarative schemas, automated type-safe client generation, migrations, and zero-overhead SQLite for deterministic local development and test execution, with immediate drop-in compatibility for PostgreSQL in production. |
| **Testing Suite** | Vitest | `^2.1` | Ultra-fast execution, native TypeScript support, compatibility with standard Jest matchers, minimal overhead. |

---

## 3. Brand Design System Tokens

The application strictly implements the required brand design palette:

```css
:root {
  /* Brand Core Palette */
  --color-navy: #14213D;
  --color-cream: #F4EDE0;
  --color-coral: #FF6B5B;

  /* Semantic Mappings */
  --bg-primary: #F4EDE0;       /* Warm Cream canvas */
  --bg-surface: #FFFFFF;       /* Pure white elevated cards */
  --bg-surface-subtle: #ECE4D4;/* Deepened cream for borders / accents */
  --bg-dark: #14213D;          /* Deep Navy for headers & code blocks */

  --text-primary: #14213D;     /* Navy primary typography for maximum contrast */
  --text-secondary: #4A5568;   /* Muted slate for secondary metadata */
  --text-inverse: #F4EDE0;     /* Cream text for dark Navy surfaces */

  --border-subtle: #E2D7C3;    /* Soft cream border */
  --border-focus: #14213D;     /* High contrast focus ring */

  --accent-primary: #FF6B5B;   /* Coral focal accent for buttons and highlights */
  --accent-hover: #E85A4A;     /* Darkened coral on interaction */
  --accent-subtle: #FFEAE7;    /* Subtle coral tint for active badges */
}
```

---

## 4. Deployment & Infrastructure Strategy

- **Local Development:** Single command execution (`npm run dev`) with local SQLite database and local Playwright browser.
- **Production Container:** Multi-stage Dockerfile containing:
  1. Build stage: compiles Next.js frontend and server routes.
  2. Runtime stage: Node.js 22 LTS Alpine or Debian slim with Chromium dependencies for Playwright.
  3. Environment variables: `DATABASE_URL`, `GEMINI_API_KEY`, `SESSION_SECRET`.
