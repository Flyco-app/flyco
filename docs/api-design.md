# API and state design

## Internal moderation commands

Phase 1J exposes narrow RPCs for own staff capability, report queue/detail, review start, audited evidence read, notes, decisions/account actions and administrator-only role changes. Except for the opaque own-capability check, each requires live staff authority and AAL2 inside PostgreSQL. Clients never submit authoritative actor, report state, account owner, staff identity or outbox payload.

The outbox worker interface is unavailable to member roles. Claiming is service-role-only, bounded and lock-safe; completion must present the same worker claim. Future provider consumers must be idempotent by event ID.

Phase 1I exposes participant-only conversation projections, bounded cursor-based message history, send/mark-read commands and structured report submission. Clients never supply authoritative sender, participant, timestamp, report state or limiter values. No generic CRUD API exists.

## Phase 1F booking commands

Authenticated server actions call `propose_booking`, `accept_booking`, `reject_booking` and `cancel_booking`. An explicit `expire_booking` command supports bounded persistence work. Commands validate UUIDs and expected versions with Zod, enforce trusted action origin, require live account eligibility where the transition creates obligations, and return safe conflicts. `get_my_bookings(limit, offset)` and `get_booking(id)` are participant-only projections. No generic booking PATCH or table-write API exists. See [bookings](bookings.md).

## Phase 1E matching reads

`get_trip_matches(trip_id, limit, offset)` requires the active JWT member to own the trip. `get_delivery_request_matches(request_id, limit, offset)` applies the same rule to a request. Inputs are bounded to 1–50 rows and offsets 0–10,000; application routes additionally use 12-row pages. Clients supply no score, reason, version, owner, trust or eligibility data.

Both RPCs are read-shaped member APIs backed by a system-written projection. They recompute the identified aggregate idempotently, apply current lifecycle/time predicates again, and return only approved listing/profile/trust fields. Sorting is score descending, relevant candidate date ascending, UUID ascending. The application uses Server Components for these authenticated reads; there is no client mutation or public route handler.

## Phase 1D delivery request commands

The application exposes Server Actions backed by member-JWT RPCs: `create_delivery_request_draft`, `update_delivery_request`, `publish_delivery_request`, `cancel_delivery_request`, `begin_item_photo_upload`, `finalize_item_photo_upload` and `remove_item_photo`. Every mutation validates authenticated active-account state, derives the actor, locks the request and checks its expected version. Request creation writes the item and audit event in one transaction. Public reads use only `get_public_delivery_request`; owner pages query owner-RLS base rows.

Photo upload is a reservation/finalization protocol. The begin command creates a database-generated pending path and consumes an aggregate version; Storage accepts only that exact pending row. The application validates bytes before upload. Finalize requires the returned current version and object presence, then marks the photo ready and audits it. Removal first revokes metadata visibility and audits under the lock, then deletes the private object. Storage failure is surfaced for retry.

The delivery request state machine is `draft → published`, `draft|published → cancelled` and `published → expired`. Terminal states cannot be edited or reactivated. Published route endpoints cannot change. Public queries also require `latest_delivery_at > now()`, so scheduler lag cannot expose an ended request.

## Phase 1C trip commands

The Next.js Server Actions validate localized form input, resolve canonical location timezones, convert unambiguous local times to UTC and invoke member-JWT RPCs. The database commands are `create_trip_draft`, `update_trip`, `publish_trip`, `cancel_trip` and `expire_own_departed_trips`. `get_public_trip` is the anonymous/authenticated read projection. There is no generic trip PATCH or client-selectable status field.

`update_trip`, `publish_trip` and `cancel_trip` require `input_expected_version`. They lock the aggregate and raise SQLSTATE `40001` when stale; the application returns a conflict message and does not retry a human edit automatically. Authorization failures use a uniform unavailable result to avoid cross-user existence disclosure. Validation and state failures return safe localized messages rather than raw database details.

## Phase 1B commands

- `update_own_profile` is security-invoker and uses the member JWT. It atomically updates private settings and the public card after Zod and active-location validation.
- Avatar upload validates size, MIME, signature and generated owner path, uploads with the member JWT, updates the card, then removes the previous object.
- Identity start inserts only `id/user_id`; defaults force `pending`. Cancellation uses `id + expected version`, with database policy restricting `pending|requires_input → cancelled`.
- Locations are read-only. No client payload supplies authoritative coordinates, canonical labels or provider IDs.

Status: the Phase 1B commands above are implemented as same-origin Server Actions backed by member-JWT database operations. Transactional product endpoints below remain a future contract.

## Boundaries

Use Server Actions for first-party forms and `/api/v1/...` route handlers when a stable HTTP interface is useful. Commands, not unrestricted database CRUD: `POST /bookings/:id/accept`, `/cancel`, `/confirm-pickup`, `/start-transit`, `/confirm-delivery`. No `PATCH status`. External webhooks use `/api/webhooks/stripe` and `/api/webhooks/resend`, independent of user cookies.

Zod validates unknown payloads with bounded lengths, strict objects and allowlisted fields. Derive actor from session and price/fee/currency from immutable server terms. Require expected_version for updates and Idempotency-Key for retryable creation/money commands; uniqueness is actor + operation + key, stored with request hash and minimal response. Same key/different input → 409. IDs are UUIDs, never authorization tokens. Pagination is bounded keyset (default 20, maximum 100). Return safe DTOs, no provider secrets or internal evidence URLs.

Errors: `{ error: { code, message, requestId, fields? } }`. Stable codes map to 400 validation, 401 unauthenticated, 403 forbidden (or non-disclosing 404), 404 unavailable, 409 conflict, 422 domain rejection, 429 limited with Retry-After, 503 dependency unavailable. Do not serialize internal exceptions. Transactions enforce authorization again to close TOCTOU races. Retry only transient conflicts/providers with bounded backoff.

## Booking state machine

Fulfillment state and financial state are independent. Booking terminals: declined, cancelled, expired, completed, closed_unfulfilled. `disputed` is a separate dispute entity/blocking flag; `refunded` belongs to refunds/payment summary. This preserves whether an item was actually delivered and allows disputes after completion.

| From                                               | Command / actor                                     | To                 | Guard and effect                                                                                                |
| -------------------------------------------------- | --------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| none                                               | propose / either participant                        | proposed           | Compatible listings; proposer is participant; immutable quote version                                           |
| proposed                                           | accept / other participant                          | accepted           | Both eligible; lock trip/request; reserve grams; agree immutable terms                                          |
| proposed                                           | decline / recipient                                 | declined           | Terminal; audit reason                                                                                          |
| proposed                                           | cancel / proposer                                   | cancelled          | Terminal                                                                                                        |
| proposed                                           | expire / scheduler                                  | expired            | Proposal deadline reached                                                                                       |
| accepted                                           | begin payment / sender                              | payment_pending    | Idempotent payment attempt; hold deadline not passed                                                            |
| accepted, payment_pending                          | cancel / participant or operator per policy         | cancelled          | Before pickup; release reservation once; enqueue cancellation/refund work if necessary                          |
| accepted, payment_pending                          | expire / scheduler                                  | expired            | Deadline reached; release once; reconcile late payment                                                          |
| payment_pending                                    | confirm / payment worker                            | confirmed          | Authoritative successful collection, amount/currency/account match, valid reservation; no open blocking dispute |
| confirmed                                          | arrange pickup / participants                       | pickup_pending     | Pickup plan agreed, active participants                                                                         |
| confirmed, pickup_pending                          | cancel / policy command                             | cancelled          | Pre-pickup only; fee/refund policy evaluated independently                                                      |
| pickup_pending                                     | confirm pickup / traveler with sender code          | picked_up          | Hash/expiry/attempt limits; atomic single use; evidence where required                                          |
| picked_up                                          | start transit / traveler                            | in_transit         | Recorded custody, no blocking safety restriction                                                                |
| in_transit                                         | request delivery / traveler                         | delivery_pending   | Arrival/handoff ready                                                                                           |
| delivery_pending                                   | confirm delivery / traveler presents recipient code | delivered          | Code issued only to designated recipient; traveler submits it; reviewed evidence fallback, atomic               |
| delivered                                          | complete / system or authorized sender              | completed          | Acceptance/window passed, no open blocking dispute, delivery evidence retained; mark transfer eligible          |
| picked_up, in_transit, delivery_pending, delivered | resolve failed fulfillment / assigned operator      | closed_unfulfilled | Documented loss/return/dispute outcome; evidence and finance decision separate                                  |

No transition out of a terminal booking. Corrections append a separate resolution record and financial events; never rewrite history. An open dispute freezes completion/transfer and any contested custody command; support may record evidence without advancing fulfillment. Completed bookings may still have late financial disputes; payouts can be reversed/recovered separately. No automatic timeout may mark an undelivered booking completed. Timeout durations are policy variables awaiting business approval.

## Atomic command protocol

1. Validate payload; authenticate and rate-limit.
2. Begin transaction; lock relevant account_controls in ascending user UUID order, then trip → delivery request → booking → payment as needed in that order. Child item/category edits must also lock their parent. Multi-resource commands sort IDs within each class. Restriction changes take the same account lock; reads alone do not close authorization races.
3. Re-check actor role/restrictions, state edge, expected version, deadline and business guard.
4. Apply update, increment version; append booking_events and audit_events; enqueue outbox work in same transaction.
5. Commit; return stable DTO. Workers claim pending or expired-processing rows using `FOR UPDATE SKIP LOCKED`, set a new lease_token/lease_until atomically and increment attempts. Completion, retry and heartbeat must compare the token so an old worker cannot overwrite a newer lease. External calls can still execute twice: stable provider idempotency and reconciliation are mandatory. Reclaim expired leases with bounded retry, then dead-letter and alert.

A narrow database command will be the only status write path. RLS alone does not enforce transition graphs. Table UPDATE grants must not allow clients to modify state, identities, amounts or verification columns. Proposed schema intentionally grants no API access until those commands and tests exist.

## Webhook contract

Read bounded raw bytes, verify signature/timestamp before parse/use, verify environment/account, insert unique provider/account/event ID into inbox, commit before 2xx. Retries re-use inbox entry. Durable worker validates object relationships, fetches current provider state where event ordering is ambiguous, then updates payment projection + append-only history atomically. Invalid signature → 400; persistence failure → retryable 5xx. Retention must avoid keeping unnecessary provider PII.

## Custody and reservation clarifications

The recipient may be different from the sender. Recipient designation and secure code delivery need an approved contact/consent design before fulfillment work; never give the traveler the expected code before handoff or treat traveler-only evidence as automatic delivery proof. `delivered` is a custody fact: a subsequent complaint uses a dispute/resolution record; only verified correction of an erroneous delivery record permits closed_unfulfilled through operator review. Ordinary post-delivery refunds do not undo custody history.

At acceptance, hold capacity until the payment deadline. At confirmed collection, atomically convert held to committed while checking the database deadline under the trip lock. Matching counts committed plus unexpired held reservations. Expiry releases held reservations only; it must never free committed grams. Completed shipments continue consuming capacity for that trip (capacity is not reusable for another item on the same journey). Pre-pickup cancellation can release committed capacity once; failed fulfillment after custody requires an explicit operator decision, not an automatic release. Late payment success after a release is compensated rather than reviving capacity.
