# Delivery requests and declared items

## Aggregate and lifecycle

`delivery_requests` is the sender-owned aggregate. It references canonical Phase 1B locations, stores the flexible route window as two `timestamptz` instants and carries one positive, monotonically increasing `version`. `declared_items` contains the declaration and has a unique request foreign key: Phase 1D deliberately supports one shipment item record per request. That row may describe multiple identical units through `quantity`; supporting independently routed items later requires dropping the unique constraint and reviewing matching and booking terms.

The implemented state machine is:

- `draft → published` after complete validation and a future-window check.
- `draft → cancelled` and `published → cancelled` through a reasoned command.
- `published → expired` when `latest_delivery_at` passes.
- `cancelled` and `expired` are terminal.

Drafts may change the whole aggregate. Published requests may change the window and item declaration while the viable window remains open, but their route is immutable. Every request, item or photo mutation locks the request, checks `expectedVersion`, increments the version and rejects stale callers with SQLSTATE `40001`. Members cannot delete the lifecycle aggregate or patch status directly.

## Date window and timezones

The sender enters earliest acceptable departure in the origin city timezone and latest acceptable delivery in the destination city timezone. The server rejects missing or ambiguous DST wall times and converts the accepted values to UTC instants. The database requires earliest before latest and caps a window at 90 days. Publication requires a future earliest departure no more than one year away.

Future deterministic matching can require a trip departure at or after `earliest_departure_at` and a trip arrival at or before `latest_delivery_at`, then apply route, category and weight checks. Those boundaries must be rechecked when a booking is accepted.

## Declaration and measurements

The item reuses the stable `item_categories` rows created for trips, so category compatibility is an exact code comparison. Weight is stored as 1–50,000 integer grams. Optional length, width and height are all present or all absent and use 1–2,000 integer millimeters. Quantity is 1–100 and weight represents the total shipment weight.

Title, description and declared contents are separate. Declared contents requires 10–1,000 trimmed characters, the description 20–2,000 and the title 3–120. Client and server validation reject a short generic declaration, while database checks preserve structural minimums for direct callers. These rules improve listing quality; they do not decide customs or carriage eligibility. A reviewed prohibited-items, corridor and attestation policy remains a launch gate.

## Photo privacy

`item-photos` is a dedicated private Supabase Storage bucket. Public discovery contains no photo or storage path. The owner first reserves one of at most five photo rows through a versioned command. PostgreSQL generates the UUID path under the authenticated owner and item; Storage INSERT accepts only that pending reservation. JPEG, PNG and WebP are allowed up to 5 MiB. The application checks both the declared MIME type and file signature before upload, ignores the original filename, and finalizes metadata only after the object exists.

Ready photos are readable only by their request owner. The application issues five-minute signed URLs after an owner-authorized metadata query. Removal marks metadata deleted and records an audit event before deleting the object; an object deletion failure is explicit and can be retried without making the photo readable. Later sharing with a matched traveler must add a booking-derived authorization rule and malware/content scanning before expanding access.

## Authorization, visibility and audit

Authenticated members can select only their own base request, item, photo metadata, cancellation and audit rows. Base tables grant no INSERT, UPDATE or DELETE; fixed-search-path commands derive the owner and actor from `auth.uid()`, check the live active profile and write atomically. Direct owner, relationship, status and audit-event forgery are denied.

`get_public_delivery_request(id)` is the only public request representation. For a currently viable published request it returns the request/sender references, canonical route, date window, category, safe title, integer measurements, quantity and fragile flag. It excludes description, declared contents, handling notes, photos and paths, version, account controls, cancellation data and audit history.

Create, draft/published edit, publish, photo add/remove, cancel and expire create `delivery_request_events`. Event metadata contains only the photo UUID where applicable. A bounded unexposed worker command and owner-scoped opportunistic command persist expiry, while the public projection independently filters ended windows so correctness does not depend on a scheduler.

## Phase 1H sender declaration

Publication requires four unchecked confirmations covering declaration accuracy, the platform prohibited-item policy, packaging and possible cross-border obligations. The command accepts only a boolean and records the server-controlled `sender-safety-2026-09-v1` version in the same transaction. Evidence references the resulting request version and members cannot write it directly. See `docs/policy-safety.md`.
