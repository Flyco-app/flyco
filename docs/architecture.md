# Architecture

## Decision: a modular monolith

Use one Next.js App Router application at the repository root. A monorepo with apps/web, apps/admin and five shared packages would create multiple builds, deployments and abstraction boundaries before reuse exists. Keep UI, validation and integration code in clear modules; extract a pnpm workspace only when a second independently released application or worker needs shared code. pnpm-workspace.yaml currently configures dependency build permissions, not multiple packages.

`src/app` owns routing and presentation. `src/components/ui` will contain source-owned shadcn primitives. `src/modules/<domain>` will own use cases, schemas and data access when the corresponding phase begins. `src/lib` is small infrastructure: environment validation, Supabase, provider factories and monitoring. Do not put all business logic in lib or route handlers.

The future `/admin` subtree is a distinct authorization surface inside the same deployment. Every server read/action must check live staff permissions and MFA; route/layout checks alone do not secure anything. It currently returns 404. Separate admin deployment is a later defense-in-depth option, not a substitute for permission checks.

## Request path

Browser → Next.js server boundary → input schema → verified Supabase identity → authorization/use case → database transaction/RLS → minimal DTO. Use Server Components for reads, Server Actions for same-origin forms, versioned route handlers for webhooks and future external clients. No extra backend framework, ORM, GraphQL gateway or generic repository layer for V1. SQL migrations are canonical; generate TypeScript types from the database.

Use Supabase Auth, PostgreSQL, private Storage and selectively Realtime. The database enforces ownership and invariants; Next validates inputs and business permissions. Stateless Vercel Node functions never store durable work in memory. Database outbox and leased jobs handle provider operations. Jobs must survive function termination. Do not depend on fire-and-forget promises or a cron singleton.

## Consistency and transactions

One transaction locks trip, request and booking in a documented consistent order, verifies expected version, reserves capacity, appends events and enqueues work. External APIs are called after commit using stable idempotency keys. A follow-up transaction records results. Reconciliation repairs ambiguous outcomes. Deadlock/serialization errors are bounded-retryable; authorization/validation errors are not. UTC clocks come from PostgreSQL for deadlines.

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
