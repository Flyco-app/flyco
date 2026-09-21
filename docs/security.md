# Authentication and authorization

## Phase 1B visibility and mutation rules

`member_profiles` exposes only display name, avatar path, bio, residence and account age. `profile_trust` exposes objective indicators. `profiles` remains self-only and contains preferred language, legal names, phone and account controls. Identity attempts/events are self-readable; provider references and raw identity evidence are not exposed or stored. Column grants prevent writes to account status, phone verification, trust, provider state, reason codes or review timestamps.

Avatar reads are deliberately public because avatars appear on marketplace cards. Upload/update/delete remain JWT- and owner-bound under Storage RLS. Keys are generated as `<user UUID>/<random UUID>.<approved extension>`; the client filename is ignored. The server limits files to 2 MiB, allowlists JPEG/PNG/WebP and verifies signatures. Successful replacement updates the profile before deleting the previous object; failed profile updates remove the new object.

Phone values must be E.164 and match the selected FR/MA residence prefix when a residence exists. Changing the number clears verification. No SMS provider is configured. Members can create pending identity attempts and cancel only pending/requires-input attempts with an expected version. Provider/staff transitions remain unavailable until a trusted internal command exists.

Status: Phase 1B member profile/trust/location controls are implemented locally; staff/admin authorization remains design only.

## Identity

Supabase Auth owns credentials and email verification; profiles.id references auth.users.id. One user may be sender and traveler concurrently. Neither is an administrative role. Disable anonymous sign-in. Require verified email before publishing, messaging or booking. Never authorize from editable user_metadata. Display profile changes cannot change account status or verification.

Use @supabase/ssr request-scoped clients. Validate server identity with the documented getClaims/getUser flow; never trust getSession alone. Sensitive changes require a current server-validated user/session, live restriction checks and appropriate reauthentication. Refresh tokens in the Next proxy with response cookie propagation; use cookie adapters appropriate to their execution context. Do not swallow cookie-write errors. Do not cache personalized responses across users. Cookie Secure in HTTPS, SameSite=Lax, path=/ and host-only; use HttpOnly for cookies owned by server-only flows, respecting SSR SDK requirements for browser session access.

Authentication email links use a server-side `token_hash` verification flow and fixed, type-specific application destinations. The application does not accept provider `redirect_to` input for these flows. Protocol-relative URLs, encoded backslashes and unapproved paths cannot become confirmation destinations. Auth errors must not reveal account existence. Confirmation and recovery tokens are single-use. Staging Supabase Auth sends transactional messages through Resend from the verified `auth.flyco.site` subdomain with click/open tracking disabled; local emails go only to local Mailpit. Rate limit by IP and account fingerprint before invoking Auth endpoints.

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

Signup, sign-in, sign-out, recovery request, recovery completion, verified-email confirmation, profile/settings and email-change forms use Next Server Actions. Zod validates form fields and confirmation query parameters. Supabase Auth owns passwords and confirmations; no password is stored by Flyco. `/auth/confirm` displays a GET interstitial and a POST action verifies the one-time hash with `verifyOtp`, then redirects only to the fixed route allowed for its OTP type. Password reset and login errors use account-neutral UI. Global sign-out revokes refresh sessions; existing access tokens may survive until the configured 15-minute expiry.

The request-scoped SSR client uses host-only HttpOnly, SameSite=Lax cookies, Secure on hosted HTTPS. The proxy propagates refreshed cookies. `getUser()` and `email_confirmed_at` gate the server profile route/action, then the current RLS-protected profile row checks active status. No user_metadata field grants capability; `display_name` from signup metadata is revalidated and used only as initial self-owned presentation text. Users may change email through Supabase double-confirmation. The first verified request inserts a profile as the logged-in user under RLS; no service key or privileged Auth trigger handles user operations.

Local Mailpit + Playwright and the immutable staging preview prove signup, denied unverified login, cross-context confirmation, replay denial, profile edit, sign-out, recovery, password reset, double-confirm email change and re-login. pgTAP and direct staging Data API tests prove self, other and anonymous access. PostgreSQL-backed application throttling is implemented for signup, login, recovery, email change and confirmation.

## Phase 1A security review

Profile writes run with the member JWT; RLS and column grants deny IDOR, ownership transfer and account-status overposting even through direct PostgREST. The server checks verified identity via `getUser()` and live account status before profile changes. Recovery has a neutral public response and signs out globally after password change. Confirmation destinations are type-specific application paths. Every authentication Server Action explicitly requires the exact configured application origin and host; on Vercel the host is taken from the platform-controlled `x-forwarded-host` value, and malformed, missing or chained values fail closed. The confirmation GET is read-only and the POST consumes the token. No service-role key is loaded in app code. Synthetic test users use ordinary member JWTs for application and Data API checks and are deleted after verification.

Supabase global sign-out and password reset revoke refresh sessions. An already-issued access JWT remains usable until the staging JWT lifetime expires (currently 15 minutes); hosted testing confirmed this expected bounded window. Phase 1A does not claim immediate access-token revocation. Operations that later need instant revocation must retain the live database account-state check or add a dedicated server-side session-control mechanism.

## Hosted Auth hardening (Phase 1A)

Authentication emails now use reviewed local/hosted template sources under `supabase/templates/`. Each link goes to `/auth/confirm` with `TokenHash`, a fixed OTP type, and an allowlisted app-relative destination. GET renders an interstitial and POST performs `verifyOtp`, which reduces accidental link consumption by email prefetchers. Tokens are single-use; replay returns the same generic confirmation failure as an invalid or expired token. Signup, recovery and double-confirm email-change flows are tested in separate browser contexts. `ConfirmationURL` and arbitrary `RedirectTo` values are not used. Email click/open tracking must remain disabled because rewriting authentication URLs can break or expose them.

Auth actions consume distributed PostgreSQL rate-limit buckets before calling Supabase Auth. Vercel overwrites `x-forwarded-for`; hosted code accepts exactly one syntactically valid value from that header and rejects chains or alternate client-IP headers. Local tests may use the loopback fallback. IP, normalized account email and token hashes are domain-separated with server-side HMAC-SHA256; raw IP/email/token values never enter the limiter table. Limits are: signup 5/15m, login 10/5m, recovery 5/15m, email change 3/15m and confirmation 10/10m, applied independently to IP and account/token where applicable. Counters are atomic Postgres upserts. Hosted missing key/IP/storage fails closed; recovery preserves the same response for unknown, limited and accepted accounts. Expired rows are removed in bounded batches. The HMAC secret exists only in hosted environment configuration.

The confirmation hash necessarily appears in the one-time email URL. The app never logs it or includes it in Sentry events; strict-origin referrer policy prevents query disclosure to cross-origin destinations. Sentry's server initializer disables default PII and traces and uses an allowlist scrubber that removes URL, request data, cookies, headers, authorization, email, exception values and source context. The staging probe is POST-only, returns 404 unless staging/preview plus its secret are configured, uses constant-time secret comparison, and captures only a fixed synthetic error.
