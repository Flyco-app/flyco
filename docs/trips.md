# Traveler trips

## Aggregate and lifecycle

`trips` is the traveler-owned aggregate. It references two active Phase 1B `locations`, stores departure and expected arrival as `timestamptz`, capacity as integer grams, and carries a monotonically increasing positive `version`. `trip_categories` is a normalized join to the stable `item_categories` reference table. Trips are retained through lifecycle state; members have no delete command.

The implemented state machine is:

- `draft → published` after full validation and a future departure check.
- `draft → cancelled` and `published → cancelled` through an explicit reasoned command.
- `published → expired` after departure through a trusted expiration command.
- `completed` is reserved for a later fulfillment phase; no Phase 1C command can assign it.
- `cancelled`, `expired` and `completed` are terminal.

Drafts may change all trip fields. Published trips may change departure, expected arrival, capacity and accepted categories while the departure remains in the future and within the one-year publication horizon. Their route is immutable. Later booking work must further restrict edits that conflict with accepted bookings or reservations.

Every mutation locks the trip, compares the caller-supplied expected version and increments it atomically. A stale version raises a serialization conflict and cannot overwrite current state. Create, draft edit, publish, published edit, cancel and expire append controlled `trip_events`; members cannot insert events directly. Cancellation reasons are stored separately and remain owner-only.

## Capacity and categories

Capacity is persisted as an integer from 1 through 50,000 grams. The UI accepts a decimal kilogram string with at most three decimal places and converts it without floating-point persistence. Phase 1C represents offered capacity only. A later booking phase must introduce reservation rows and compute remaining capacity transactionally under a trip lock; it must not decrement this advertised value through client updates.

V1 category codes are `documents`, `clothing`, `electronics`, `packaged_goods` and `other_personal_items`. Codes are reference data rather than a PostgreSQL enum so legal or operational availability can be changed without rewriting historical trip rows. The list does not define a prohibited-item policy; publication and booking UI must eventually pair categories with reviewed carriage and customs rules.

## Time and expiration

The form captures departure in the origin location's IANA timezone and expected arrival in the destination timezone. The server converts each local wall time to an unambiguous UTC instant before persistence. DST gaps and repeated ambiguous times are rejected instead of guessed. Reads format each instant in the corresponding location timezone.

Publication requires departure after the database clock and no more than one year ahead. Public discovery additionally requires `departure_at > now()`, so a departed trip disappears immediately even if no worker has persisted `expired` yet. Owner reads run a scoped expiration command. `private.expire_due_trips(batch_size)` provides a bounded, lock-safe worker entry point for a future scheduled job; it is not exposed to application roles and no scheduler was added in this phase.

## Authorization and visibility

The base trip, category membership, cancellation and audit tables are not anonymously readable. Authenticated members can select only their own aggregate rows. All writes use fixed-search-path command functions that derive the actor from `auth.uid()`, verify the live profile is active, lock current state, validate the transition and write the audit event in one transaction. Direct insert, update, delete, owner assignment and status assignment are not granted.

`get_public_trip(id)` is the sole public trip projection. It returns only the current published trip ID, public profile reference, normalized location IDs, route timestamps, offered capacity, published status and stable category codes. It omits version, lifecycle timestamps, cancellation reason, audit data and all private profile/contact information. Public traveler presentation is joined separately through the existing public member and trust projections.
