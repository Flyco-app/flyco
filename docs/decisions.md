# Decision register

## Accepted engineering decisions

| ID  | Decision                                                                    | Reason / reconsider when                                                                                                                        |
| --- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | Single modular Next.js app; secured admin subtree later                     | Small operational surface; extract only on independent deployment need                                                                          |
| A02 | SQL migrations + generated types, no ORM                                    | Native constraints/RLS/transaction control; fewer overlapping schemas                                                                           |
| A03 | Separate fulfillment, collections, refunds, transfers, payouts and disputes | Avoid invalid combined status graph and preserve audit history                                                                                  |
| A04 | Exact canonical city matching, deterministic lexicographic ranking          | Explainable V1; no LLM or geospatial dependency                                                                                                 |
| A05 | One traveler/request per booking, all request items together                | Bounded capacity/payment/dispute ownership; multi-leg materially changes schema                                                                 |
| A06 | Private sensitive schemas/buckets, explicit DTOs and least-privilege grants | Prevent discovery/Realtime leaks                                                                                                                |
| A07 | Database inbox/outbox + transaction locks and idempotency                   | Durable recovery across independent providers                                                                                                   |
| A08 | EU West staging/production; local Docker for development                    | Current region alignment; residency requires legal approval                                                                                     |
| A09 | GitHub Flyco-app/flyco private                                              | User-selected organization; private production source                                                                                           |
| A10 | Existing Supabase is staging; separate flyco-production created             | User-approved environment separation and $0/month provisioning quote                                                                            |
| A11 | Flyco Stripe test mode selected, no live actions                            | User selection; separate sandbox not used                                                                                                       |
| A12 | Framework latest stable; compatible pinned tooling                          | Next 16.3.5 verified; TypeScript 7 incompatible with current TS lint parser; ESLint 10 peers unsupported by Next's current React/import plugins |

A12 carries a tooling maintenance risk: ESLint 9 is the compatible line but upstream marks it unsupported. Track Next/plugin compatibility and upgrade as soon as supported; do not suppress peer warnings or replace security checks with silent skips.

## Decisions requiring owner/business input before dependent work

| Priority | Decision                                                                  | Expensive consequence / recommended next step                                                     |
| -------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Blocker  | Flyco incorporation/platform country; traveler residence/bank eligibility | Determines Connect availability and legal responsibility; obtain Stripe written corridor approval |
| Blocker  | Customs/carrier restrictions and eligible item categories/value/weight    | Determines matching/acceptance, liability and compliance; approve route-specific rulebook         |
| Blocker  | Merchant-of-record, losses/fees/taxes, payout/hold policy                 | Changes funds flow and ledger; confirm with Stripe and qualified advisers                         |
| High     | Commission/currency, payment timing and booking horizon                   | Snapshot pricing/FX/cancellation terms; propose EUR-only pilot but not approved                   |
| High     | Cancellation, returns, delivery acceptance, disputes and refund windows   | Controls transitions, deadlines and reconciliation compensation                                   |
| High     | Insurance and loss/damage liability; traveler eligibility/age             | Changes claims, terms, verification requirements and support burden                               |
| High     | Identity provider and data/retention policy                               | Avoid storing documents prematurely; assess GDPR/local privacy needs                              |
| High     | Hosting/recovery budget and operational owner                             | Approve commercial Vercel plan and reliable Supabase backups/restore targets                      |
| Medium   | Domain, transactional sender identity and brand/localized copy            | Needed for DNS verification, Auth redirects, emails and native Arabic QA                          |
| Medium   | Admin assignees, escalation and dual-approval thresholds                  | Needed before exposing moderation/finance actions                                                 |

## Deferred deliberately

No mobile app, microservices, split admin deployment, AI matching, PostGIS, SMS/push, multi-leg delivery, multiple settlement currencies or general-purpose workflow framework. This does not prevent adding them later; each needs a concrete product requirement and migration/design review.
