# Environments and delivery

## Environment registry

| Environment | Database and providers                                                             | Purpose                                                                       |
| ----------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| local       | Supabase Docker `flyco-local`, local Mailpit, Stripe Flyco test mode when required | Daily coding, synthetic data only                                             |
| preview     | Ephemeral Supabase branch/project per trusted PR; Stripe test mode and email sink  | Isolated review; foundation shell works with no providers                     |
| staging     | Existing Flyco-app project `xivkbucvwsioxevlijzj`, EU West                         | Integration/rehearsal with synthetic data only                                |
| production  | flyco-production `mcmeroatheonlgxvveyl`, EU West                                   | Real users only after launch gates; newly provisioned, no product data/schema |

No production database in development, previews or CI. No fallback from missing preview DB to staging/production. Provision preview branches only when paid-resource approval and provider isolation are available; foundation previews need none. Local env validation rejects remote DB URLs. Hosted configuration must explicitly select APP_ENV and approved project reference. Preview APP_URL may derive from the validated provider-supplied VERCEL_URL. Environment credentials are not shared. Separate webhook endpoint/signing secrets by mode/environment; Flyco test-mode data can still interfere between staging/preview, so use per-run resource metadata and strict cleanup, or isolated sandboxes when needed.

## Pipeline

`codex/* branch → PR → format/secret scan/lint/typecheck/unit+DB tests/build → Vercel preview → exact-preview E2E → review → merge → protected production release`.

CI is executable without provider secrets. GitHub-hosted runners start Supabase locally. Preview E2E can be manually dispatched with an immutable deployment URL; automatic deployment remains disabled in vercel.json until protected release configuration is established. A manual URL alone does not prove commit identity: before making this a merge gate, verify Vercel deployment git SHA/project/target against the PR head and post a required status for that SHA. Never run privileged pull_request_target checks on untrusted PR code.

Production release must require successful main-commit CI, staging migration validation and a protected `production` environment approval. Build a production-configured deployment without assigning the domain, smoke-test its immutable URL, then promote. Preview builds containing different public environment variables must not be promoted as production builds. Restrict deploy credentials and main pushes; disable auto production deploys that bypass review. Repository configuration alone is not an enforced gate when the hosting/GitHub plan does not support protection; record that limitation.

## Provisioning status vs plan

See services.md. Supabase staging and production exist. A Vercel preview creation was accepted but cannot yet be read/verified through the connector. CI deployment credentials, DNS, production paid plans/backups, Resend domain and Sentry project remain setup work. No real transactional endpoint exists, so do not configure active payment webhooks yet. Do not claim delivery automation is live merely because YAML exists.

## Local database workflow

Pinned CLI via pnpm. `pnpm db:start` starts Docker services; `pnpm exec supabase status` displays local connection values (do not paste its secret output into issues). Local Studio at 127.0.0.1:55323, Mailpit at :55324. `pnpm db:reset` explicitly uses --local. Inspect `pnpm exec supabase migration --help`, create a named migration, implement one reviewed schema slice, run reset/lint/tests, generate types, review diff. No remote link is needed for local work.

## Migration/release runbook

1. Identify exact project reference and deployment commit; require staging pass and approved backup/restore capability.
2. Review additive DDL, lock/runtime estimates and rollback plan; preflight migration diff against target history. Separate schema deploy credentials from app runtime.
3. Apply expand migration once; verify health and constraints; deploy backward-compatible code. Batch backfills with progress, idempotency and bounded locks.
4. Remove obsolete columns only in a later approved contract release. Never blindly reverse a migration that has accepted data.
5. On application failure, roll back to prior compatible deployment. On data failure, stop affected writes and use approved recovery procedure; restore to an isolated target first, reconcile provider effects before cutover.

## Human-controlled release gates

Commercial Vercel plan, Supabase recovery plan, Stripe corridor/business approval, legal/customs policies, SMTP domain ownership/DNS, Sentry access and alert recipient, staff assignment/incident ownership. These cannot be invented by engineering. Automation should perform all configuration once authorized/access is available; humans supply ownership, billing approval and business decisions, not code.

[Vercel Hobby limits](https://vercel.com/docs/plans/hobby) restrict Hobby to non-commercial use. The current connected team is Hobby, so paid commercial hosting approval is a launch gate.

## Verified GitHub plan limitation

The private organization repository is on Free. Main branch protection creation returned HTTP 403 (upgrade required). Required production environment reviewers returned HTTP 422 (billing plan unsupported). The production environment exists with a protected-branch policy only; this is NOT a working approval gate. Keep deployment disabled until branch protection and independent review are enforceable. Engineering will configure the rules after an appropriate organization-plan upgrade is approved; do not make source public to bypass this limitation.
