# Foundation verification record

Date: 2026-09-17. Target: local engineering foundation, not production feature certification.

| Check                             | Result / scope                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen pnpm install / peers       | PASS, exact pinned dependencies and no peer mismatch                                                                                                                |
| Formatting / lint                 | PASS, zero lint warnings; no suppressed rules                                                                                                                       |
| Strict typecheck                  | PASS including dependency declarations (skipLibCheck=false)                                                                                                         |
| Unit tests                        | PASS, 22 tests covering environment isolation and telemetry privacy                                                                                                 |
| Coverage                          | PASS, 100% statements/lines/functions/branches in the two explicitly scoped security configuration modules; not business feature coverage                           |
| Production build                  | PASS, Next.js 16.3.5 with Turbopack; standard pnpm build confirmed                                                                                                  |
| Playwright local production build | PASS, 2 tests: shell/headers/no client errors and admin 404                                                                                                         |
| Local DB reset / lint             | PASS against dedicated Flyco PostgreSQL                                                                                                                             |
| pgTAP foundation                  | PASS, 2 RLS/private-bucket guardrails                                                                                                                               |
| Schema reference                  | PASS, 8 pgTAP checks in rolled-back transaction; all 42 table definitions load, RLS/default-deny and representative constraints verified                            |
| Secret pattern scan               | PASS, no known secret patterns or tracked env files; not a comprehensive historical/security audit                                                                  |
| Supabase remote inspection        | Staging empty public schema/migrations/buckets/branches; advisor no findings. Production project healthy, provisioned with approval; no product schema/data changes |
| GitHub enforcement                | BLOCKED by plan: main protection 403, required environment reviewers 422. Environment branch policy alone does not implement review                                 |
| Vercel preview                    | UNVERIFIED: creation accepted, protected URL reachable, but connector reads return 404 and authenticated fetch cannot access content                                |
| Sentry/Resend/Stripe end-to-end   | NOT RUN: no product endpoints or runtime credentials; no email or money actions                                                                                     |

## Local environment issues handled

Initial pnpm resolution selected TypeScript 7 / ESLint 10 incompatible with Next's current lint dependencies. Pinned TypeScript 6.0.3 and ESLint 9.39.5; no overrides/disabled checks. ESLint 9 upstream support status is documented as maintenance risk.

The first restricted build could not bind a local worker socket; production build succeeded with authorized local process access, and subsequent standard pnpm build passed. No bundler checks were disabled.

Docker's global config referred to a missing Desktop credential helper. Validation used an isolated temporary Docker config for public image pulls, leaving global credentials untouched. Another local Supabase stack occupied 5432x, so Flyco uses 5532x. Full-stack startup had unhealthy Realtime/Storage/Studio checks; no --ignore-health-check was used. Database-only startup/reset/lint/pgTAP succeeded. Full Auth/Storage/Realtime local health remains to diagnose before those features; CI uses database-only startup because that is the scope tested here. Existing unrelated containers were not stopped.

Schema validation uses a temporary file under ignored supabase/.temp so the container can mount it. SQL dollar quoting is preserved by function-based string replacement. Both successful and failed schema checks roll back their transaction; no schema migration was promoted.

## Remote CI and review

The initial [GitHub CI run](https://github.com/Flyco-app/flyco/actions/runs/35277327546) passed both quality and database jobs on commit a13f518, including Chromium and all database checks. GitHub flagged deprecated Node 20 action runtimes; the follow-up pins maintained action releases. The [PR checks](https://github.com/Flyco-app/flyco/pull/1/checks) show the current commit result. These are local-runner E2E checks, not deployed-preview E2E. No production release is authorized by a green foundation check alone. The owner subsequently authorized routine in-scope PR merges after review and exact-head checks.

## Senior foundation review — 2026-09-18

| Check                             | Result                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| pnpm install --frozen-lockfile    | PASS with pinned pnpm 12.4.2 / Node 24.18.0                                                                                        |
| pnpm lint                         | PASS, zero warnings                                                                                                                |
| pnpm typecheck                    | PASS, strict including dependency declarations                                                                                     |
| pnpm test / test:coverage         | PASS, 37 tests; 100% lines/statements/functions and 98.92% branches in scoped env/telemetry modules                                |
| pnpm build                        | PASS, unchanged Turbopack production build after clearing generated .next output caching a sandbox port denial                     |
| pnpm test:e2e                     | PASS, 2 Chromium tests against a freshly started production build                                                                  |
| pnpm db:lint / db:test            | PASS, no lint errors and 2 local foundation pgTAP checks                                                                           |
| pnpm db:design:check              | PASS, 21 rolled-back reference checks including default-deny roles, FK indexes, reservation normalization and transfer consistency |
| pnpm secrets:check / format:check | PASS                                                                                                                               |
| pnpm audit --prod                 | No known vulnerabilities reported by registry audit at review time; not proof of absence                                           |

No runtime providers were contacted by product code and no remote schema was modified. Full-stack Auth/email health and deployed-preview/production release controls are still unverified; see [review](phase-0-review.md). GitHub CI must independently pass on the exact review PR head before automatic merge. The original test totals above are historical, not the current suite.

## Free-plan continuation — 2026-09-18

`pnpm db:start:auth` successfully started Flyco PostgreSQL, Kong/REST, Auth and Mailpit without ignoring health checks. The first smoke and the post-reset smoke both passed: signup, unverified-login rejection, email receipt in local Mailpit, confirmation, verified login, server identity and logout. The random synthetic Auth account was removed after each run. No external email was sent. The full Storage/Realtime/Studio/metadata profile still fails startup health on this host and is not represented as verified.

Frozen install, `pnpm check` (format/lint/typecheck/37 unit tests/build), secret scan and 2 Chromium tests pass. Local reset/lint, 2 foundation pgTAP checks and 21 rolled-back schema checks pass. CI now uses the Auth profile and runs the smoke. No plan upgrades or paid resources were created; production remains disabled. Current readiness is local-only Phase 1A after exact-head CI; hosted gates remain open. This supersedes the earlier statement that all Phase 1 work must wait for paid delivery controls.

## Phase 1A local verification (2026-09-18)

On `codex/phase-1a-auth-profiles`, the following passed against the **local** Flyco Auth profile only: frozen `pnpm install`; `pnpm test:e2e:auth:local --check` (format, lint, strict typecheck, 41 Vitest tests, production build, 4 Chromium tests); `pnpm test:coverage`; `pnpm db:reset`; `pnpm db:lint`; `pnpm db:test` (18 pgTAP assertions including denied cross-user/anon/status writes and suspended update); `pnpm db:profile:check` (direct REST with two synthetic users and anon); `pnpm db:design:check` (21 rolled-back reference assertions); `pnpm secrets:check`. Local Mailpit captured confirmation and recovery messages; the synthetic users were deleted after tests. No staging or production data was touched.

A bare macOS `pnpm build` without the local Auth environment panicked in Turbopack's PostCSS worker with a local port-binding `EPERM`. The same production build passed inside the local Auth runner; CI's clean Linux build remains the authoritative unconfigured build check. A diagnostic webpack build generated a TypeScript 6 ambient declaration error under `.next`; its generated output was removed, and the standard Turbopack build/typecheck passed again. No type or lint rule was disabled.

Hosted release is **not verified** by these checks. Distributed authentication throttling, reviewed cross-device email templates and SMTP, preview deployment/session/CSP verification, and enforcement of production deployment gates remain open. The Phase 1A PR should be reviewed before applying its migration to staging. Production remains untouched and disabled.

## Phase 1A hosted-hardening verification (completed 2026-09-20)

Local verification passes for the committed-style token-hash templates: signup confirmation, token replay denial, recovery, password reset, double-confirm email change, and profile access were exercised in separate Chromium contexts against Mailpit. The Postgres limiter passed atomic boundary/grant tests. Staging migrations `phase_1a_profiles` and `hosted_auth_rate_limits` were applied only to `xivkbucvwsioxevlijzj`. A rolled-back staging SQL test returned true for RLS enabled, anonymous denial, account-status protection, owner-transfer protection, and unchanged data after cross-user writes; synthetic rows were rolled back. Supabase security advisor reports one informational expected finding for forced-RLS private rate-limit storage with no user policies. No production query or migration was issued.

The exact local hardening head passes frozen install, formatting, zero-warning lint, strict typecheck, 45 Vitest tests, a clean production build, secret scan, 28 pgTAP assertions, database lint, 21 rolled-back schema-reference assertions, direct Data API owner/other/anonymous checks, and four Chromium tests. The Auth E2E cleanup was independently checked: no synthetic `phase1-*` or `changed-*` Auth users remained.

The hosted flow passed on Vercel Preview with Supabase staging: signup, account-neutral unverified login failure, cross-browser confirmation, confirmation replay denial, verified login, profile update, logout/protected-route redirect, recovery delivery, password reset, recovery replay denial, changed-password login, double-confirm email change, changed-address login, email-change replay denial and Arabic RTL. Auth cookies were Secure, host-only and SameSite=Lax; SSR refresh propagated them. Absolute, protocol-relative and encoded-backslash destinations fell back to fixed allowlisted routes. Restricted accounts were denied server-side. Global logout/password reset revoked refresh sessions; an existing access JWT retained its documented maximum 15-minute validity.

Direct staging Data API checks with two synthetic members and anonymous access allowed own profile read/update and denied cross-user read/update, ownership transfer, `account_status` writes, forged inserts and anonymous access. The reviewed staging migration has RLS, owner foreign keys, restricted column grants and no user path to the private limiter table. The synthetic Auth accounts were deleted after verification. Production was not queried or changed.

Supabase staging uses the reviewed `token_hash` templates and Resend custom SMTP from verified `auth.flyco.site`; confirmation, recovery and double-confirm email-change mail rendered application-owned links and click/open tracking remained disabled. A safe synthetic server error reached the staging Sentry project with its exception value and request context redacted.

Follow-up commit `5302e04` adds explicit exact Origin/Host enforcement after a forged-Origin check exposed that framework behavior alone was insufficient. Vercel deployment `dpl_3d13wVYEWaS4TuWww2G6wD7xjZZd` built successfully and is served through the stable protected staging alias `https://flyco-staging.vercel.app`. An authenticated forged-Origin multipart Server Action request was rejected with HTTP 500; the same action with the exact staging Origin executed and returned HTTP 303. Two authenticated page loads produced unique CSP nonces without `unsafe-inline` or `unsafe-eval`; HSTS, frame denial, MIME sniffing protection, permissions policy and referrer policy were present. GitHub exact-head CI is the final merge gate for the follow-up PR.
