# Deterministic matching V1

Phase 1E implements advisory matching between published traveler trips and published delivery requests. It answers which listings are compatible without creating a booking, reserving capacity, starting a conversation or guaranteeing future availability. Algorithm version `v1` is implemented in migration `20260922232706_phase_1e_deterministic_matching`.

## Eligibility

A pair is eligible only when all rules pass at the same database snapshot:

1. Both rows have `published` status. Trip departure and request latest delivery are still in the future.
2. Both owners have live `profiles.account_status = 'active'`, and the owners differ.
3. Origin location IDs are equal and destination location IDs are equal in the same direction.
4. `trip.departure_at >= request.earliest_departure_at` and `trip.arrival_at <= request.latest_delivery_at`. Boundaries are inclusive. Values are canonical `timestamptz` instants produced by the existing timezone/DST-safe listing boundaries.
5. The declared item's active normalized category exists in `trip_categories`.
6. `trip.capacity_grams >= declared_item.weight_grams`.

Missing or stale eligibility data fails closed. V1 has no radius search, nearby-city substitution, intermediate stop, fuzzy category, prohibited-item inference, trust-based eligibility or self-match. Rejection diagnostics remain internal and are not returned to members.

## Persistence and recomputation

`matches` is a persisted projection keyed uniquely by `(trip_id, delivery_request_id, algorithm_version)`. It stores source aggregate versions, the two fit components, the deterministic score, fixed reason codes, active state and creation/recomputation timestamps. Foreign keys use `ON DELETE RESTRICT`; future bookings must copy or reference reviewed match semantics without making discovery rows transactional authority.

Triggers recompute the affected side after trip/request lifecycle or compatible-field changes, trip-category changes, declared item category/weight/deletion changes and account-status changes. Owner read RPCs also recompute their requested aggregate before returning results, so correctness does not depend on a background worker. Each run first deactivates the aggregate's V1 rows, then upserts at most the best 500 eligible candidates. The unique constraint makes reruns idempotent and preserves one row when compatibility returns. Cancellation, restriction and incompatible edits deactivate stale rows immediately. Clock-based expiration is filtered from every projection even before persistence catches up; the next owner read also deactivates the expired projection row.

The 500-candidate cap bounds synchronous write work. A later worker can refresh projections asynchronously when marketplace volume outgrows this limit, but reads must continue applying live eligibility predicates. No external search service is justified for exact V1 city routes.

## Ranking

V1 does not use trust in ranking. Public objective trust indicators are shown alongside results only.

For every eligible pair:

- `date_slack_minutes = floor(((trip departure − earliest departure) + (latest delivery − trip arrival)) / 1 minute)`
- `capacity_slack_grams = trip offered capacity − declared item weight`
- `date_component = 100000 − min(date_slack_minutes, 100000)`
- `capacity_component = 10000 − min(floor(capacity_slack_grams / 100), 10000)`
- `score = date_component × 10001 + capacity_component`

The multiplier makes date fit lexicographically dominant over the full capacity component. Smaller date slack ranks first; when date fit ties, smaller unused capacity ranks first. Member projections then sort by descending score, the candidate listing's relevant date ascending, and candidate UUID ascending. Pagination uses a fixed page size of 12, a maximum of 50 rows per RPC call and bounded offset. The stable UUID tie-break prevents permutation-dependent ordering.

## Reasons and privacy

Every active V1 match has the ordered reason array:

- `exact_route`
- `date_window_fit`
- `category_accepted`
- `capacity_sufficient`

The owner-only RPCs return safe listing fields, public display name and objective public trust counters/verification booleans. They exclude email, phone, legal name, residence, bio, declared contents, detailed description, handling notes, item photos/storage paths, account status, moderation state, audit data and internal rejection reasons.

The base `matches` table has RLS enabled and no `anon` or `authenticated` grants or policies. Members cannot read, insert, update or forge projection rows. `get_trip_matches` requires the current active member to own the trip; `get_delivery_request_matches` requires ownership of the request. Anonymous execution is revoked. Both are tightly scoped `SECURITY DEFINER` functions with empty search paths and fully qualified objects because they must refresh a system-owned projection while using the member JWT as the actor boundary.

## Version changes and booking boundary

A future algorithm ships as an additive migration and a new version such as `v2`; it must not rewrite V1 semantics in place. Recompute can create V2 rows alongside V1, switch member RPCs after review, then deactivate or retain V1 according to notification/audit policy. Source versions make stale provenance explicit.

Discovery is never booking evidence. Since Phase 1F, matching compares available capacity: offered capacity minus active `capacity_reservations`. Booking acceptance still locks the trip and revalidates the candidate because a displayed match remains advisory. Acceptance and accepted-booking cancellation recompute affected matches in the same transaction, so insufficient-capacity rows become inactive and released capacity can reactivate them.
