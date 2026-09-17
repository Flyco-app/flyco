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

The initial [GitHub CI run](https://github.com/Flyco-app/flyco/actions/runs/35277327546) passed both quality and database jobs on commit a13f518, including Chromium and all database checks. GitHub flagged deprecated Node 20 action runtimes; the follow-up pins maintained action releases. The [PR checks](https://github.com/Flyco-app/flyco/pull/1/checks) show the current commit result. These are local-runner E2E checks, not deployed-preview E2E. No production release or merge is authorized by a green foundation check alone.
