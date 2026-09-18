# Testing strategy

## Foundation commands

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`: formatting, lint with zero warnings, strict type checking including library declarations.
- `pnpm test` / `pnpm test:coverage`: Vitest unit tests for environment isolation and telemetry privacy. Coverage thresholds apply only to the implemented security configuration modules, not fictional business coverage.
- `pnpm build` then `pnpm test:e2e`: Playwright launches the production build; checks French shell, headers, client errors and unavailable admin surface. Chromium baseline; add Firefox/WebKit/mobile/Arabic in UI phases.
- `pnpm db:start`, `pnpm db:reset`, `pnpm db:lint`, `pnpm db:test`: local Supabase only. Initial pgTAP checks are schema-wide RLS/private-storage guardrails, not yet ownership-policy tests.
- `pnpm secrets:check`: credential patterns and tracked environment-file guard.

CI runs clean frozen installs, quality, coverage, build, local E2E and isolated local database checks. No cloud keys needed for these gates. Failures block merge once branch protections are available and configured. Exact deployed-preview E2E is a distinct gate; a local browser pass is not a preview pass.

## Future test layers

| Layer                        | Required evidence                                                                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain unit/property         | Every state edge and forbidden edge, matching filters/order, money bounds, timezone boundaries                                                 |
| Database integration (pgTAP) | CHECK/unique/FK failures, RLS matrix, direct update denial, append-only history, immutable participants                                        |
| Concurrency                  | Two independent DB sessions race for capacity, accept one request twice, consume same code, refund remaining balance, duplicate webhook worker |
| Server integration (Vitest)  | Input parsing, session verification, authorization, safe DTO/errors, idempotency and provider timeout handling                                 |
| Provider sandbox contract    | Signed fixtures and actual sandbox object reconciliation; separate credentials; no sends to real recipients                                    |
| End-to-end (Playwright)      | Sign-up/verification/recovery, dual sender/traveler account, booking/delivery, Arabic RTL, keyboard access, admin denial and scoped review     |
| Operational                  | Failed deployment rollback, migration upgrade, backup restore, alert delivery, stuck-job recovery, credential rotation                         |

Test fixtures are deterministic, synthetic and isolated by run. At least user A, user B, unrelated user C, anonymous, restricted user, scoped staff and revoked staff. Never clone production PII. Test assertions must use API/DB truth, not screenshots alone. Test doubles may replace external network failures in unit tests but are clearly labeled; no provider fake exists in shipped app.

## Database design validation

`pnpm db:design:check` loads the reference only into the isolated local Supabase database inside a rolled-back transaction and runs eight pgTAP checks. The actual local auth schema is used; no shared database is touched. This is not equivalent to Supabase RLS behavioral validation. During feature implementation, test real Supabase JWT claims and role grants through pgTAP and API calls. Add counterexample tests for every authorization rule before enabling table access.

## Definition of verified

Record command, result, target environment and limitations in docs/verification.md. A missing credential, provider outage or unavailable runtime is BLOCKED, not PASS. No skipLibCheck, ts-ignore, disabled rules, continue-on-error quality gates, or test-only production shortcuts to make the build green.

## Local Auth infrastructure smoke

`pnpm db:start:auth` then `pnpm db:auth:check` verifies the actual Supabase service and Mailpit connection, not Flyco UI. It requires loopback ports 55321/55324 and modern CLI-generated local keys. The test creates a random example.invalid account, proves email confirmation is required, consumes only its own Mailpit verification link, verifies login/identity/logout and removes that exact account in finally. No provider credentials, real recipients or production data are used. CI includes this check in the database job. Full Storage/Realtime/Studio startup and feature-specific RLS/SSR behavior remain separate unverified work.
