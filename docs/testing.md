# Authentication and authorization

Status: Phase 1A member sign-in/profile flows implemented locally; staff/admin authorization remains design only.

## Identity

Supabase Auth owns credentials and email verification; profiles.id references auth.users.id. One user may be sender and traveler concurrently. Neither is an administrative role. Disable anonymous sign-in. Require verified email before publishing, messaging or booking. Never authorize from editable user_metadata. Display profile changes cannot change account status or verification.

Use @supabase/ssr request-scoped clients. Validate server identity with the documented getClaims/getUser flow; never trust getSession alone. Sensitive changes require a current server-validated user/session, live restriction checks and appropriate reauthentication. Refresh tokens in the Next proxy with response cookie propagation; use cookie adapters appropriate to their execution context. Do not swallow cookie-write errors. Do not cache personalized responses across users. Cookie Secure in HTTPS, SameSite=Lax, path=/ and host-only; use HttpOnly for cookies owned by server-only flows, respecting SSR SDK requirements for browser session access.

Authentication callbacks use PKCE and a bounded allowlist of same-origin relative redirects. Reject protocol-relative URLs, encoded backslashes and unapproved return URLs. Auth errors must not reveal account existence. Recovery codes are single-use; password reset revokes other sessions according to approved policy. Enable custom SMTP after Resend domain verification; local emails go only to local Mailpit. Rate limit by IP and account fingerprint before invoking auth endpoints.

## Role model

| Role/capability       | Scope                                                                  |
| --------------------- | ---------------------------------------------------------------------- |
| Member                | Own profile/listings and bookings as either participant                |
| Support               | Assigned support cases and minimal necessary booking data              |
| Moderator             | Reports, content decisions and account restrictions; no finance writes |
| Verification reviewer | Assigned identity cases; no payouts or unrelated conversations         |
| Finance operator      | Payment/refund investigation and approved financial commands           |
| Administrator         | Staff membership management, configuration, audited escalation         |
| Worker                | Narrow machine role for one job, never a user-controlled credential    |

Store staff_roles in private schema with grants/revocations and assigning actor. Sensitive role changes should require two-person review; bootstrap through audited operator procedure, never public signup. Require aal2/MFA for all admin access, short sessions and live DB role/restriction checks on every sensitive command. A role in an old JWT cannot preserve revoked staff authority.

## Account restrictions

Account state: active → restricted → suspended → closed, with authorized reinstatement from restricted/suspended only. Restricted capabilities are explicit; no new bookings when restricted, but allow safe access to existing dispute support where policy permits. Suspend/revoke sessions first; deleting auth.users alone does not invalidate existing JWTs. Every money/data mutation verifies current restriction state. Anonymization is a reviewed job; preserve legally required financial/audit references without retaining unnecessary PII.

## Identity verification state machine

Each provider attempt has an immutable identity/provider reference and versioned state in identity_verifications; transitions are audited and a current account_controls projection is updated in the same transaction. `not_started` is absence of an active attempt. New attempt: pending → requires_input | under_review | verified | rejected | cancelled. requires_input → pending | cancelled. under_review → requires_input | verified | rejected | cancelled. verified → expired | revoked. rejected/cancelled/expired/revoked are terminal for that attempt; retry creates another row. Expiry/revocation blocks newly restricted operations but does not erase booking history.

Only verified provider events or assigned reviewers can transition; applicants can begin/cancel an unfinished attempt through an authorized command. Provider event uniqueness and version checks prevent stale events overwriting newer decisions. Store provider reference, timestamps, reason code and validity, not raw document contents. Stripe account capability readiness is separate from Flyco identity verification.

## Tests before rollout

Two users + anonymous + suspended + expired-token + revoked-staff + MFA/non-MFA identities. Cover email verification, tampered redirect, refresh race, logout/recovery, CSRF, profile ownership transfer attempts, role escalation via metadata, and cross-user reads. Test RLS through the Data API as well as through the application. No test requires production credentials.

## Phase 1A implementation boundary

Signup, sign-in, sign-out, recovery request, recovery completion, verified-email confirmation, profile/settings and email-change forms use Next Server Actions. Zod validates form fields and confirmation query parameters. Supabase Auth owns passwords and confirmations; no password is stored by Flyco. `/auth/confirm` displays a read-only GET interstitial and POSTs to `verifyOtp`; successful verification redirects only to the fixed route allowed for that OTP type. Password reset and login errors use account-neutral UI. Global sign-out revokes refresh sessions; existing access tokens may survive until the configured 15-minute expiry.

The request-scoped SSR client uses host-only HttpOnly, SameSite=Lax cookies, Secure on hosted HTTPS. The proxy propagates refreshed cookies. `getUser()` and `email_confirmed_at` gate the server profile route/action, then the current RLS-protected profile row checks active status. No user_metadata field grants capability; `display_name` from signup metadata is revalidated and used only as initial self-owned presentation text. Users may change email through Supabase double-confirmation. The first verified request inserts a profile as the logged-in user under RLS; no service key or privileged Auth trigger handles user operations.

Local Mailpit + Playwright prove signup, denied unverified login, cross-context confirmation, replay denial, profile edit, sign-out, recovery, password reset, double-confirm email change and re-login. pgTAP/Data API tests prove self, other and anonymous access. PostgreSQL-backed application throttling is implemented for signup, login, recovery, email change and confirmation. Hosted SMTP and exact-deployment verification remain release gates.

## Phase 1A security review

Profile writes run with the member JWT; RLS and column grants deny IDOR, ownership transfer and account-status overposting even through direct PostgREST. The server checks verified identity via `getUser()` and live account status before profile changes. Recovery has a neutral public response and signs out globally after password change. Confirmation destinations are type-specific application paths. Next Server Actions provide same-origin enforcement; the confirmation GET is read-only and the POST consumes the token. No service-role key is loaded in app code. Only local synthetic tests use the local secret key and delete their fixtures.

**Open before hosted release:** verify a Resend sending domain, install the reviewed templates and custom SMTP in staging, configure the exact Vercel deployment, then verify hosted cookies/CSP/origin behavior, direct Data API denial, account restrictions and session revocation timing. Phase 1A remains unmerged until those checks are recorded.

## Phase 1A local tests

`pnpm db:reset && pnpm db:test` applies the real profile migration and runs pgTAP positive/negative RLS, grants and suspended-account cases. `pnpm db:profile:check` creates two synthetic verified local Auth users and checks REST/Data API ownership, anonymous denial and blocked status/ID writes. `pnpm test:e2e:auth:local` derives loopback-only keys from local CLI status, builds production output, and runs Playwright against local Auth/Mailpit; it cleans its synthetic user. The CI database job runs all three. The ordinary E2E job remains credential-free for the preparation shell and does not claim Auth coverage.
