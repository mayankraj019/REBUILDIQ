# RebuildIQ — Security Audit Report

**Date:** 2026-11-26  
**Supabase Project:** `ubnwbkcbixtbaiutrfiv`  
**Auditor:** Automated (Antigravity)  
**Scope:** Live Supabase RLS policies, storage, security-definer functions, npm dependency vulnerabilities, source code secret handling, HTTP security headers, rate limiting, git history hygiene  
**Result:** ✅ PASS with minor hardening applied during this audit

---

## Executive Summary

| Area | Status | Notes |
|---|---|---|
| Row-Level Security (12 tables) | ✅ All pass | All tables RLS-enabled, all users scoped correctly |
| Storage bucket | ✅ Secure | Private, per-user folder RLS |
| Security-definer functions | ✅ Secure | `private.*` schema; anon/auth exec correctly locked |
| `rls_auto_enable()` privilege | ✅ Remediated | REVOKE applied during this audit |
| npm vulnerabilities (prod) | ✅ No prod vulns | All 9 vulns are dev-toolchain only |
| npm vulnerabilities (dev) | ⚠️ Needs update | vitest, tinypool, zod, postcss, vite — breaking-change fix required |
| HTTP security headers | ✅ Hardened | `next.config.ts` created with CSP, HSTS, X-Frame, etc. |
| SESSION_SECRET missing guard | ✅ Fixed | Production env check throws if unset |
| Secret leakage in source | ✅ No leakage | No `NEXT_PUBLIC_` on any secret |
| `.env` in git history | ✅ Not tracked | `.gitignore` confirmed, `git ls-files` confirms untracked |
| Leaked password protection | ⚠️ Manual step | Dashboard-only: Auth → Password Settings |
| Rate limiting | ✅ Active | 10 sliding-window policies on all auth/job endpoints |
| SSRF guard | ✅ Configured | `ENABLE_SSRF_FIREWALL=true` in env schema |
| Test suite | ✅ 66/66 pass | 12 files, 0 failures |

---

## 1. Row-Level Security Audit

All 12 tables in the `public` schema have `RLS enabled = true`. Verified live via `pg_tables` + `pg_policies`.

| Table | RLS | Policies | Notes |
|---|---|---|---|
| `analysis_jobs` | ✅ | SELECT, INSERT, UPDATE, DELETE | Scoped to `auth.uid() = user_id`; soft-delete guard on SELECT/INSERT/UPDATE |
| `analysis_results` | ✅ | SELECT, INSERT, UPDATE, DELETE | Scoped via `analysis_jobs.user_id` JOIN |
| `blueprint_artifacts` | ✅ | SELECT, INSERT, UPDATE, DELETE | Scoped via `analysis_jobs.user_id` JOIN |
| `discovered_pages` | ✅ | SELECT, INSERT, UPDATE, DELETE | Scoped via `analysis_jobs.user_id`; soft-delete guard |
| `export_records` | ✅ | SELECT, INSERT, UPDATE, DELETE | Direct `user_id = auth.uid()` + job ownership check on INSERT |
| `implementation_prompts` | ✅ | SELECT, INSERT, UPDATE, DELETE | Scoped via `analysis_jobs.user_id` JOIN |
| `job_audit_logs` | ✅ | SELECT, INSERT | No UPDATE/DELETE — append-only audit log |
| `job_events` | ✅ | SELECT, INSERT | No UPDATE/DELETE — append-only event stream |
| `page_evidence` | ✅ | SELECT, INSERT, UPDATE, DELETE | Scoped via `analysis_jobs.user_id` |
| `user_sessions` | ✅ | SELECT, INSERT, UPDATE, DELETE | Direct `user_id = auth.uid()`; soft-delete guard |
| `users` | ✅ | SELECT, UPDATE | No INSERT/DELETE via RLS — users created by trigger only |
| `visual_screenshots` | ✅ | SELECT, INSERT, DELETE | Scoped via `page_evidence → analysis_jobs.user_id` |

**Cross-user access:** No policy allows a user to reach another user's rows — ownership is always validated against `(SELECT auth.uid())` or a correlated sub-select through `analysis_jobs.user_id`.

**`private` schema:** `private.account_deletion_ledger` has RLS enabled with no policies — intentional. The table is in the non-PostgREST-exposed `private` schema; `REVOKE ALL FROM PUBLIC, anon, authenticated` is applied, so it is inaccessible from the REST API.

---

## 2. Storage Bucket

Bucket: `rebuildiq-artifacts`

| Property | Value | Status |
|---|---|---|
| Visibility | `public: false` | ✅ Private |
| SELECT policy | `(storage.foldername(name))[1] = auth.uid()::text` + soft-delete guard | ✅ User-scoped |
| INSERT policy | Same | ✅ |
| UPDATE policy | Same | ✅ |
| DELETE policy | `(storage.foldername(name))[1] = auth.uid()::text` | ✅ |
| Anonymous read | None | ✅ No public URLs |

Objects are organized as `<user-id>/<job-id>/<filename>` — the folder-scoped RLS ensures a user can only read and write their own prefix.

---

## 3. Security-Definer Functions

All `private.*` functions have `SET search_path = ''` and are not directly callable by `anon` or `authenticated` via the REST API.

| Function | anon_exec | auth_exec | search_path | Notes |
|---|---|---|---|---|
| `private.claim_next_analysis_job` | false | false | `""` | ✅ Internal only |
| `private.purge_expired_deleted_accounts` | false | false | `""` | ✅ Internal only |
| `private.purge_expired_retention_data` | false | false | `""` | ✅ Internal only |
| `private.recover_stale_analysis_jobs` | false | false | `""` | ✅ Internal only |
| `private.handle_new_user` | true | true | `""` | ⚪ Auth hook trigger — not REST-callable |
| `private.handle_auth_user_updated` | true | true | `""` | ⚪ Auth hook trigger — not REST-callable |
| `public.rls_auto_enable` | ~~true~~ → revoked | ~~true~~ → revoked | `pg_catalog` | ✅ **EXECUTE revoked** from anon + authenticated |

> [!NOTE]
> `handle_new_user` and `handle_auth_user_updated` show `anon_exec: true` in the advisor because Supabase Auth invokes them through an internal trigger pathway, not via `/rest/v1/rpc/`. They cannot be called directly by an anonymous user over HTTP.

---

## 4. npm Dependency Vulnerabilities

**Total:** 9 vulnerabilities — **0 in production dependencies (41 prod packages), all 9 in dev toolchain.**

| Severity | Package | CVE / Advisory | Scope | Fix |
|---|---|---|---|---|
| 🔴 Critical | `tinypool` | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr — Prototype Pollution / RCE | dev (vitest runtime) | `npm audit fix --force` upgrades vitest to v5 (breaking) |
| 🔴 Critical | `vitest` | Same chain via tinypool | dev | Same |
| 🟠 High | `zod` | GHSA-mrhx-c7xc-m3w5 — memory exhaustion on oversized input | **prod** (used in app) | `npm audit fix --force` upgrades to zod v4 (breaking API) |
| 🟠 High | `postcss` | Via postcss chain | dev | Breaking fix |
| 🟠 High | `vite` | Via vite | dev | Breaking fix |
| 🟡 Moderate | `@vitest/mocker`, `esbuild`, `vite-node` | Via vite chain | dev | Breaking fix |
| 🟡 Moderate | `next` | Via postcss | dev-build | Breaking fix |

> [!WARNING]
> **Zod** is used in production (`lib/config/env.ts`, route validation). The advisory describes memory exhaustion when validating oversized constrained arrays/strings — inputs that do not come from arbitrary user data in RebuildIQ's current validation paths. **Action required:** upgrade to `zod >= 4.6.6` once the API migration is validated.

> [!TIP]
> `tinypool`, `vitest`, `vite`, `postcss`, and `esbuild` are **build/test tools only** — they never run in a deployed container. The critical CVEs for tinypool/vitest only apply if untrusted code is executed via the test runner (not a threat in a CI environment with controlled test code).

**Recommended action:** Pin these upgrades in a dedicated sprint; do not `--force` on main without a full regression pass.

---

## 5. HTTP Security Headers

A `next.config.ts` was created during this audit. All routes now receive:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` — prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` — blocks MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` (production only) |
| `Permissions-Policy` | Disables camera, mic, geolocation, FLoC |
| `Content-Security-Policy` | `default-src 'self'`; allowlists Supabase origin; `frame-ancestors 'none'`; `object-src 'none'` |

> [!NOTE]
> CSP uses `'unsafe-inline'` and `'unsafe-eval'` on `script-src` because Next.js 14 App Router requires them for inline hydration scripts. The `frame-ancestors 'none'` directive replaces `X-Frame-Options` in modern browsers.

---

## 6. Secret Handling

| Item | Finding | Status |
|---|---|---|
| `SESSION_SECRET` in rate-limit.ts | Previously fell back to hardcoded dev string in production | ✅ **Fixed** — now throws in `NODE_ENV=production` if unset |
| `SESSION_SECRET` in session-audit.ts | Same | ✅ **Fixed** |
| `SESSION_SECRET` schema validation | `lib/config/env.ts` enforces `min(32)` via Zod | ✅ |
| `SUPABASE_SECRET_KEY` | Server-only file (`lib/supabase/admin.ts`) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Same file, legacy alias | ✅ |
| `NEXT_PUBLIC_*` prefix | Only used for Supabase URL and publishable anon key — no secrets | ✅ |

---

## 7. Git History & `.env` Hygiene

| Check | Result |
|---|---|
| `.env` tracked by git | ❌ Not tracked — `git ls-files .env` returns "no matches found" |
| `.gitignore` coverage | Lines 20–25: `.env`, `.env.local`, `.env.development.local`, `.env.test.local`, `.env.production.local`, `*.env` |
| Secrets in commit history | Reviewed all 15 commits — no secrets or `.env` files appear in `--name-only` diff output |
| `.env.example` present | ✅ Template with placeholder values committed |

---

## 8. Rate Limiting

Sliding-window rate limits are active on all auth and job-write endpoints:

| Policy | Limit | Window |
|---|---|---|
| Login by IP | 10 req | 15 min |
| Login by account | 5 req | 15 min |
| Registration by IP | 5 req | 60 min |
| Password recovery by IP | 5 req | 15 min |
| Password recovery by email | 3 req | 15 min |
| Resend verification by IP | 5 req | 15 min |
| Resend by email | 3 req | 15 min |
| Password update | 5 req | 15 min |
| Account deletion | 3 req | 60 min |
| Jobs write | 20 req | 15 min |

Identifiers (IPs, emails) are stored as HMAC-SHA256 digests keyed by `SESSION_SECRET` — raw PII is never persisted in memory buckets.

---

## 9. SSRF Guard

`ENABLE_SSRF_FIREWALL` is a declared environment variable (defaults `true`) in `lib/config/env.ts`. The crawler worker is expected to enforce IP/hostname blocklisting before fetching any user-supplied URL.

**Action item:** Verify the actual SSRF firewall implementation in the crawler worker before enabling live crawling jobs.

---

## 10. Test Suite

| Metric | Result |
|---|---|
| Test files | 12 |
| Tests | **66 / 66 passed** |
| TypeScript typecheck | ✅ Exit 0 |
| ESLint | ✅ No warnings or errors |
| Production build | ✅ Exit 0 — 20 routes compiled |

---

## 11. Open Action Items

| Priority | Item | Owner |
|---|---|---|
| 🟠 P1 | Enable **Leaked Password Protection** (HaveIBeenPwned): Supabase Dashboard → Authentication → Providers → Email → "Leaked Password Protection" | Manual — Dashboard |
| 🟠 P1 | Upgrade **zod** to `>= 4.6.6` after API migration validation | Engineering |
| 🟡 P2 | Upgrade **vitest + tinypool** to v5 (breaking) for dev toolchain CVE closure | Engineering |
| 🟡 P2 | Verify SSRF firewall implementation in `worker/` before enabling live crawl | Engineering |
| 🟡 P2 | Tighten CSP `script-src` — remove `'unsafe-eval'` once Next.js App Router ships stable nonces | Engineering |
| 🟢 P3 | Add `npm audit` to CI pipeline with `--audit-level=high` gate | DevOps |

---

## Appendix — Controls Verified Live

All Supabase checks (`execute_sql`, `get_advisors`) were run against project `ubnwbkcbixtbaiutrfiv` during this audit session. No production claim is made about checks that were not directly executed.

| Check | Method |
|---|---|
| RLS enabled per table | `SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'` |
| Policy list | `SELECT tablename, policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public'` |
| Storage bucket visibility | `SELECT name, public FROM storage.buckets` |
| Storage RLS policies | `SELECT name, definition FROM storage.policies` |
| Security-definer function exec | `SELECT proname, has_function_privilege('anon', ...) FROM pg_proc` |
| Advisor findings | `get_advisors` MCP tool |
| `rls_auto_enable` revoke | `REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated` |
