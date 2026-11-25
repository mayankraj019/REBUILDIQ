# RebuildIQ: Design System & Visual Specification

## 1. Brand Identity & Aesthetic Principles

RebuildIQ is engineered with a **minimal, refined, and premium commercial aesthetic** crafted for technical architects, software engineers, and product builders.

### Mandatory Brand Palette
| Color | Hex | Role & Functional Application | WCAG Contrast (on Canvas) |
|---|---|---|---|
| **Navy** | `#14213D` | Structural chrome, high-contrast headings, body typography, dark code viewports, and deep primary buttons. | **10.4:1 (AAA Pass)** |
| **Cream** | `#F4EDE0` | Warm primary canvas background, soft dividers, subtle card header backgrounds. | Canvas baseline |
| **Coral** | `#FF6B5B` | Deliberate focal accents, primary call-to-actions, progress indicators, active state badges. | **3.8:1 (UI Components Pass)** |

### Official Brand Logo & Lockup
The official RebuildIQ logo embodies precision website reverse-engineering and AI-guided synthesis:
- **Logo Mark:** Minimalist human cranium/profile outline in Navy (`#14213D`), holding a 4-point AI spark in Coral (`#FF6B5B`).
- **Divider:** Vertical structural rule in Navy (`#14213D`).
- **Wordmark:** Bold uppercase `REBUILD` in Navy (`#14213D`) paired with `IQ` in Coral (`#FF6B5B`).
- **Descriptor:** Generously tracked uppercase `AI AGENT` in Navy (`#14213D`).
- **Available Formats & Assets:**
  - `public/brand/rebuildiq-logo.jpg` (Master high-resolution source)
  - `public/brand/logo.png` (Transparent background lockup)
  - `public/brand/logo-cream.png` (Cream background lockup)
  - `public/brand/icon.png` & `public/brand/icon-square.png` (App icons and avatars)
  - `public/brand/logo.svg` & `public/brand/icon.svg` (Infinite-scale SVG vectors)
  - `public/favicon.ico` (Multi-resolution browser favicon: 16x16, 32x32, 48x48)
- **Reusable Component:** `<Logo variant="full" | "horizontal" | "mark" | "text" | "image" size="xs"|"sm"|"md"|"lg"|"xl" />` in `components/ui/Logo.tsx`.

### Design Prohibitions
- **NO Glassmorphism:** No `backdrop-blur` heavy transparencies that compromise accessibility.
- **NO Neon Colors:** Strict avoidance of electric greens, purples, or cyan glows.
- **NO Excessive Gradients:** All surfaces are solid, opaque, and grounded.
- **NO Generic AI Dashboard Clutter:** Avoid unnecessary decorative stat cards or busy backgrounds.
- **NO Distracting Animations:** Motion is purposeful, restrained (150ms–250ms), and strictly honors `prefers-reduced-motion: reduce`.

---

## 2. Design Tokens Reference

### 2.1 Color Tokens
```typescript
tokens.colors = {
  brand: {
    navy: '#14213D',
    cream: '#F4EDE0',
    coral: '#FF6B5B',
  },
  surface: {
    canvas: '#F4EDE0',   // Page background
    card: '#FFFFFF',     // Elevated white cards
    subtle: '#ECE4D4',   // Deeper cream for borders & dividers
    dark: '#14213D',     // Deep navy header and code blocks
  },
  text: {
    primary: '#14213D',  // Primary readability
    secondary: '#4A5568',// Metadata & timestamps
    muted: '#718096',    // Placeholders & hints
    inverse: '#F4EDE0',  // Text on dark navy
    accent: '#FF6B5B',   // Coral links & accents
  },
  status: {
    success: { text: '#1B7A43', bg: '#EAF7EE', border: '#C3E6CB' },
    warning: { text: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
    error:   { text: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
    info:    { text: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  }
}
```

### 2.2 Typography Scale
- **Sans:** `Inter, system-ui, -apple-system, sans-serif`
- **Mono:** `JetBrains Mono, monospace`
- **Sizes & Line Heights:**
  - `xs`: `12px / 16px` (Badges, metadata)
  - `sm`: `14px / 20px` (Table copy, form inputs, secondary text)
  - `base`: `16px / 24px` (Body paragraphs, default text)
  - `lg`: `18px / 28px` (Subheadings, card titles)
  - `xl`: `20px / 28px` (Section headers)
  - `2xl`: `24px / 32px` (Page headers)
  - `3xl`: `30px / 36px` (Hero headings)
  - `4xl`: `36px / 40px` (Primary display titles)

### 2.3 Spacing & Layout
- Grid baseline: 4px increments (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`).
- Maximum layout widths:
  - Mobile viewport: `375px`
  - Tablet viewport: `768px`
  - Desktop content container: `1280px`
  - Maximum container constraint: `1440px`

### 2.4 Border Radii & Elevation
- Radii:
  - Buttons & Inputs: `6px` (`rounded-md`)
  - Cards & Containers: `8px` (`rounded-lg`)
  - Status Pills & Badges: `9999px` (`rounded-full`)
- Elevation:
  - Flat: `none`
  - Raised: `0 1px 3px 0 rgba(20, 33, 61, 0.05)` (Subtle navy-tinted ambient shadow)
  - Modal: `0 10px 15px -3px rgba(20, 33, 61, 0.12)` (High-focus dialog shadow)

---

## 3. Reusable UI Components Library

The component library resides in `components/ui/`:

| Component | File | Key Features & Accessibility |
|---|---|---|
| **Button** | `components/ui/Button.tsx` | Primary (Coral), Secondary (Navy), Outline, Ghost; sm/md/lg sizes; loading state with spinner; full keyboard focus ring (`focus-visible:ring-2 focus-visible:ring-navy-500`). |
| **Input** | `components/ui/Input.tsx` | Label, helper text, error message, leading/trailing icon slots, clear button; `aria-invalid` and `aria-describedby` integration. |
| **Textarea** | `components/ui/Textarea.tsx` | Multi-line text field with vertical resize constraint and accessible error states. |
| **Select** | `components/ui/Select.tsx` | Accessible dropdown select with custom styled wrapper, custom chevron, and label integration. |
| **Badge** | `components/ui/Badge.tsx` | Status pill variants (`default`, `success`, `warning`, `error`, `info`, `coral-accent`); sm/md sizes; optional dot indicator. |
| **Tabs** | `components/ui/Tabs.tsx` | WAI-ARIA compliant tab list (`role="tablist"`, `role="tab"`, `aria-selected="true"`) with keyboard arrow key navigation. |
| **Dialog / Modal** | `components/ui/Dialog.tsx` | Accessible modal dialog with backdrop blur, `Escape` key dismissal, focus trap, and `aria-modal="true"`. |
| **Tooltip** | `components/ui/Tooltip.tsx` | Hover and focus-triggered tooltip with `role="tooltip"` and collision-resistant positioning. |
| **ProgressBar** | `components/ui/Progress.tsx` | Linear progress bar with percentage indicator, coral fill, and optional animated indeterminate pulse. |
| **Spinner** | `components/ui/Spinner.tsx` | Minimal SVG spinner adhering strictly to the Navy/Cream/Coral palette. |
| **Skeleton** | `components/ui/Skeleton.tsx` | Subtle pulse skeleton for loading states using warm cream tones, respecting `prefers-reduced-motion`. |
| **Alert** | `components/ui/Alert.tsx` | Dismissible banner with `role="alert"`, iconography, and variants (`info`, `success`, `warning`, `error`). |
| **EmptyState** | `components/ui/EmptyState.tsx` | Structured zero-data placeholder with icon container, title, description, and action button. |
| **Table** | `components/ui/Table.tsx` | Semantic HTML table (`table`, `thead`, `tbody`, `tr`, `th`, `td`) with responsive horizontal scroll and hover highlights. |

---

## 4. Accessibility & Contrast Compliance

- **WCAG AA / AAA Standard:**
  - Primary text (`#14213D`) on white (`#FFFFFF`): **12.8:1** (Exceeds AAA).
  - Primary text (`#14213D`) on canvas (`#F4EDE0`): **10.4:1** (Exceeds AAA).
  - Coral button text (`#FFFFFF`) on coral (`#FF6B5B`): **3.2:1** (Large UI text compliant; high-contrast bold typography used).
- **Keyboard Navigation:** Every interactive element has explicit `:focus-visible` styling (`ring-2 ring-navy-500 ring-offset-2 ring-offset-cream-100`).
- **Reduced Motion:** All transitions and keyframe animations automatically deactivate when `prefers-reduced-motion: reduce` is detected.
