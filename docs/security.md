# Security model

## Threat model

Protect identities, addresses, item contents, messages, evidence and money from outsiders, malicious members, compromised accounts, excessive staff access and forged provider events. Untrusted boundaries: every browser payload, filename, webhook, realtime topic, redirect and admin form. A private repository is not a secret vault.

## Implemented foundation controls

Strict TypeScript/Zod, server-only provider factories, empty-value env template, ignored secrets/artifacts, local-only Supabase configuration with explicit grants required, no product API exposure, baseline security headers, privacy-filtered optional server Sentry, tests for configuration isolation/redaction, CI secret-pattern scan and lockfile. No service-role variable/client is present. Schema reference is default-deny and not a migration. These controls do not constitute finished product security.

## Controls required before corresponding features

- Verify session and authorize every server operation; owner checks in RLS and command transactions. Reject ownership/status/price/role overposting. Use SECURITY INVOKER by default and explicit column privileges. RLS tests include direct Data API access and negative identities.
- Staff boundary: live revocable role grants, MFA aal2, least privilege, case assignment for private content, immutable audit trail and dual approval for sensitive finance/role changes. Never derive roles from user_metadata.
- CSRF: same-origin Server Actions with Next origin checks, validated Origin on cookie-authenticated unsafe route handlers, SameSite cookies and CSRF tokens where browser context needs them. No state-changing GET. Provider webhooks use signatures instead of browser CSRF tokens. Never add broad allowedOrigins to bypass errors.
- XSS: React escaping/plain-text messages; no dangerouslySetInnerHTML for user input, no executable SVG/HTML uploads, safe URL schemes, security headers. The current CSP blocks framing/objects/base abuse but is not a complete script policy. Before auth/product UI ships, implement nonce-based per-request script CSP (dynamic rendering), evaluate necessary Stripe/Supabase/Sentry origins and remove unsafe-inline/unsafe-eval in production. Test actual browser violations rather than merely header presence.
- Rate limiting: distributed atomic counters (Postgres function initially; external store only when justified), composite IP/account/operation keys, server-derived trusted client IP, hashed short-lived IP identifiers. Auth 5/min/account and 30/min/IP, message 30/min/account, proposals 10/min/account, code attempts max 5/challenge are initial test settings pending abuse review. Return 429/Retry-After. Money/identity/code operations fail closed if limiter unavailable; public discovery may degrade under bounded caching. Supabase Auth limits and Vercel WAF supplement application limits.
- Uploads: private buckets, size/MIME/magic-byte/pixel bounds, decode/re-encode + EXIF removal, scan quarantine, random object paths, no client-selected ownership, short-lived URLs and orphan cleanup. Presigned uploads are capability tokens; never log them. Shared metadata policies join resource ownership.
- One-time codes: cryptographic random generation, hash/HMAC with server pepper, expiration, attempt counter, single-use transaction and reissue invalidation. Don't store or send code in audit/notification metadata.
- Financial webhooks: raw-body signature, timestamp tolerance, provider account/mode check, unique event key, durable inbox before acknowledgement, retry/reconciliation. No trusting success URLs.
- Realtime: private channels, membership checks at subscription and after revocation; do not expose identity/finance/audit tables. No messages in broadcast logs.

## Data minimization / retention

Prefer identity provider references to documents. Exact pickup/address details only after authorized booking stage. Strip personal data from telemetry. Define retention by class with legal review: operational messages/evidence, verification records, financial audit and deletion requests have different obligations. Do not invent a statutory retention number. Separate public profile display from private contacts; remove/anonymize non-required data on account closure while preserving lawful audit relationships. Document subprocessors, data residency, consent and breach procedure before launch.

## Secrets / supply chain

Vercel sensitive environment variables and GitHub protected environment secrets; separate credentials per environment. Build-time Sentry auth token never becomes a runtime/public variable. Restricted Stripe keys preferred. Authenticated workloads should use workload identity where supported. Review dependency updates and lifecycle scripts; pnpm allowBuilds lists intentional allow/deny entries. Lightweight repository scanner is a guardrail, not proof of no secrets; enable GitHub secret scanning/push protection if plan allows and use history-aware scanning before release. Rotate any exposed secret, remove access, and investigate; deleting a file alone is insufficient.

## Incident response

On suspected compromise: suspend relevant capability, revoke sessions/keys, preserve redacted audit evidence, reconcile payments, notify designated incident owner, determine reporting duties, fix and regression-test, review incident. Document runbooks for compromised member/staff, payment mismatch, malicious upload and provider outage. Recovery tests must establish actual RPO/RTO; proposed launch targets RPO ≤24h and RTO ≤4h require business acceptance and a suitable backup plan, not current guarantees.

Source: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [private storage](https://supabase.com/docs/guides/storage/buckets/fundamentals), [Next CSP](https://nextjs.org/docs/app/guides/content-security-policy), [Stripe webhook security](https://docs.stripe.com/webhooks).
