# Transactional notification outbox

Phase 1J introduces a provider-neutral durable outbox. It does not send email, push or SMS and does not add paid queue infrastructure.

Domain transactions enqueue privacy-minimized events for booking proposals/transitions, new messages, report acknowledgements, moderation account actions and staff-role changes. Events contain recipient and resource identifiers, an event/payload version and small routing metadata. They never contain message bodies, declared contents, credentials, signed URLs or email addresses. A unique deduplication key makes producer retries idempotent.

The base table has RLS enabled and no member or anonymous privileges. Only a worker using the non-browser `service_role` may call the bounded claim and completion functions. Claims use `FOR UPDATE SKIP LOCKED`, deterministic order, a worker identifier and an attempt counter. Successful completion is terminal; failure returns the event with bounded linear retry delay. Delivery is at least once, so every future provider adapter must use the outbox event ID as its idempotency key.

Outbox insertion happens through database triggers or inside moderation commands, in the same transaction as the domain change. A domain commit therefore cannot lose its notification intent because the application crashes. No worker is deployed in this phase, so records remain pending in staging until an authorized future worker is enabled. Operational retention, dead-letter escalation and provider-specific templates belong to the worker phase.
