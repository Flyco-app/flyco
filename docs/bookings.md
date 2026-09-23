# Booking proposals and capacity reservations

Phase 1F implements a pre-payment booking boundary. A sender may propose a booking from one current Phase 1E match. The traveler may accept or reject it; either participant may cancel a proposed or accepted booking. Payment, fulfillment, delivery evidence, disputes, messaging and reviews remain outside this phase.

## Initiation and lifecycle

V1 is sender-initiated. `propose_booking(match_id, idempotency_key)` derives the sender, traveler, trip, request and declared weight from server-owned records. It re-runs the current matching predicate and rejects stale, inactive, self-owned or restricted opportunities. A match can have only one booking history.

The state machine is `proposed → accepted | rejected | cancelled | expired` and `accepted → cancelled`. Rejected, cancelled and expired are terminal. Proposals expire at the earliest of 48 hours after creation, trip departure or the request's latest delivery instant. Reads treat an elapsed proposal as expired immediately and persist that transition opportunistically. Proposals hold no capacity.

## Reservation and transaction model

Acceptance reserves the item's integer gram weight. `available capacity = offered trip capacity − sum(active reservations)`. This is derived rather than stored as a mutable counter.

`accept_booking` runs as one PostgreSQL transaction. It locks the booking, checks participant/state/version/expiry, locks the trip, revalidates both accounts and the current matching candidate, sums active reservations, inserts the reservation, advances the booking, appends events, recomputes affected matches and commits. Any failure rolls back every step. The trip lock serializes competing accepts: two concurrent 3,000 g accepts against 5,000 g produce one reservation and one capacity conflict.

Cancellation locks the booking and, for an accepted booking, the trip. It releases the reservation once, advances the booking, writes lifecycle and release events, then recomputes matches. Released capacity can reactivate opportunities. A cancelled trip/request or insufficient-capacity candidate cannot be accepted from a stale match row.

## Concurrency and idempotency

Mutation commands accept an expected booking version; stale mutations return SQLSTATE `40001`. Client-generated UUID command keys are recorded by actor and command. Replaying a key returns its result. Terminal repeat behavior also makes repeated accept, reject and cancel safe. The unique match constraint prevents duplicate proposals.

## Authorization and privacy

`bookings`, `capacity_reservations`, `booking_events` and `booking_command_receipts` have RLS enabled and no anonymous or member table grants. Members use narrowly granted `SECURITY DEFINER` RPCs with an empty `search_path`; private helpers are not executable by API roles. Commands derive participants from database relationships. Only participants can read the projection or invoke allowed transitions.

The projection returns status, public counterparty reference/display name, route, times, safe item title/category, reserved weight, capacity totals and lifecycle timestamps. It excludes contact details, declared contents, storage paths, account controls, moderation fields, receipts, reservations and audit payloads. Restricted accounts cannot propose, accept or reject; participants may still cancel to release capacity safely.

## Audit and future boundaries

Server-controlled events cover proposal, acceptance, rejection, cancellation, expiration, reservation creation and release. Metadata is limited to non-sensitive capacity facts. Failed capacity attempts roll back and return a safe conflict; they cannot be logged inside that failed transaction.

Phase 1E matching now evaluates available capacity. Matches remain advisory because acceptance always revalidates and reserves atomically. A future payment phase must add independent payment states; browser redirects can never prove payment.
