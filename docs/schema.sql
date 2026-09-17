-- DESIGN REFERENCE ONLY. Not a deployable migration; do not apply to shared databases.
-- PostgreSQL 17 / Supabase. See database.md for invariants requiring command transactions.
-- Access deliberately denied until each feature supplies reviewed policies and tests.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'), name_key text not null unique
);
alter table public.countries enable row level security;
alter table public.countries force row level security;
revoke all on public.countries from public, anon, authenticated;

create table public.cities (
  id uuid primary key default gen_random_uuid(), country_code text not null references public.countries(code), name text not null, timezone text not null, unique (country_code, name)
);
alter table public.cities enable row level security;
alter table public.cities force row level security;
revoke all on public.cities from public, anon, authenticated;

create table public.item_categories (
  id uuid primary key default gen_random_uuid(), code text not null unique, active boolean not null default false
);
alter table public.item_categories enable row level security;
alter table public.item_categories force row level security;
revoke all on public.item_categories from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 80),
  locale text not null default 'fr' check (locale in ('fr','en','ar')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from public, anon, authenticated;

create table private.account_controls (
  user_id uuid primary key references public.profiles(id),
  status text not null default 'active' check (status in ('active','restricted','suspended','closed')),
  verification_state text not null default 'not_started' check (verification_state in ('not_started','pending','requires_input','under_review','verified','rejected','cancelled','expired','revoked')),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now()
);
alter table private.account_controls enable row level security;
alter table private.account_controls force row level security;
revoke all on private.account_controls from public, anon, authenticated;

create table private.profile_details (
  user_id uuid primary key references public.profiles(id), phone_e164 text, residence_country text references public.countries(code), created_at timestamptz not null default now()
);
alter table private.profile_details enable row level security;
alter table private.profile_details force row level security;
revoke all on private.profile_details from public, anon, authenticated;

create table private.staff_roles (
  user_id uuid not null references public.profiles(id),
  role text not null check (role in ('support','moderator','verification_reviewer','finance','administrator')),
  granted_by uuid not null references public.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, role)
);
alter table private.staff_roles enable row level security;
alter table private.staff_roles force row level security;
revoke all on private.staff_roles from public, anon, authenticated;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  traveler_id uuid not null references public.profiles(id),
  origin_city_id uuid not null references public.cities(id),
  destination_city_id uuid not null references public.cities(id),
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  capacity_grams integer not null check (capacity_grams > 0),
  max_length_mm integer check (max_length_mm > 0),
  max_width_mm integer check (max_width_mm > 0),
  max_height_mm integer check (max_height_mm > 0),
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_city_id <> destination_city_id),
  check (arrival_at >= departure_at),
  unique (id, traveler_id)
);
alter table public.trips enable row level security;
alter table public.trips force row level security;
revoke all on public.trips from public, anon, authenticated;

create table public.trip_categories (
  trip_id uuid not null references public.trips(id), category_id uuid not null references public.item_categories(id), primary key (trip_id, category_id)
);
alter table public.trip_categories enable row level security;
alter table public.trip_categories force row level security;
revoke all on public.trip_categories from public, anon, authenticated;

create table public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id),
  origin_city_id uuid not null references public.cities(id),
  destination_city_id uuid not null references public.cities(id),
  pickup_from timestamptz not null,
  pickup_until timestamptz not null,
  delivery_from timestamptz not null,
  delivery_until timestamptz not null,
  preferred_departure_at timestamptz,
  budget_minor bigint check (budget_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'draft' check (status in ('draft','open','booked','closed','cancelled')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_city_id <> destination_city_id),
  check (pickup_until >= pickup_from),
  check (delivery_until >= delivery_from and delivery_until >= pickup_from),
  check (preferred_departure_at is null or preferred_departure_at between pickup_from and pickup_until),
  unique (id, sender_id)
);
alter table public.delivery_requests enable row level security;
alter table public.delivery_requests force row level security;
revoke all on public.delivery_requests from public, anon, authenticated;

create table public.items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.delivery_requests(id),
  category_id uuid not null references public.item_categories(id),
  description text not null check (char_length(description) between 1 and 2000),
  declared_contents text not null check (char_length(declared_contents) between 1 and 4000),
  weight_grams integer not null check (weight_grams > 0),
  length_mm integer check (length_mm > 0),
  width_mm integer check (width_mm > 0),
  height_mm integer check (height_mm > 0),
  declared_value_minor bigint not null check (declared_value_minor >= 0),
  created_at timestamptz not null default now(),
  check ((length_mm is null and width_mm is null and height_mm is null) or (length_mm is not null and width_mm is not null and height_mm is not null))
);
alter table public.items enable row level security;
alter table public.items force row level security;
revoke all on public.items from public, anon, authenticated;

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id),
  bucket_id text not null default 'item-photos' check (bucket_id = 'item-photos'),
  object_path text not null,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','rejected')),
  position smallint not null check (position >= 0),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path),
  unique (item_id, position)
);
alter table public.item_photos enable row level security;
alter table public.item_photos force row level security;
revoke all on public.item_photos from public, anon, authenticated;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id),
  request_id uuid not null references public.delivery_requests(id),
  algorithm_version text not null,
  trip_version integer not null,
  request_version integer not null,
  reasons jsonb not null check (jsonb_typeof(reasons) = 'array'),
  evaluated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (expires_at > evaluated_at),
  unique (trip_id, request_id, algorithm_version)
);
alter table public.matches enable row level security;
alter table public.matches force row level security;
revoke all on public.matches from public, anon, authenticated;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null,
  request_id uuid not null,
  sender_id uuid not null references public.profiles(id),
  traveler_id uuid not null references public.profiles(id),
  proposed_by uuid not null references public.profiles(id),
  status text not null default 'proposed' check (status in ('proposed','accepted','payment_pending','confirmed','pickup_pending','picked_up','in_transit','delivery_pending','delivered','completed','declined','cancelled','expired','closed_unfulfilled')),
  weight_grams integer not null check (weight_grams > 0),
  gross_minor bigint not null check (gross_minor > 0),
  platform_fee_minor bigint not null check (platform_fee_minor >= 0),
  traveler_net_minor bigint not null check (traveler_net_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  fee_policy_version text not null,
  terms_snapshot jsonb not null check (jsonb_typeof(terms_snapshot) = 'object'),
  expires_at timestamptz not null,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_id, traveler_id) references public.trips(id, traveler_id),
  foreign key (request_id, sender_id) references public.delivery_requests(id, sender_id),
  check (sender_id <> traveler_id),
  check (proposed_by in (sender_id, traveler_id)),
  check (gross_minor = platform_fee_minor + traveler_net_minor)
);
alter table public.bookings enable row level security;
alter table public.bookings force row level security;
revoke all on public.bookings from public, anon, authenticated;

create table private.capacity_reservations (
  booking_id uuid primary key references public.bookings(id),
  trip_id uuid not null references public.trips(id),
  weight_grams integer not null check (weight_grams > 0),
  state text not null check (state in ('held','committed','released')),
  hold_until timestamptz,
  released_at timestamptz,
  check (state <> 'held' or hold_until is not null),
  check ((state = 'released') = (released_at is not null))
);
alter table private.capacity_reservations enable row level security;
alter table private.capacity_reservations force row level security;
revoke all on private.capacity_reservations from public, anon, authenticated;

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  actor_id uuid references public.profiles(id),
  actor_kind text not null check (actor_kind in ('user','staff','worker','provider')),
  command text not null,
  from_state text,
  to_state text not null,
  version integer not null,
  reason_code text,
  created_at timestamptz not null default now(),
  unique (booking_id, version)
);
alter table public.booking_events enable row level security;
alter table public.booking_events force row level security;
revoke all on public.booking_events from public, anon, authenticated;

create table private.booking_contacts (
  booking_id uuid primary key references public.bookings(id), pickup_details jsonb not null, delivery_details jsonb not null, retention_until timestamptz not null
);
alter table private.booking_contacts enable row level security;
alter table private.booking_contacts force row level security;
revoke all on private.booking_contacts from public, anon, authenticated;

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id),
  booking_id uuid unique references public.bookings(id),
  created_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
alter table public.conversations force row level security;
revoke all on public.conversations from public, anon, authenticated;

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id),
  user_id uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, user_id)
);
alter table public.conversation_members enable row level security;
alter table public.conversation_members force row level security;
revoke all on public.conversation_members from public, anon, authenticated;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id),
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  client_message_id uuid not null,
  visibility text not null default 'visible' check (visibility in ('visible','hidden')),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, author_id) references public.conversation_members(conversation_id, user_id),
  unique (author_id, client_message_id)
);
alter table public.messages enable row level security;
alter table public.messages force row level security;
revoke all on public.messages from public, anon, authenticated;

create table private.payment_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  provider_account_id text not null,
  livemode boolean not null,
  country_code text not null references public.countries(code),
  capabilities jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (provider_account_id, livemode),
  unique (user_id, livemode)
);
alter table private.payment_accounts enable row level security;
alter table private.payment_accounts force row level security;
revoke all on private.payment_accounts from public, anon, authenticated;

create table private.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  provider_account_id text not null,
  provider_intent_id text,
  livemode boolean not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null check (state in ('created','requires_payment_method','requires_action','processing','authorized','succeeded','failed','cancelled')),
  idempotency_key text not null unique,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_account_id, livemode, provider_intent_id)
);
alter table private.payments enable row level security;
alter table private.payments force row level security;
revoke all on private.payments from public, anon, authenticated;

create table private.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references private.payments(id),
  provider_refund_id text unique,
  amount_minor bigint not null check (amount_minor > 0),
  state text not null check (state in ('pending','succeeded','failed','cancelled')),
  reason_code text not null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
alter table private.refunds enable row level security;
alter table private.refunds force row level security;
revoke all on private.refunds from public, anon, authenticated;

create table private.transfers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  payment_id uuid not null references private.payments(id),
  recipient_account_id uuid not null references private.payment_accounts(id),
  provider_transfer_id text unique,
  amount_minor bigint not null check (amount_minor > 0),
  reversed_minor bigint not null default 0 check (reversed_minor >= 0 and reversed_minor <= amount_minor),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null check (state in ('pending','submitted','succeeded','failed','partially_reversed','reversed')),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
alter table private.transfers enable row level security;
alter table private.transfers force row level security;
revoke all on private.transfers from public, anon, authenticated;

create table private.payouts (
  id uuid primary key default gen_random_uuid(),
  recipient_account_id uuid not null references private.payment_accounts(id),
  provider_payout_id text not null unique,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null check (state in ('pending','in_transit','paid','failed','cancelled')),
  expected_arrival_at timestamptz,
  created_at timestamptz not null default now()
);
alter table private.payouts enable row level security;
alter table private.payouts force row level security;
revoke all on private.payouts from public, anon, authenticated;

create table private.payout_allocations (
  payout_id uuid not null references private.payouts(id),
  transfer_id uuid not null references private.transfers(id),
  amount_minor bigint not null check (amount_minor > 0),
  primary key (payout_id, transfer_id)
);
alter table private.payout_allocations enable row level security;
alter table private.payout_allocations force row level security;
revoke all on private.payout_allocations from public, anon, authenticated;

create table private.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references private.payments(id),
  provider_event_id text,
  event_type text not null,
  source_key text not null unique,
  created_at timestamptz not null default now()
);
alter table private.payment_events enable row level security;
alter table private.payment_events force row level security;
revoke all on private.payment_events from public, anon, authenticated;

create table private.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null,
  source_key text not null unique,
  booking_id uuid references public.bookings(id),
  account_code text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor <> 0),
  created_at timestamptz not null default now()
);
alter table private.ledger_entries enable row level security;
alter table private.ledger_entries force row level security;
revoke all on private.ledger_entries from public, anon, authenticated;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  author_id uuid not null references public.profiles(id),
  subject_id uuid not null references public.profiles(id),
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 2000),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (author_id <> subject_id),
  unique (booking_id, author_id)
);
alter table public.reviews enable row level security;
alter table public.reviews force row level security;
revoke all on public.reviews from public, anon, authenticated;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_user_id uuid references public.profiles(id),
  message_id uuid references public.messages(id),
  booking_id uuid references public.bookings(id),
  reason_code text not null,
  details text check (char_length(details) <= 4000),
  state text not null default 'open' check (state in ('open','triaged','resolved','dismissed')),
  created_at timestamptz not null default now(),
  check (num_nonnulls(reported_user_id, message_id, booking_id) = 1)
);
alter table public.reports enable row level security;
alter table public.reports force row level security;
revoke all on public.reports from public, anon, authenticated;

create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  opened_by uuid not null references public.profiles(id),
  reason_code text not null,
  state text not null default 'open' check (state in ('open','under_review','resolved','dismissed')),
  resolution_code text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state in ('resolved','dismissed')) = (resolved_at is not null))
);
alter table public.disputes enable row level security;
alter table public.disputes force row level security;
revoke all on public.disputes from public, anon, authenticated;

create table private.case_assignments (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles(id),
  report_id uuid references public.reports(id),
  dispute_id uuid references public.disputes(id),
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (num_nonnulls(report_id, dispute_id) = 1)
);
alter table private.case_assignments enable row level security;
alter table private.case_assignments force row level security;
revoke all on private.case_assignments from public, anon, authenticated;

create table private.provider_disputes (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references private.payments(id),
  provider_dispute_id text not null unique,
  state text not null check (state in ('open','won','lost')),
  amount_minor bigint not null check (amount_minor > 0),
  created_at timestamptz not null default now()
);
alter table private.provider_disputes enable row level security;
alter table private.provider_disputes force row level security;
revoke all on private.provider_disputes from public, anon, authenticated;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  kind text not null,
  resource_id uuid,
  dedupe_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
alter table public.notifications enable row level security;
alter table public.notifications force row level security;
revoke all on public.notifications from public, anon, authenticated;

create table private.identity_verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  provider text not null,
  provider_reference text not null,
  state text not null check (state in ('pending','requires_input','under_review','verified','rejected','cancelled','expired','revoked')),
  reason_code text,
  verified_at timestamptz,
  expires_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference),
  check (state <> 'verified' or verified_at is not null),
  check (expires_at is null or verified_at is null or expires_at > verified_at)
);
alter table private.identity_verifications enable row level security;
alter table private.identity_verifications force row level security;
revoke all on private.identity_verifications from public, anon, authenticated;

create table private.delivery_confirmations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  kind text not null check (kind in ('pickup','delivery')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts smallint not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table private.delivery_confirmations enable row level security;
alter table private.delivery_confirmations force row level security;
revoke all on private.delivery_confirmations from public, anon, authenticated;

create table private.delivery_evidence (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id),
  uploader_id uuid not null references public.profiles(id),
  bucket_id text not null check (bucket_id = 'delivery-evidence'),
  object_path text not null,
  retention_until timestamptz not null,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);
alter table private.delivery_evidence enable row level security;
alter table private.delivery_evidence force row level security;
revoke all on private.delivery_evidence from public, anon, authenticated;

create table private.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_kind text not null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  reason_code text,
  request_id uuid not null,
  metadata jsonb not null default '{}' check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
alter table private.audit_events enable row level security;
alter table private.audit_events force row level security;
revoke all on private.audit_events from public, anon, authenticated;

create table private.webhook_inbox (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_account_id text not null,
  livemode boolean not null,
  event_id text not null,
  object_reference text not null,
  event_type text not null,
  state text not null default 'pending' check (state in ('pending','processing','done','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  received_at timestamptz not null default now(),
  unique (provider, provider_account_id, livemode, event_id)
);
alter table private.webhook_inbox enable row level security;
alter table private.webhook_inbox force row level security;
revoke all on private.webhook_inbox from public, anon, authenticated;

create table private.outbox_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  resource_id uuid not null,
  dedupe_key text not null unique,
  state text not null default 'pending' check (state in ('pending','processing','done','dead')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  last_error_code text,
  created_at timestamptz not null default now()
);
alter table private.outbox_jobs enable row level security;
alter table private.outbox_jobs force row level security;
revoke all on private.outbox_jobs from public, anon, authenticated;

create table private.idempotency_keys (
  actor_id uuid not null references public.profiles(id),
  operation text not null,
  key text not null,
  request_hash text not null,
  result_resource_id uuid,
  expires_at timestamptz not null,
  primary key (actor_id, operation, key)
);
alter table private.idempotency_keys enable row level security;
alter table private.idempotency_keys force row level security;
revoke all on private.idempotency_keys from public, anon, authenticated;

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id),
  blocked_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
alter table public.user_blocks force row level security;
revoke all on public.user_blocks from public, anon, authenticated;

-- Query and concurrency indexes. All user/parent lookup foreign keys are indexed below.
create index trips_route_departure on public.trips (origin_city_id, destination_city_id, departure_at, id) where status = 'published';
create index requests_route_window on public.delivery_requests (origin_city_id, destination_city_id, pickup_from, pickup_until) where status = 'open';
create unique index one_active_booking_per_request on public.bookings (request_id) where status not in ('proposed','declined','cancelled','expired','closed_unfulfilled');
create unique index one_open_proposal_per_pair on public.bookings (trip_id, request_id) where status = 'proposed';
create unique index one_open_payment on private.payments (booking_id) where state not in ('failed','cancelled');
create unique index one_open_dispute on public.disputes (booking_id) where state in ('open','under_review');
create unique index one_current_verification on private.identity_verifications (user_id) where state in ('pending','requires_input','under_review','verified');
create index messages_cursor on public.messages (conversation_id, created_at, id);
create index notifications_unread on public.notifications (user_id, created_at desc) where read_at is null;
create index reservation_expiry on private.capacity_reservations (hold_until) where state = 'held';
create index outbox_pending on private.outbox_jobs (available_at, id) where state = 'pending';
create index inbox_pending on private.webhook_inbox (available_at, id) where state = 'pending';
create index audit_resource_time on private.audit_events (resource_type, resource_id, created_at desc);
create index ledger_journal on private.ledger_entries (journal_id, currency);
create index cities_country_code_idx on public.cities (country_code);
create index profile_details_residence_country_idx on private.profile_details (residence_country);
create index staff_roles_user_id_idx on private.staff_roles (user_id);
create index staff_roles_granted_by_idx on private.staff_roles (granted_by);
create index trips_traveler_id_idx on public.trips (traveler_id);
create index trips_origin_city_id_idx on public.trips (origin_city_id);
create index trips_destination_city_id_idx on public.trips (destination_city_id);
create index trip_categories_trip_id_idx on public.trip_categories (trip_id);
create index trip_categories_category_id_idx on public.trip_categories (category_id);
create index delivery_requests_sender_id_idx on public.delivery_requests (sender_id);
create index delivery_requests_origin_city_id_idx on public.delivery_requests (origin_city_id);
create index delivery_requests_destination_city_id_idx on public.delivery_requests (destination_city_id);
create index items_request_id_idx on public.items (request_id);
create index items_category_id_idx on public.items (category_id);
create index item_photos_item_id_idx on public.item_photos (item_id);
create index matches_trip_id_idx on public.matches (trip_id);
create index matches_request_id_idx on public.matches (request_id);
create index bookings_sender_id_idx on public.bookings (sender_id);
create index bookings_traveler_id_idx on public.bookings (traveler_id);
create index bookings_proposed_by_idx on public.bookings (proposed_by);
create index capacity_reservations_trip_id_idx on private.capacity_reservations (trip_id);
create index booking_events_booking_id_idx on public.booking_events (booking_id);
create index booking_events_actor_id_idx on public.booking_events (actor_id);
create index conversation_members_conversation_id_idx on public.conversation_members (conversation_id);
create index conversation_members_user_id_idx on public.conversation_members (user_id);
create index messages_conversation_id_idx on public.messages (conversation_id);
create index messages_author_id_idx on public.messages (author_id);
create index payment_accounts_user_id_idx on private.payment_accounts (user_id);
create index payment_accounts_country_code_idx on private.payment_accounts (country_code);
create index payments_booking_id_idx on private.payments (booking_id);
create index refunds_payment_id_idx on private.refunds (payment_id);
create index transfers_booking_id_idx on private.transfers (booking_id);
create index transfers_payment_id_idx on private.transfers (payment_id);
create index transfers_recipient_account_id_idx on private.transfers (recipient_account_id);
create index payouts_recipient_account_id_idx on private.payouts (recipient_account_id);
create index payout_allocations_payout_id_idx on private.payout_allocations (payout_id);
create index payout_allocations_transfer_id_idx on private.payout_allocations (transfer_id);
create index payment_events_payment_id_idx on private.payment_events (payment_id);
create index ledger_entries_booking_id_idx on private.ledger_entries (booking_id);
create index reviews_booking_id_idx on public.reviews (booking_id);
create index reviews_author_id_idx on public.reviews (author_id);
create index reviews_subject_id_idx on public.reviews (subject_id);
create index reports_reporter_id_idx on public.reports (reporter_id);
create index reports_reported_user_id_idx on public.reports (reported_user_id);
create index reports_message_id_idx on public.reports (message_id);
create index reports_booking_id_idx on public.reports (booking_id);
create index disputes_booking_id_idx on public.disputes (booking_id);
create index disputes_opened_by_idx on public.disputes (opened_by);
create index case_assignments_staff_id_idx on private.case_assignments (staff_id);
create index case_assignments_report_id_idx on private.case_assignments (report_id);
create index case_assignments_dispute_id_idx on private.case_assignments (dispute_id);
create index provider_disputes_payment_id_idx on private.provider_disputes (payment_id);
create index notifications_user_id_idx on public.notifications (user_id);
create index identity_verifications_user_id_idx on private.identity_verifications (user_id);
create index delivery_confirmations_booking_id_idx on private.delivery_confirmations (booking_id);
create index delivery_evidence_booking_id_idx on private.delivery_evidence (booking_id);
create index delivery_evidence_uploader_id_idx on private.delivery_evidence (uploader_id);
create index audit_events_actor_id_idx on private.audit_events (actor_id);
create index idempotency_keys_actor_id_idx on private.idempotency_keys (actor_id);
create index user_blocks_blocker_id_idx on public.user_blocks (blocker_id);
create index user_blocks_blocked_id_idx on public.user_blocks (blocked_id);

-- No policies, table grants, RPCs, buckets, seeds or realtime publication are enabled.
-- Feature migrations must supply least-privilege access and transaction guards.
commit;
