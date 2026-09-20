# Flyco

A peer-to-peer delivery marketplace connecting senders with travelers already taking a route, starting with France ↔ Morocco. One account can do both.

**Current scope: Phase 1A identity baseline.** Supabase Auth, cross-browser token-hash email verification, login/logout, recovery, distributed auth throttling, profile editing and account settings are implemented; the two Phase 1A migrations are installed on staging. The staging preview sends Auth-only transactional email through the verified Resend subdomain to approved synthetic recipients. Listings, bookings, matching, payments and admin features are not implemented. No production data or live payment is used.

## Architecture

One modular Next.js App Router application, TypeScript strict mode, pnpm, Tailwind and shadcn/ui setup. Supabase provides PostgreSQL/Auth/private Storage and selective Realtime. Stripe Connect, Resend and Sentry adapters have server-only configuration boundaries. A separately authorized `/admin` area will be added inside the same application; it currently returns 404. No monorepo until a second deployable needs shared packages.

## Prerequisites

- Node 24 (`.node-version` / `.nvmrc`), Corepack with pnpm 12.4.2.
- Docker-compatible runtime for Supabase (Docker Desktop or Colima).
- Git. Provider accounts are unnecessary for the foundation build/tests.

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Open http://localhost:3000. APP_URL, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and hosted AUTH_RATE_LIMIT_HMAC_SECRET are required to use hosted authentication. APP_ENV defaults to local when blank. Do not put production credentials into this checkout.

## Supabase local setup

```sh
pnpm db:start:auth
pnpm db:auth:check
pnpm exec supabase status
pnpm db:reset
pnpm db:lint
pnpm db:test
```

Copy the local API URL/publishable key from local status into SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY in .env.local only when developing auth. Never copy a service-role/secret key into a public variable. The Auth development profile runs PostgreSQL, Auth, REST/gateway and Mailpit. Studio, Storage and Realtime are not started by this profile. The full stack remains available via `pnpm db:start` but its health is not yet verified on this host. Local email inbox: http://127.0.0.1:55324. Keep local status credentials out of logs/issues. Stop with `pnpm db:stop`.

The existing remote project is **staging**. The separate **flyco-production** project is reserved for reviewed releases. Local validation rejects remote databases; hosted environment checks reject staging/production cross-use. No remote connection is needed for development.

`docs/schema.sql` is a default-deny **design reference, not a migration**. Do not apply it to a shared database. The Phase 1A profiles migration is real and tested locally; the rest of the reference remains undeployed. Future migrations arrive incrementally with commands, RLS policies and tests. See [database design](docs/database.md).

## Environment configuration

`.env.example` contains names and empty values only. Runtime schema lives in `src/lib/env/schema.ts`; server-only accessor in `server.ts`. Stripe/Resend clients throw if invoked without configuration. APP_ENV is local/preview/staging/production; hosted deployments require an HTTPS APP_URL. Supabase and email values are configured in pairs. Only modern sb_publishable_ Supabase keys are accepted; secret/service-role and legacy JWT keys are rejected. Stripe live credentials are rejected outside production and test credentials rejected in production. Provider secrets remain server-side. SENTRY_AUTH_TOKEN and Vercel tokens are CI/deployment credentials, not browser variables.

No secrets are required for an unconfigured build; a configured Auth flow needs the local publishable key and APP_URL. Configure sensitive hosted values via provider/GitHub environment settings once integrations are enabled. Never paste them into chat or commit them. See [deployment](docs/deployment.md) and [services](docs/services.md).

## Checks

```sh
pnpm check
pnpm test:coverage
pnpm secrets:check
pnpm exec playwright install chromium
pnpm test:e2e
pnpm db:profile:check # local Auth profile required
pnpm test:e2e:auth:local # local Auth profile + Mailpit required
```

`pnpm db:start:database` starts only PostgreSQL for schema work; CI uses the Auth profile and tests email verification. When switching profiles, stop only Flyco first with `pnpm exec supabase stop --project-id flyco-local` (preserves volumes); starting an already-running database does not add the missing services. `pnpm db:design:check` validates the reference schema and rolls it back.

`pnpm check` includes a production build; E2E launches that build. `pnpm test:watch` runs Vitest interactively. Database tests need local Docker/Supabase. `pnpm format` applies formatting. Check actual validation outcomes in [verification](docs/verification.md).

## Deployment

Private GitHub repository: [Flyco-app/flyco](https://github.com/Flyco-app/flyco). Work through `codex/*` branches and PRs. CI runs lint/types/tests/build, local Auth E2E, Data API/RLS tests and database guardrails. Planned required sequence: successful CI → exact-commit Vercel preview E2E → review → merge → protected production release. Automatic Git deployments are disabled until enforcement/setup is ready. Provisioning and plan constraints are recorded rather than hidden behind a green local test. No production schema or money movement is deployed by this foundation.

## Engineering documentation

[Product](docs/product-spec.md) · [Architecture](docs/architecture.md) · [Database](docs/database.md) · [Security](docs/security.md) · [API/state machines](docs/api-design.md) · [Auth/roles](docs/auth.md) · [Payments](docs/payments.md) · [Matching](docs/matching.md) · [Testing](docs/testing.md) · [Deployment](docs/deployment.md) · [Observability](docs/observability.md) · [Roadmap](docs/roadmap.md) · [Decisions](docs/decisions.md).

Read [AGENTS.md](AGENTS.md) before future Codex work. Business launch blockers include supported Morocco-recipient payout arrangements, carriage/customs eligibility, liability, pricing/refund policy, identity/privacy rules and commercial hosting/recovery plans.

## Free-plan development boundary

No paid upgrades are authorized. Local/CI Phase 1 work can begin once the Auth infrastructure checks pass. Production remains disabled until enforceable release controls, supported commercial hosting, recovery and provider prerequisites are met. Free-plan review/merge discipline is a procedural control, not server-enforced branch protection. See [delivery status](docs/deployment.md).
