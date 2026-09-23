# Environments and delivery

## Phase 1F promotion

The additive Phase 1F migration may reach staging project `xivkbucvwsioxevlijzj` only after exact-head CI passes. The existing Git-backed Vercel project must supply the Preview for that same commit. Hosted verification uses synthetic participant/listing/booking data and removes it afterward. Production remains disabled and must not receive this migration.

The booking/reservation migration is applied to staging. The initial Git-backed Preview for commit `5e6ee7234d52059276188382ebe765d78f247721` completed and passed the hosted participant flow. Synthetic users, sessions, profiles, listings, matches, booking, reservation, receipts and events were deleted afterward. The additive booking-event actor index awaits its own final exact-head CI before staging application. Production project `mcmeroatheonlgxvveyl` remains untouched.

## Phase 1E staging deployment

The additive `phase_1e_deterministic_matching` migration is applied only to staging project `xivkbucvwsioxevlijzj`, after the exact implementation head passed every required check. The existing Git-backed Vercel project produced the matching Preview; no new Vercel or Supabase project was created. Hosted verification used synthetic members, a trip and a request, then permanently removed every fixture. Production project `mcmeroatheonlgxvveyl` remains disabled and untouched.

## Git-backed previews

The existing Vercel `flyco` project is connected to `Flyco-app/flyco`. Pull requests create a preview and report commit status; no second project or deploy hook is needed. `vercel.json` must not disable Git deployments. A feature preview is accepted only after its deployment identifies the exact PR head and uses staging Supabase configuration. Repository migrations remain the schema source of truth. Supabase/Vercel integration presence does not authorize automatic production migrations, database branching or promotion.

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

CI is executable without provider secrets. GitHub-hosted runners start Supabase locally. Pull-request branches produce Git-backed Preview deployments, while `main` is explicitly excluded from automatic deployment in `vercel.json`. Credential-free preview smoke tests can also be manually dispatched with an immutable deployment URL. A manual URL alone does not prove commit identity: before making this a merge gate, verify Vercel deployment git SHA/project/target against the PR head and post a required status for that SHA. Never run privileged pull_request_target checks on untrusted PR code.

Production release must require successful main-commit CI, staging migration validation and a protected `production` environment approval. Build a production-configured deployment without assigning the domain, smoke-test its immutable URL, then promote. Preview builds containing different public environment variables must not be promoted as production builds. `vercel.json` disables automatic Git deployments for `main`; feature and pull-request branches continue to produce Preview deployments. A future production release must remove that branch rule in a separately reviewed release change before an explicit promotion. Restrict deploy credentials and main pushes. Repository configuration alone is not an enforced gate when the hosting/GitHub plan does not support protection; record that limitation.

## Provisioning status vs plan

See services.md. Supabase staging and production exist. The `flyco` Vercel project has a tested immutable preview configured with Preview-only staging variables. `auth.flyco.site` is verified in Resend and Supabase staging custom SMTP uses it for transactional Auth mail. The staging Sentry project accepts a deliberately redacted synthetic server error. Production deployment, paid recovery/hosting controls, release credentials and alert ownership remain setup work. No payment webhook is configured.

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

The private organization repository is on Free. Main branch protection creation returned HTTP 403 (upgrade required). Required production environment reviewers returned HTTP 422 (billing plan unsupported). The production environment exists with a protected-branch policy only; this is NOT a working approval gate. Keep deployment disabled until branch protection and independent review are enforceable. The owner has declined paid upgrades. Do not change plans or make source public. Team would enable private branch protection but would NOT enable required environment reviewers for this private repository; that feature requires Enterprise.

## Review correction: preview credentials and routine merges

The manual smoke workflow does not receive a bypass secret. Hosted verification uses an authenticated, origin-scoped Vercel preview session outside CI; secrets and session material are excluded from traces and artifacts. A `.vercel.app` suffix alone proves neither ownership nor commit identity, so the deployment/project/source commit are checked before recording a result.

The owner authorizes Codex to review and squash-merge routine in-scope PRs after all applicable checks pass on the exact head, without repeated confirmation. Do not bypass branch protections or unresolved reviews. This workflow preference does not grant paid-plan changes or production release approval; automatic production deployment remains disabled.

## Free-plan Phase 0B status (2026-09-18)

No plan was upgraded and no paid resource was created. Local development uses `pnpm db:start:auth`, then `pnpm db:auth:check`. This starts only services required for Phase 1A; it does not ignore health checks or claim Storage/Realtime/Studio are healthy. Switching from database-only mode requires a targeted stop first. Tests use a random synthetic account, a publishable key for all user operations, and a CLI-derived local secret key only to remove that exact fixture. The script rejects any non-loopback/wrong-port target, never reads app/provider credentials and logs neither sessions nor email bodies. Synthetic email remains solely in local Mailpit; its account is deleted. CI suppresses CLI startup output containing local keys.

GitHub Free continues running PR checks; Codex reviews and merges the exact successful head under standing authorization. This is procedural discipline, not enforceable branch protection. Production stays disabled. Vercel preview, Supabase staging Auth/SMTP and the staging Sentry project are configured without a plan upgrade; this does not make the Hobby project suitable for commercial production.

References: [GitHub environment feature availability](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments), [GitHub Team features](https://github.com/team).

## Phase 1A hosted Auth deployment

The two Phase 1A migrations were applied to Supabase project `xivkbucvwsioxevlijzj` (staging) only. Production project `mcmeroatheonlgxvveyl` remains untouched. Staging Site URL and `APP_URL` use the stable `https://flyco-staging.vercel.app` alias, which is moved only to an exact reviewed immutable deployment; the redirect allowlist is empty because the reviewed templates use `SiteURL`. Wildcards and production origins are not approved. Supabase Auth templates match the committed token-hash templates. SMTP uses the verified `auth.flyco.site` Resend subdomain, TLS, transactional credentials, and disabled click/open tracking. `APP_ENV=staging`, staging `SUPABASE_URL`, its publishable key, `AUTH_RATE_LIMIT_HMAC_SECRET`, staging `SENTRY_DSN`, and the temporary `OBSERVABILITY_PROBE_SECRET` are Preview-only Vercel configuration. No secret uses `NEXT_PUBLIC_`.

Hosted verification must use synthetic accounts and delete them afterward. It must record the immutable deployment URL and commit, confirmation/recovery/email-change delivery, replay denial, cookie/CSP/origin behavior, RLS through PostgREST, and the redacted Sentry probe. A preview deployment is not production and must not be promoted.

## Phase 1B staging deployment

Migration `20260921150257_phase_1b_profiles_trust_locations` was applied only to staging project `xivkbucvwsioxevlijzj` after local reset, lint, pgTAP and direct Data API/Storage checks. The immutable verification deployment was `dpl_7m6DmmBsqVTVqUcC238mpUsxSVot`, served through `https://flyco-staging.vercel.app`. Hosted checks used one synthetic account and confirmed authenticated profile editing, the restricted public projection, trust display, location selection, Arabic RTL and security headers. That exact Auth account was permanently deleted after the check. Production project `mcmeroatheonlgxvveyl` remains untouched.

The existing Vercel project is Git-connected. Each staging promotion still records the Git head, immutable deployment ID/URL and CI result before moving any stable alias. The free-plan review controls remain procedural and are not sufficient for production promotion.

## Phase 1D staging deployment

The additive `phase_1d_delivery_requests` migration was applied only to staging project `xivkbucvwsioxevlijzj` after local database reset, lint, pgTAP, direct Data API and Storage authorization checks. Implementation commit `849800dff4bf8fa242d4c81aa48649780456c2e2` passed GitHub Actions run `35766598466` and produced the existing project's Git-backed immutable Preview at `https://flyco-4a34t9eeq-faridiali27-5309s-projects.vercel.app`. No duplicate Vercel or Supabase project was created.

Hosted verification covered request draft/edit, private photo upload, publication, the restricted public projection, FR/EN/AR rendering, RTL, cross-user denial and cancellation. Verification used synthetic accounts and data only. The Storage object was removed through the member-authenticated Storage API before the database rows and Auth accounts were deleted; the post-cleanup query found no remaining Phase 1D fixtures. The stable staging alias was not moved as part of this feature review, and production remained untouched.
