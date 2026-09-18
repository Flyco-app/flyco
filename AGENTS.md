# Flyco engineering contract

## Scope and workflow

Read README.md and the relevant docs before changing code. This is a production marketplace, not a demo. The foundation mission contains no product features. Future work must name its phase and satisfy that phase's definition of done. Keep architectural decisions explicit in docs/decisions.md. Preserve unrelated work. Use small branches named `codex/<purpose>`, pull requests, and review; never push directly to protected main.

Routine in-scope Codex PRs are authorized for automatic squash merge after reviewing the diff and verifying all applicable CI checks on the exact latest head. Do not ask for repeated PR confirmation. Match the head commit when merging; never bypass checks, unresolved review requests or branch protections. This does not authorize paid plans, live financial operations or destructive production changes.

## Architecture

One Next.js App Router application, strict TypeScript, pnpm, PostgreSQL/Supabase. Keep route handlers and Server Actions thin; put business use cases in server-only domain modules under src/modules when needed. Do not create speculative packages or a second admin application. `/admin` must have an independently enforced authorization boundary when implemented; a layout or hidden link is not authorization. Server Components by default. Add dependencies only with a concrete reason. Pin versions and commit pnpm-lock.yaml.

## Non-negotiable security

- Validate all external inputs with Zod at the boundary, including environment variables, query strings, webhooks, uploaded metadata and job payloads.
- Authorize every operation server-side and enforce row access with RLS. Never trust client ownership, price, status, verification, or role fields.
- User requests use the user's verified JWT, never a service-role client. No RLS bypass to solve permission errors. Privileged workers require narrow purpose, explicit authorization, audit and tests. SECURITY DEFINER is exceptional: non-exposed schema, fixed search_path, minimal owner/grants, explicit actor checks and review.
- Never use user_metadata for authorization. Live DB staff assignments and account restrictions are authoritative. Sensitive staff actions require MFA and current permissions.
- Never expose secrets through NEXT_PUBLIC_, DTOs, errors, logs, screenshots, artifacts or commits. Do not print .env files or credential values. .env.example contains names with empty values only. Never request secrets in chat.
- Private storage only for item photos, evidence and identity material. Derive access from database ownership, not path strings alone. Short-lived signed URLs; no raw identity documents unless approved as necessary.
- No arbitrary booking/payment status PATCH endpoints. Implement the documented transition commands atomically with expected-version checks, row locks, idempotency and audit events.
- Money uses integer minor units and explicit ISO currency; weight integer grams, dimensions integer millimeters, timestamps timestamptz. Never floating-point money.
- Webhooks require raw-body signature validation, environment/account checks, unique event IDs, durable processing and replay tests. Do not trust browser redirects as payment evidence.
- Prevent IDOR, XSS, CSRF and abuse. No unsanitized HTML, permissive CORS, in-memory-only distributed rate limits, or unsigned webhook shortcuts.
- Never log message bodies, contents declarations, identity data, credentials, signed URLs or payment secrets. Logs are allowlisted structured events.

## Data and environments

Never use production for development or tests. The existing Flyco-app remote project is staging; flyco-production is production. No remote schema/data mutations without identified target environment and reviewed migration plan. Use Supabase local for development. docs/schema.sql is a design reference, NOT an application migration. Never apply it to a shared database. Promote reviewed, additive migrations in small phases after testing reset, RLS and upgrade paths. Do not rewrite deployed migrations; expand/migrate/contract instead. Document backup/restore and rollback implications. No actual Stripe charges in foundation work; all future test work uses sandbox credentials. No real emails to unapproved recipients in nonproduction.

## Quality

Do not disable TS errors, weaken strict mode, use unjustified any, silence errors, or suppress lint merely to pass. Use unknown and validate. Handle errors with safe messages and correlation IDs. Consider retries, simultaneous requests, double bookings, overselling, stale JWTs and duplicate/out-of-order webhooks. Back critical invariants with constraints and transaction tests. Include positive and negative authorization tests with different users. Never label a skipped check as passing.

Run `pnpm check`, `pnpm secrets:check` and relevant Playwright/DB tests before declaring work ready. Add tests proportional to risk; no fake coverage. Future schema changes require local pgTAP/RLS tests. CI and production approval rules must never be weakened to unblock delivery. Format all supported files. Keep documentation and env.example in sync. Use French/English/Arabic locale dictionaries and logical CSS for RTL; do not concatenate translated sentences. Accessibility target WCAG 2.2 AA.

## Current budget and release boundary

The owner requires free plans only: no paid upgrades, paid add-ons or billable resource creation. Earlier plan-upgrade approval was withdrawn. Local feature development may proceed after its local/CI prerequisites pass; paid-only hosting/protection/recovery controls remain production release blockers. Do not simulate enforcement or enable production deployment to work around plan limits.

## Production operations

Do not create live charges, transfer funds, send messages, change billing plans or destructively modify infrastructure without task authorization. No mock success paths in production. Optional integrations fail explicitly if called without configuration. Reporting must distinguish configured, verified, planned and blocked. Document human-only decisions and operational launch gates; never invent completed service setup.
