# Flyco implementation roadmap

Each phase is independently reviewable and must pass its own security, database, application and hosted-staging checks before the next phase begins. Production remains disabled until the launch gates in `docs/deployment.md` are approved.

## Phase 0 — engineering foundation (complete)

**Objective:** establish the repository, architecture, security model, local Supabase workflow, CI, observability boundaries and service/environment inventory.

**Definition of done:** pinned toolchain, strict TypeScript, lint/format/test/build/secret checks, database design and security documentation, separate staging/production projects, and a reviewable deployment process.

## Phase 1A — authentication and account security (complete)

**Objective:** implement Supabase Auth, verified email, recovery, secure sessions, protected account routes, distributed Auth throttling and the initial private profile row.

**Definition of done:** local and hosted Auth lifecycle, token-hash email flows, SMTP, cookie/CSP/origin checks, RLS/Data API denial tests, Sentry redaction verification and staging-only migrations.

## Phase 1B — profile, trust and locations (complete)

**Objective:** provide the member identity foundation required by later marketplace records without creating transactional features.

**Delivered:** private profile fields; narrow public member cards; avatar Storage policies; E.164 phone handling; objective trust projection; identity-verification attempts and audit events; normalized FR/MA locations; a provider-neutral geocoding boundary; mobile FR/EN/AR UI.

**Definition of done:** exact-head CI, pgTAP and direct Data API/Storage authorization checks, staging migration and hosted verification, synthetic-data cleanup, accurate documentation and no production change.

## Phase 1C — traveler trips (complete)

**Objective:** let an authenticated, active member create and manage a trip using normalized locations and explicit capacity/category constraints.

**Dependencies:** merged Phase 1B schema; product decisions for supported item categories, publish lead times, route granularity and capacity units.

**Implementation tasks:**

- Add `trips`, trip category preferences and any narrowly required reference data by additive migration.
- Reference normalized origin and destination locations; reject identical endpoints and invalid date order.
- Store capacity as integer grams and timestamps as `timestamptz` with a recorded route timezone policy.
- Implement explicit commands for draft, publish, edit, cancel and expire. Published-trip edits must preserve future booking invariants; no arbitrary status patch endpoint.
- Enforce owner writes and intentionally limited published-trip reads with column grants and RLS.
- Add localized, mobile-first create/edit/list/detail UI and server-side Zod validation.
- Record audit events for lifecycle transitions and security-relevant changes.

**Tests:** constraints and indexes; owner/other/anonymous/restricted-user pgTAP and Data API cases; stale/concurrent update tests; invalid location/capacity/date payloads; FR/EN/AR and RTL Playwright flows; hosted staging smoke and cleanup.

**Definition of done:** a member can securely manage only their own trips; the public projection reveals only approved fields; transition and concurrency invariants are database-backed; all CI and staging checks pass. Delivery requests, matching, bookings, messaging and payments remain excluded.

## Phase 1D — sender delivery requests and items (complete)

Implemented sender requests, a V1 declared shipment item, private item photos and versioned lifecycle commands using normalized locations. Category, exact measurement, flexible date-window, public projection, audit and expiration boundaries are database-backed. Matching and booking remain excluded.

## Phase 1E — deterministic matching

Implement explainable route/date/category/capacity filtering and ranking over published trips and requests. Store match reasons and algorithm version; test boundary dates, capacity and deterministic ordering.

## Phase 4 — bookings and messaging

Implement the reviewed booking state machine, atomic capacity reservation, participant-only conversations, confirmation evidence and dispute entry points. Protect every transition with expected-version checks, locks, idempotency and audit events.

## Phase 5 — Stripe Connect payments

Proceed only after corridor, legal and Connect-account decisions. Implement the independent payment state machine, signed durable webhooks, ledger/audit records, fees, refunds and payout readiness in Stripe test mode before any production enablement.

## Phase 6 — moderation and administration

Implement the separately authorized `/admin` boundary, MFA-enforced staff roles, case assignment, reports, verification review, disputes and audited moderation/finance commands.

## Phase 7 — launch hardening

Complete performance/load testing, accessibility review, recovery drills, data retention and deletion workflows, legal/customs content, operational alerts, incident ownership and protected production release controls. Production migration and traffic require a separate explicit launch authorization.
