# RebuildIQ: Authentication, Authorization & External Supabase Provider Guide

**Last Updated:** 2026-11-26  
**Supabase Project:** `REBUILDIQ` (`ubnwbkcbixtbaiutrfiv`)

---

## 1. Architecture Summary

RebuildIQ enforces multi-layered server-side and database authentication/authorization using **Supabase Auth (`@supabase/ssr`)**, **PostgreSQL Row Level Security (RLS)**, and **Supabase Storage RLS**:

- **Zero Client Ownership Trust:** User identity (`userId`, `email`, `role`) is always derived from verified Supabase Auth (`supabase.auth.getUser()` / cryptographic `getClaims()`). Requests carrying spoofed ownership or role fields (`userId`, `user_id`, `ownerId`, `role`, `isAdmin`, `deletedAt`) are rejected (`403 FORBIDDEN`).
- **Two-Layer Route Guards:**
  - `middleware.ts` refreshes expiring JWT cookies via `@supabase/ssr`, clears expired/corrupted auth cookies, redirects unauthenticated page navigation (`/dashboard`, `/history`, `/analysis/*`, `/settings`, `/update-password`) to `/login?next=...` (with `reason=session_expired` when stale cookies were present), and returns JSON `401` on protected `/api/*` routes.
  - Server Components (`requireServerAuth`) and API Route Handlers (`requireAuth`, `requireJobOwnership`, `requireBlueprintOwnership`) independently verify user identity, active account status (`deleted_at IS NULL`), and `public.user_sessions` revocation status before reading or mutating any data.
- **Anti-Enumeration & Sanitized Error Handling:**
  - `GET /api/jobs/[id]`, `GET/PATCH /api/jobs/[id]/blueprint`, and `GET /api/jobs/[id]/export` return `404 NOT_FOUND` (rather than `403`) when a resource is owned by another user.
  - `/api/auth/login` uses uniform `401 INVALID_CREDENTIALS` responses for invalid emails/passwords.
  - `/api/auth/forgot-password` and `/api/auth/resend-confirmation` return uniform `200` responses regardless of whether an email exists.
- **Rate Limiting & Abuse Protection (`lib/security/rate-limit.ts`):**
  - Sliding-window limiter keyed by HMAC-SHA256 digests of client IP and account email protects `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, `/api/auth/resend-confirmation`, `/api/auth/update-password`, `/api/auth/account`, and `/api/jobs*` with `429 RATE_LIMIT_EXCEEDED` and `Retry-After` headers.
- **Account Deletion & Data Retention (`DELETE /api/auth/account`):**
  - Requires active verified session + current password verification + `"DELETE"` confirmation.
  - Removes owned binaries under `rebuildiq-artifacts/<userId>/`, deletes user-owned `analysis_jobs` (cascading `page_evidence`, `visual_screenshots`, `blueprint_artifacts`, `job_audit_logs`), revokes all `user_sessions`, signs out globally (`scope: 'global'`), clears auth cookies, and either immediately deletes `auth.users` via server-only `SUPABASE_SECRET_KEY` (`admin.auth.admin.deleteUser`) or marks `public.users.deleted_at` / `deletion_scheduled_at` for 30-day retention purge while blocking all RLS access immediately.

---

## 2. Live Project Verification Status (`ubnwbkcbixtbaiutrfiv`)

Checked via Supabase Auth settings (`/auth/v1/settings`), Postgres metadata (`execute_sql`), and Security Advisor (`get_advisors`):

| Check | Observed Live State | Notes |
|---|---|---|
| Email/Password Provider | **Enabled** (`email: true`) | Password-based auth active |
| Email Confirmations | **Enabled** (`mailer_autoconfirm: false`) | Verification required prior to login |
| Public Signups | **Enabled** (`disable_signup: false`) | Self-service registration open |
| Anonymous Users | **Disabled** (`anonymous_users: false`) | No unverified `authenticated` guest tokens |
| Core Schema & Storage (`000001`) | **Applied** | RLS enabled on all 7 `public` tables + `rebuildiq-artifacts` bucket (`public: false`) |
| Hardening Migration (`000002`) | **Applied & Verified Live** | Columns, least-privilege column grants, `trg_users_guard_update`, `private.account_deletion_ledger`, and 10 active-account RLS policies verified via SQL & Advisor |
| Advisor Warning (`auth_leaked_password_protection`) | **Disabled in Dashboard** | HaveIBeenPwned password check recommended for production |

---

## 3. Required External Supabase Configuration Steps

Complete these external dashboard & server configuration steps before production traffic:

### Step 1 — Hardening Migration (`000002`) — Applied
[supabase/migrations/20261126000002_production_auth_hardening.sql](../supabase/migrations/20261126000002_production_auth_hardening.sql) is applied and verified live in **REBUILDIQ** (`ubnwbkcbixtbaiutrfiv`). It provides:
- `auth_session_id` correlation on `public.user_sessions`
- `deleted_at`, `deletion_scheduled_at`, `deletion_reason`, and `default_prompt_target` on `public.users`
- Least-privilege column `UPDATE` grants + `private.guard_user_profile_update()` trigger blocking role elevation or un-deleting
- `private.account_deletion_ledger` & `private.purge_expired_deleted_accounts()`
- Active-account RLS guards (`deleted_at IS NULL`) across tables & Storage

### Step 2 — Set Server-Only Secret Key (`SUPABASE_SECRET_KEY`)
In production hosting secrets (never in `NEXT_PUBLIC_*` variables):
```bash
SUPABASE_SECRET_KEY="sb_secret_..."
```
Retrieve from **Supabase Dashboard → Project Settings → API Keys**. Keeping this strictly server-side allows `DELETE /api/auth/account` to immediately execute `supabase.auth.admin.deleteUser(userId)`.

### Step 3 — Configure Site URL & Redirect URLs
In **Supabase Dashboard → Authentication → URL Configuration**:
- **Site URL:** Your live domain (e.g. `https://app.rebuildiq.dev` in production, or `http://localhost:3000` locally)
- **Redirect URLs:** Add:
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/auth/confirm?next=/update-password`
  - `https://<your-production-domain>/auth/confirm`
  - `https://<your-production-domain>/auth/confirm?next=/update-password`

### Step 4 — Verify SSR Email Templates & Custom SMTP
1. **Custom SMTP (Recommended for Production):** Navigate to **Authentication → Emails → SMTP Settings** and connect your transactional provider (Resend, AWS SES, Postmark, SendGrid). Supabase's built-in emailer is rate-limited for development only.
2. **Email Templates (PKCE/OTP compatibility):**
   - **Confirm signup:** `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">Confirm email address</a>`
   - **Reset password:** `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/update-password">Reset password</a>`
   *(Note: Disable click/link-tracking in your SMTP provider so email scanners do not pre-consume single-use recovery or verification links.)*

### Step 5 — Password Security, Rate Limits & Session Timeouts
1. **Leaked Password Protection:** In **Authentication → Providers → Email** (or Password Settings on Supabase Pro+), enable **Prevent use of leaked passwords** (HaveIBeenPwned check flagged by Security Advisor).
2. **Bot / Abuse Protection:** Optionally enable Cloudflare Turnstile / hCaptcha under **Authentication → Attack Protection** for public signup and recovery endpoints.
3. **Session Limits & Scheduled Retention Cleanup:** Under **Authentication → Sessions**, keep JWT expiry at or below `3600` seconds (1 hour) and configure inactivity/time-box limits if required by compliance policy. Optionally schedule `SELECT private.purge_expired_deleted_accounts();` daily via `pg_cron` (available under Integrations → Cron) or an admin maintenance cron.
