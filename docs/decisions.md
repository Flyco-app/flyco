# Authentication and authorization

## Phase 1G decisions

| ID  | Decision                                                      | Reason / reconsider when                                                                                           |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A33 | One responsive shell for both sender and traveler activity    | One account performs both roles; reconsider only if future research proves separate workspaces reduce confusion    |
| A34 | Keep matches contextual to their trip or delivery request     | Mirrors current authorization and query boundaries; add global discovery only with its own implemented contract    |
| A35 | Use guided single-page listing forms rather than client steps | Adds consumer guidance without partial-draft synchronization; revisit only if measured completion data supports it |
| A36 | Keep the UI system source-owned with no new dependency        | Native controls and small primitives meet current needs; add a package only for a concrete accessible behavior     |

## Phase 1F decisions

| ID  | Decision                                     | Reason / reconsider when                                                                                      |
| --- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A29 | Sender initiates one proposal per match      | Keeps V1 intent and authorization simple; reconsider only with a designed negotiation model                   |
| A30 | Reserve capacity only on traveler acceptance | Proposals remain cheap and expiration requires no release; payment authorization may later change hold policy |
| A31 | Derive available capacity under a trip lock  | Avoids a mutable counter and serializes cross-booking accepts; revisit after measured scaling needs           |
| A32 | Both participants may cancel before payment  | Releases capacity immediately; a later payment/refund policy will supersede it                                |

## Production deployment gate

| ID  | Decision                                                        | Reason / reconsider when                                                                                                  |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A30 | Disable automatic Vercel Git deployments from the `main` branch | Merging reviewed work must not implicitly publish Production; remove only in a reviewed release change after launch gates |

## Phase 1E decisions

| ID  | Decision                                                           | Reason / reconsider when                                                                                                      |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| A25 | Persist a versioned match projection and revalidate on owner reads | Enables notifications/recompute while keeping discovery advisory; move refresh work async when 500 candidates is insufficient |
| A26 | Rank date slack first and unused capacity second                   | Objective, deterministic and explainable; change only under a new algorithm version                                           |
| A27 | Keep public trust indicators out of V1 eligibility and score       | Avoids opaque or discriminatory ranking while still giving members useful context                                             |
| A28 | Deny self-match and exact-match canonical route/category only      | Safe V1 semantics; radius, stops or substitutions require explicit product/policy work                                        |
| A29 | Keep the base table inaccessible and expose owner-only projections | Prevents score/reason forgery and private listing/profile leakage                                                             |

## Phase 1D decisions

| ID  | Decision                                                                   | Reason / reconsider when                                                                                                     |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A20 | Model one declared item row per request in V1                              | Matching and booking terms stay unambiguous; allow multiple independent items only with allocation and partial-booking rules |
| A21 | Reuse `item_categories` for traveler acceptance and sender declaration     | Compatibility is an exact stable code without duplicated taxonomies                                                          |
| A22 | Keep item photos private and exclude them from public discovery            | Photos can reveal personal or security-sensitive detail; add booking-derived access only after scanning and policy review    |
| A23 | Reserve database-generated photo metadata before member-JWT Storage upload | Storage RLS can authorize an exact owner/item path and enforce the five-photo concurrency limit under the request lock       |
| A24 | Expire by latest delivery, filter at read time and defer scheduler setup   | Public correctness is independent of worker timing and current infrastructure needs no new scheduler                         |

## Phase 1C decisions

| ID  | Decision                                                                       | Reason / reconsider when                                                                                                                       |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| A16 | Use reference rows plus `trip_categories`, not an enum or delimited column     | Stable codes remain relational and can be deactivated without rewriting history; revisit only if policy requires versioned category taxonomies |
| A17 | Keep the trip aggregate owner-only and expose `get_public_trip`                | Prevents field-level leakage of versions, cancellation and audit data while retaining a simple Data API boundary                               |
| A18 | Convert location-local input server-side and reject DST ambiguity              | Avoids silently choosing the wrong instant; revisit when UX offers an explicit UTC-offset choice for repeated times                            |
| A19 | Hide departed trips by query predicate and provide bounded expiration commands | Correctness does not depend on cron availability; add a trusted scheduler when operational job infrastructure is approved                      |

## Phase 1B profile boundary

Keep `profiles` private and self-readable, and publish a deliberately narrow `member_profiles` card instead of exposing a view over a table that also carries account controls and contact details. Objective trust values live in a read-only projection; members cannot write counters or verification flags. Avatars use a public bucket because member cards need public image reads, while Storage writes and profile references are both constrained to the authenticated member UUID. Locations use Flyco UUIDs as canonical identity; provider IDs live in a private mapping so a later geocoder can be replaced. Unverified phone numbers are not unique because allowing an unverified claim to reserve a number would permit denial of service.

Status: member sign-in/profile flows and the Phase 1J internal staff boundary are implemented. The existing Next.js app hosts `/admin`; live database roles plus AAL2 protect all operational data and commands.

## Identity

Supabase Auth owns credentials and email verification; profiles.id references auth.users.id. One user may be sender and traveler concurrently. Neither is an administrative role. Disable anonymous sign-in. Require verified email before publishing, messaging or booking. Never authorize from editable user_metadata. Display profile changes cannot change account status or verification.

Use @supabase/ssr request-scoped clients. Validate server identity with the documented getClaims/getUser flow; never trust getSession alone. Sensitive changes require a current server-validated user/session, live restriction checks and appropriate reauthentication. Refresh tokens in the Next proxy with response cookie propagation; use cookie adapters appropriate to their execution context. Do not swallow cookie-write errors. Do not cache personalized responses across users. Cookie Secure in HTTPS, SameSite=Lax, path=/ and host-only; use HttpOnly for cookies owned by server-only flows, respecting SSR SDK requirements for browser session access.

Authentication email links use server-side `token_hash` verification and fixed destinations per OTP type. Reject protocol-relative URLs, encoded backslashes and unapproved return paths. Auth errors must not reveal account existence. Confirmation and recovery tokens are single-use; password reset revokes other sessions according to approved policy. Enable custom SMTP after Resend domain verification; local emails go only to local Mailpit. Rate limit by IP and account fingerprint before invoking Auth endpoints.

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

## Phase 1A branch status

Implemented locally on `codex/phase-1a-auth-profiles`: member Auth, profile RLS and localized account shell. The phase is not a hosted release: distributed abuse controls, reviewed cross-device email templates and exact-preview verification remain open. Phase 1B staff authorization and all listing work remain separate.

## Phase 1A decisions

| ID  | Decision                                                          | Reason / reconsider when                                                                                    |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| A13 | Create profiles on first verified server session under member RLS | Avoids privileged Auth trigger; revisit if immediate pre-verification profile creation becomes required     |
| A14 | Keep account status in profiles with column grants for this slice | Avoids separate control table/RPC until moderation; migrate with audit/transition plan before staff actions |
| A15 | Use SSR `token_hash` email confirmation through one app endpoint  | Supports cross-device confirmation; a GET interstitial prevents link prefetch from consuming the token      |

## Phase 1H decisions

| ID  | Decision                                                                                                               | Reason / reconsider when                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| H01 | Record sender safety acknowledgement in the publish transaction and traveler acknowledgement in the accept transaction | Evidence cannot outlive a failed lifecycle command; revisit version renewal after legal review |
| H02 | Keep policy copy/config in code and evidence in one small append-only table                                            | A CMS is unnecessary before policy ownership and approval workflow exist                       |
| H03 | Reveal private item details and signed photos only to booking participants                                             | The traveler needs information before accepting, while public discovery remains narrow         |
| H04 | Publish Terms and Privacy only as visibly marked pre-launch structures                                                 | Final text has not been supplied or professionally reviewed                                    |
