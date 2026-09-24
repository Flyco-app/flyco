# Internal moderation

Phase 1J implements the internal moderation foundation under `/admin` in the existing Next.js application. It is a separately authorized surface, not a second application and not a hidden member page. Every staff projection and command checks a live database assignment and requires a Supabase `aal2` session. Navigation visibility is never authorization.

## Roles and permissions

| Capability                                       | Support | Moderator    | Administrator |
| ------------------------------------------------ | ------- | ------------ | ------------- |
| View report queue and support-safe case metadata | Yes     | Yes          | Yes           |
| Add append-only internal note                    | Yes     | Yes          | Yes           |
| Read private reported evidence                   | No      | Yes, audited | Yes, audited  |
| Start review, resolve or dismiss                 | No      | Yes          | Yes           |
| Restrict, suspend or restore account             | No      | Yes          | Yes           |
| Grant or revoke staff roles                      | No      | No           | Yes           |

Verification-reviewer and finance roles are intentionally absent until those workflows exist. Staff authority lives in `private.staff_role_assignments`; profile fields and JWT `user_metadata` have no authority. Revocation is checked from the database on each call.

## Authentication and bootstrap

`/admin` redirects unauthenticated users to the normal verified login. A staff member at AAL1 sees only the TOTP enrollment/challenge surface. The browser uses Supabase MFA directly, then server-side staff RPCs independently enforce AAL2. Ordinary members receive a 404 after authentication.

The first administrator is bootstrapped once by a database owner in staging, after the person has a verified, active Flyco account:

```sql
select private.bootstrap_first_administrator(
  '<profile-uuid>'::uuid,
  'Initial staging operations owner'
);
```

Run this only through the Supabase SQL editor while explicitly connected to staging. The function refuses API roles and refuses to run after any live assignment exists. Do not place a user ID or email in a migration. Later changes use the administrator UI/RPC and produce immutable role events. Role assignment and permanent closure are future candidates for two-person approval.

## Case lifecycle and records

Reports use `open → under_review → resolved|dismissed`. `escalation_required` records a decision while leaving the case under review. Decisions and notes are append-only; corrections create another record. Normal members have no base-table privileges and cannot see report state, notes, decisions, staff identities or audit events.

Evidence access is explicit. Moderator/admin access records actor, report, resource reference, purpose and time before returning the reported message, booking and declared item context. Audit rows never contain message or item content. Item-photo access is intentionally not exposed in Phase 1J; a future endpoint must create a case-scoped audit event and a short-lived URL in one controlled flow.

## Account controls

The existing `active`, `restricted`, `suspended`, `closed` profile state remains authoritative. A restriction or suspension is written in the same transaction as the moderation decision, audit events and notification-outbox record. The existing match trigger removes restricted accounts from matching, and all publish, booking and message mutations perform live active-account checks.

Restriction prevents new marketplace actions while preserving database-held history. Suspension additionally deletes Supabase refresh sessions. Already issued access JWTs may remain cryptographically valid until their short expiry, so sensitive commands never rely on logout alone and always check the live account state. Closed accounts cannot be restored through the Phase 1J command.

## Privacy and future controls

The staff queue is bounded and deterministically ordered. Support receives safe case metadata; moderators receive evidence only after recording purpose. There is no general private-data browser. Financial access, identity review, permanent closure, evidence export, staff assignment approval and retention/deletion are future separately reviewed controls.
