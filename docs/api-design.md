# API and state design

Status: contract for future implementation. No product endpoints are exposed in this foundation.

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
