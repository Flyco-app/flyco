# Architecture

## Decision: a modular monolith

Use one Next.js App Router application at the repository root. A monorepo with apps/web, apps/admin and five shared packages would create multiple builds, deployments and abstraction boundaries before reuse exists. Keep UI, validation and integration code in clear modules; extract a pnpm workspace only when a second independently released application or worker needs shared code. pnpm-workspace.yaml currently configures dependency build permissions, not multiple packages.

`src/app` owns routing and presentation. `src/components/ui` will contain source-owned shadcn primitives. `src/modules/<domain>` will own use cases, schemas and data access when the corresponding phase begins. `src/lib` is small infrastructure: environment validation, provider factories and monitoring. `src/lib/supabase` contains only a README; request-scoped Supabase clients do not exist yet. Do not put all business logic in lib or route handlers.

The future `/admin` subtree is a distinct authorization surface inside the same deployment. Every server read/action must check live staff permissions and MFA; route/layout checks alone do not secure anything. It currently returns 404. Separate admin deployment is a later defense-in-depth option, not a substitute for permission checks.

## Request path

Browser → Next.js server boundary → input schema → verified Supabase identity → authorization/use case → database transaction/RLS → minimal DTO. Use Server Components for reads, Server Actions for same-origin forms, versioned route handlers for webhooks and future external clients. No extra backend framework, ORM, GraphQL gateway or generic repository layer for V1. SQL migrations are canonical; generate TypeScript types from the database.

Use Supabase Auth, PostgreSQL, private Storage and selectively Realtime. The database enforces ownership and invariants; Next validates inputs and business permissions. Stateless Vercel Node functions never store durable work in memory. Database outbox and leased jobs handle provider operations. Jobs must survive function termination. Do not depend on fire-and-forget promises or a cron singleton.

## Consistency and transactions

One transaction locks current account controls (ordered by UUID), then trip, request and booking in a documented consistent order, verifies expected version, reserves capacity, appends events and enqueues work. External APIs are called after commit using stable idempotency keys. A follow-up transaction records results. Reconciliation repairs ambiguous outcomes. Deadlock/serialization errors are bounded-retryable; authorization/validation errors are not. UTC clocks come from PostgreSQL for deadlines.

## Privacy boundaries

Profiles contain display data only; private contact/pickup details live separately. Discovery returns an explicit safe projection, never `select *` from trips/requests. No public discovery policy may accidentally expose notes or exact addresses. Staff access is scoped by capability/case assignment. JWT metadata is not the authority for staff roles. See database.md for policy ownership.

## Frontend and localization

Tailwind v4 and shadcn configuration are installed; add primitives as they are used. No unused product UI. Locale routing and dictionaries arrive with auth shell: `/fr`, `/en`, `/ar`; `/admin` can use a separate staff locale preference. Validate locales, render `<html lang dir>`, use Intl and logical CSS. No external font fetch in builds. Sentry server initialization is optional; browser monitoring/source-map upload are explicit later setup tasks.

## Scaling triggers

First optimize indexed queries, keyset pagination and transaction duration. Add a dedicated queue worker when outbox volume exceeds bounded scheduled batches. Introduce PostGIS only when approximate-radius matching is a product requirement. Extract services only for an independently scaling operational workload. Start with an EU database and nearby compute; residency/backup locations require review before production.

## Sources checked

- [Next installation](https://nextjs.org/docs/app/getting-started/installation): Next 16.3.5 verified against npm on 2026-09-17.
- [Supabase security](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [shadcn existing Next.js setup](https://ui.shadcn.com/docs/installation/next).

## Phase 0 review: what actually runs

Implemented: preparation page, static security headers, strict environment parser, lazy server-only Stripe/Resend factories, optional privacy-allowlisted Sentry server capture, local Supabase config, unit/Playwright/pgTAP tooling and CI. There are no product migrations, Auth clients/proxy, command RPCs, storage policies, queue workers or admin endpoints. `docs/schema.sql` creates 42 reference tables only inside the rolled-back design test. It is not installed by `db:reset`.

Keep Phase 1 small: migrate only identity/profile/control concerns with working grants and negative RLS tests. Do not generate all domain modules or 42 tables up front. Reuse ordinary functions and PostgreSQL transactions rather than introducing repository interfaces, workflow frameworks or event sourcing. Reference-only ledger/payout/queue models must be revisited against provider behavior when their phase starts.

The review tightened default-deny testing, service-key rejection, provider-target validation, telemetry allowlisting, normalized reservations and transfer FKs, index coverage and worker lease design. See [review findings](phase-0-review.md). Security design is not equivalent to implemented security: RLS/grants/RPC boundaries and race tests are acceptance requirements of each future migration.

## Readiness under the free-plan constraint

Phase 0A is verified. Phase 0B's local Auth/email prerequisites are tested through a scoped profile (PostgreSQL, gateway/REST, Auth and Mailpit); the full Storage/Realtime/Studio profile remains unresolved on this host. Phase 1A may begin locally after CI passes. No product functionality is introduced by these infrastructure tests.

Hosted readiness is separate: exact-commit preview verification, staging delivery, monitoring access and enforceable branch/production controls remain open. No paid upgrades are authorized. Procedural reviewed merges on GitHub Free are not equivalent to protected branches; production deployment stays disabled. Future phases introduce their service dependencies only after independently testing them.
