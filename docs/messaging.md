# Booking messaging

Phase 1J inserts a privacy-minimized `new_message` outbox event in the same transaction as each message. No message body is copied. No notification worker, SMS, push or per-message email delivery is enabled.

Phase 1I provides one private conversation for every booking proposal. A database trigger derives the sender and traveler from the booking and creates one read cursor per participant. Arbitrary user-to-user conversations are impossible. Existing bookings are backfilled idempotently.

Participants retain read access to history. New messages are accepted only while a booking is `proposed` or `accepted`; `rejected`, `cancelled` and `expired` conversations are read-only. Messages are immutable plain text, limited to 2,000 characters, with normalized line endings. React renders bodies as text. Attachments, edits, deletes, delivery receipts and Realtime are outside this phase.

Base tables have RLS enabled and no member table privileges. Fixed-search-path commands derive `auth.uid()`, require an active account for sending, and verify booking participation. Projections expose public display identity, route/item context and message content, never contact details, internal state, reports, audit data or storage paths.

`send_conversation_message` atomically enforces 5 messages per user per 10 seconds, 20 per user per minute and 40 per conversation per minute using private PostgreSQL fixed-window buckets. Each participant has a monotonic `last_read_at` cursor. Opening a conversation advances it only through the newest message actually returned, so a concurrently arriving unseen message stays unread. There are no per-message read receipts. The UI loads 50 messages and the RPC supports stable `(created_at,id)` cursor pagination up to 100.

Explicit refresh is the V1 delivery mechanism. Message insertion is the durable boundary for a future transactional outbox and throttled in-app/email notifications. SMS, push and per-message email are not implemented.
