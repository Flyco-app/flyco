# Foundation verification record

## Phase 1G local product-UI verification (2026-09-23)

- Frozen pnpm install completed with the committed lockfile; no dependency was added.
- Formatting, ESLint, strict TypeScript, 82 unit tests and the Next.js production build passed.
- Coverage remained 98.68% statements, 95.83% branches and 100% functions/lines for the measured server modules.
- Database lint, all 235 pgTAP tests, and the direct booking isolation/concurrent-capacity check passed unchanged. No database migration exists in Phase 1G.
- Fifteen Playwright cases passed against local Supabase. They cover the complete Auth/profile/trip/request lifecycle, two-party proposal/accept/cancel flow, responsive FR/EN/AR public UI at 360px/768px/1440px, Arabic RTL, overflow, keyboard skip navigation and localized not-found recovery.
- Working tree and reachable-history secret scanning found no credential pattern or tracked environment file.
- Manual rendered-page review covered the English desktop homepage and Auth panel plus the Arabic mobile homepage. It found no clipping, horizontal overflow, broken hierarchy, misplaced directionality or inaccessible primary action. The final Git-backed preview review is recorded with the exact head after CI.

Implementation head `3b73a3692563d7151b63785e5f6fe742a69ce1f7` passed the GitHub quality job (1m22s), database job (3m43s), and Vercel checks. The Git-backed deployment `https://flyco-89drhu97u-faridiali27-5309s-projects.vercel.app` was associated with that exact SHA. Authenticated browser access to the protected preview confirmed the rendered English homepage, Arabic RTL homepage and English sign-in page. The deployed UI matched the local responsive visual review; no infrastructure or database change was made.

## Phase 1F verification

Phase 1F adds unit validation/copy tests, pgTAP state/grant/RLS tests, a direct Data API two-sender concurrent acceptance race, and a two-account Playwright proposal/accept/cancel/RTL flow. The database checks prove one 3,000 g reservation wins when two proposals compete for a 5,000 g trip, the loser cannot oversubscribe, cancellation releases the hold and matching reactivates. They also cover stale versions, restricted accounts, participant isolation, direct forgery denial, retries and expiration. Exact-head CI, staging migration and hosted evidence are recorded only after completion.

The implementation head `5e6ee7234d52059276188382ebe765d78f247721` passed GitHub quality/database and Vercel checks. Staging then verified sender proposal, traveler acceptance, a 3,000 g reservation reducing 5,000 g to 2,000 g, Arabic RTL, cancellation and restoration to 5,000 g. The persisted booking reached version 3 with five server events and a released reservation before every synthetic account and domain record was removed. A staging advisor review prompted a separate actor-FK index migration; its exact head `087154ea1279b6bde4b2e0b7544b69408bb4afc5` also passed quality, database and Vercel checks before the index was applied to staging.

## Phase 1E local verification (2026-09-23)

Phase 1E adds deterministic matching version `v1`, owner-only match projections and trigger-driven idempotent recomputation. Frozen install, formatting, zero-warning lint, strict typecheck, 77 unit tests, scoped coverage (98.68% statements / 95.83% branches), a production webpack build and all four authenticated Chromium scenarios pass locally. The standard Turbopack build remains a CI check because this macOS sandbox denies its internal loopback binding.

The local database rebuild, database lint, 200 pgTAP assertions and direct matching Data API check pass. The matching suite covers inclusive date boundaries, route/category/capacity eligibility, restricted accounts, self-match exclusion, lifecycle invalidation, deterministic score/order, duplicate prevention, owner isolation and denial of direct match-table/recompute forgery. Existing Auth lifecycle, profile/Storage, trip and delivery-request authorization runners also pass. The repository scanner found no known credential patterns or tracked environment files in the working tree or reachable Git history, and Gitleaks 8.30.1 found no issue in reachable history.

The exact implementation head passed GitHub quality and database jobs, including the standard Turbopack build, coverage, Playwright, database reset/lint, 200 pgTAP assertions, every direct authorization runner and the complete authenticated browser flow. The existing Vercel Git integration produced a successful Preview for that exact commit.

Migration `phase_1e_deterministic_matching` is applied only to staging project `xivkbucvwsioxevlijzj`. A rolled-back staging audit passed owner projections, cross-owner denial, base-table write/read denial and private recomputation denial. Forced index-plan checks exercised the existing published route/window and category indexes. Supabase advisors report the expected policy-free default-deny match table and authenticated `SECURITY DEFINER` RPC notices; the two match RPCs intentionally require active-owner checks, fixed empty search paths and narrow return shapes.

Hosted verification used two synthetic staging members. It covered published trip/request creation, exact date/capacity/category/route compatibility, both owner match views, deterministic `v1` reasons and fit values, English and Arabic RTL rendering, clean 404 cross-owner denial, and immediate invalidation after request cancellation. The two Auth users and every associated profile, trip, request, event and match row were deleted; a final query returned zero fixtures. Production was not accessed.

## Phase 1D verification (2026-09-22)

Phase 1D is implemented on `codex/phase-1d-delivery-requests`. Formatting, zero-warning lint, strict typecheck, 74 Vitest tests and a clean Next.js production build pass. Four Chromium tests pass, including the full authenticated lifecycle and delivery request draft, private photo add/remove, publish, narrow public view, French navigation, Arabic RTL and cancellation.

The local database resets from migrations and passes database lint plus 158 pgTAP assertions. The Phase 1D pgTAP suite covers constraints, active-account enforcement, owner/other/anonymous access, direct owner/status/audit forgery, lifecycle commands, public projection, optimistic concurrency, photo reservation authorization, MIME/size/count limits and expiration. A direct Data API/Storage runner confirms owner-only base rows, cross-user denial, private signed URLs, unsafe-path denial, photo cleanup and restricted-account publication denial. Its synthetic users and rows are deleted.

GitHub Actions run `35766598466` passed its quality and database jobs on implementation commit `849800dff4bf8fa242d4c81aa48649780456c2e2`; the Git-backed Vercel checks also passed. The existing Vercel project produced immutable Preview `https://flyco-4a34t9eeq-faridiali27-5309s-projects.vercel.app` from that commit. The reachable-history scanner and an independent Gitleaks 8.30.1 scan over 35 commits found no secret exposure.

Migration `phase_1d_delivery_requests` is applied only to staging project `xivkbucvwsioxevlijzj`. A rolled-back staging RLS audit passed all 15 checks for owner access, status/audit forgery denial, cross-user base/item/photo denial, anonymous base-table denial, the narrow public projection, private Storage configuration and policy presence. No Phase 1D schema was applied to production.

The hosted flow used two synthetic staging members. It confirmed owner login, draft creation and editing, private JPEG upload through the authenticated Storage API, publication, the narrow public view, French formatting, Arabic `lang=ar`/`dir=rtl`, cross-user private-detail denial, public listing access and cancellation. The public page omitted description, declared contents, handling notes, private contact data, Storage paths and photos. The private object was deleted through the authenticated Storage API; both Auth users and all associated request, item, photo, cancellation and audit rows were then removed. A final query returned zero synthetic users, profiles, requests, photo rows and Storage objects. Production was not queried, migrated or deployed.

## Phase 1C local verification (2026-09-22)

Phase 1C is implemented on `codex/phase-1c-traveler-trips`. Frozen dependency installation, formatting, zero-warning lint, strict typecheck, 69 Vitest tests, scoped coverage, a Next.js production build and four Chromium tests pass. The browser suite covers authenticated draft creation, publication, the narrow public view, French rendering, Arabic RTL and cancellation.

The local Supabase stack passes reset, database lint, 102 pgTAP assertions, 21 rolled-back schema-reference checks, the Auth lifecycle, the Phase 1B profile/Storage authorization suite and the Phase 1C direct Data API suite. Trip checks cover owner-only drafts, anonymous base-table denial, cross-user mutation denial, direct owner/status forgery denial, active-account enforcement, canonical locations, category validation, lifecycle commands, stale-version rejection, narrow public fields, expiration and audit events. Synthetic local users and trip rows were deleted by the test runners.

The repository scanner checks both the working tree and every reachable Git blob. It passes, and an independent Gitleaks 8.30.1 history scan over 28 commits also found no leaks.

GitHub exact-head CI passed quality and database jobs, including frozen install, secret scan, formatting, lint, strict typecheck, coverage, production build, Playwright, database reset/lint, pgTAP, schema checks, Auth lifecycle, Storage authorization and direct Data API checks. Enabling the existing Git-backed Vercel workflow exposed and removed the repository's obsolete `deploymentEnabled: false` override. The resulting Preview was tied to commit `1624f94624eacb8f668b5d28aa1cf0ba5950ab42` and deployment `EVXTciCdm7J1rmyc2c75jEHo8oCU` at `https://flyco-d965bb5kb-faridiali27-5309s-projects.vercel.app`.

Staging migrations `phase_1c_traveler_trips` and `phase_1c_trip_fk_indexes` are applied only to project `xivkbucvwsioxevlijzj`. Post-apply checks confirmed RLS, denied anonymous base-table access, denied direct member writes, command grants and the unexposed worker. A rolled-back staging test with two synthetic identities confirmed owner access, cross-user table/cancellation denial, anonymous base-table denial and the public projection. Supabase's performance advisor no longer reports unindexed Phase 1C foreign keys; new indexes are expected to remain reported as unused until real traffic exercises them.

The hosted synthetic flow confirmed login, draft create/edit, publication, narrow public fields, localized French display, Arabic `lang=ar` and `dir=rtl`, cancellation, immediate removal from public discovery and cross-user private-detail denial. The first Git preview safely rejected actions because its immutable hostname was not yet allowlisted. The final implementation accepts only the exact Vercel-provided hostname when `VERCEL=1` and `VERCEL_ENV=preview`, while the stable `APP_URL` remains the redirect/email origin. Malformed, non-Vercel, production and uppercase host inputs are rejected by unit tests. Existing CSP, HSTS, frame, MIME, permissions and referrer controls remain unchanged; the browser confirmed Auth cookies are not script-readable. The two synthetic Auth users, profiles, trip, categories, cancellation and audit events were deleted after verification. Production was not queried, migrated or deployed.

## Phase 1B verification

Local verification on `codex/phase-1b-profile-trust-locations` passes formatting, lint, strict typecheck, 57 unit tests, secret scan, database reset/lint, 63 pgTAP assertions, and live local Data API plus Storage checks. Those checks cover private/public field separation, ownership transfer, forged trust and verification fields, phone invalidation, normalized-location mutation denial, identity attempt transitions, public avatar reads, owner writes, cross-user writes and cross-user avatar references. The macOS sandbox cannot run the native Turbopack build because its worker cannot bind an internal loopback port; Linux CI is the authoritative production-build and Playwright environment.

The reviewed migration `20260921150257_phase_1b_profiles_trust_locations` is applied to staging project `xivkbucvwsioxevlijzj` only and recorded in its migration history. The application is served at `https://flyco-staging.vercel.app`; the immutable verification deployment was `https://flyco-64njyv4t2-faridiali27-5309s-projects.vercel.app` (`dpl_7m6DmmBsqVTVqUcC238mpUsxSVot`). Hosted checks confirmed authenticated profile update/read, a public member card with no email or phone leakage, objective trust indicators, Arabic `lang=ar`/RTL rendering, CSP nonce and baseline security headers. The browser bridge could not complete its native file-chooser handoff, so hosted avatar upload is not claimed; exact-head Playwright covers the application upload flow and the local real Storage API check covers owner upload, public read, cross-user denial and cleanup. The synthetic hosted account `phase1b-a-91415051@example.invalid` was permanently deleted after verification on 2026-09-22. Production was not queried, migrated or deployed.

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
