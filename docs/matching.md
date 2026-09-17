# Deterministic matching V1

Status: specification, no matching feature implemented. Algorithm version `route-v1`.

## Eligibility filters

1. Trip published, request open, departure in future; both accounts active and meet the operation's identity requirements. Exclude self-match and user blocks.
2. Exact canonical origin city ID and destination city ID in the same direction. Reference cities include country ISO code and IANA timezone. No free-text city comparison, country-only fallback, geocoding radius or multi-leg routing.
3. Trip departure lies in request pickup window and arrival lies in request delivery window (inclusive absolute timestamps). Store windows as timestamptz; convert user local dates to bounds using city's timezone, not browser timezone. Arrival >= departure.
4. Sum of request item weights plus all active reservations must fit the trip's total capacity. Released/expired reservations do not count. All item categories must be explicitly permitted by trip and current corridor policy. Missing eligibility data fails closed.
5. Each dimension limit, declared-value cap and route/carrier restriction must pass when configured. Unknown required dimensions disqualify; do not assume zero. V1 cannot make legal eligibility decisions itself.

## Ranking

Filter first, then lexicographic sort: absolute minutes from preferred departure (or pickup-window midpoint if no preference); unused grams after booking ascending; departure instant ascending; trip UUID ascending. No opaque weighted reputation score. Reputation may be a displayed filter only after bias/abuse review. Same immutable input snapshot yields identical order. Store algorithm version, input versions, evaluation time and reason codes (`route_exact`, `dates_fit`, `categories_allowed`, `capacity_fits`) for each suggested match. Expire cached matches after a short configurable TTL and invalidate when listings change.

Queries first narrow on published origin/destination/departure using a composite partial index; use EXISTS/NOT EXISTS for all-category membership and aggregate item weights. Bound candidate scans, use keyset pagination with deterministic tie-break. Never promise reserved capacity at discovery time.

## Acceptance and concurrency

Matching is advisory. Acceptance re-reads listings and account eligibility under transaction locks, checks versions, copies agreed terms and creates a capacity reservation atomically. Competing acceptances cannot both consume the last grams. Reserving one request on two trips is stopped by the active-booking unique index. Expired holds are released under the same lock order, once. A late successful payment after expiry must trigger compensation/review, not resurrect a booking unconditionally.

## Required tests

Reversed route, same sender/traveler, boundary timestamps, French daylight-saving transitions and Morocco timezone changes (use IANA data), zero/oversized weight, rejected categories, missing dimensions, suspended account, ties, stale version, expired holds and two competing acceptances. Property tests: every returned candidate satisfies every filter; sorting stable under permutation; no capacity below zero.
