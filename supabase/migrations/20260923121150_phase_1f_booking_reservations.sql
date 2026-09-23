-- Phase 1F: sender-initiated booking proposals and atomic trip-capacity reservations.

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique,
  trip_id uuid not null references public.trips(id) on delete restrict,
  delivery_request_id uuid not null references public.delivery_requests(id) on delete restrict,
  traveler_id uuid not null references public.profiles(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  reserved_capacity_grams integer not null check (reserved_capacity_grams > 0 and reserved_capacity_grams <= 50000),
  status text not null default 'proposed' check (status in ('proposed','accepted','rejected','cancelled','expired')),
  version integer not null default 1 check (version > 0),
  expires_at timestamptz not null,
  proposed_at timestamptz not null default now(),
  accepted_at timestamptz,
  rejected_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) between 3 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (traveler_id <> sender_id),
  check (expires_at > proposed_at),
  check (accepted_at is null or status in ('accepted','cancelled')),
  check (status <> 'accepted' or accepted_at is not null),
  check ((status = 'rejected') = (rejected_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check ((status = 'expired') = (expired_at is not null))
);

alter table public.matches add constraint matches_id_trip_request_unique
  unique (id,trip_id,delivery_request_id);
alter table public.bookings add constraint bookings_match_relationship_fk
  foreign key (match_id,trip_id,delivery_request_id)
  references public.matches(id,trip_id,delivery_request_id) on delete restrict;
alter table public.bookings add constraint bookings_id_trip_capacity_unique
  unique (id,trip_id,reserved_capacity_grams);

create index bookings_sender_created_idx on public.bookings (sender_id, created_at desc, id);
create index bookings_traveler_created_idx on public.bookings (traveler_id, created_at desc, id);
create index bookings_trip_status_idx on public.bookings (trip_id, status);
create index bookings_request_fk_idx on public.bookings (delivery_request_id);
create index bookings_open_expiry_idx on public.bookings (expires_at) where status = 'proposed';

create table public.capacity_reservations (
  booking_id uuid primary key,
  trip_id uuid not null,
  capacity_grams integer not null check (capacity_grams > 0 and capacity_grams <= 50000),
  reserved_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text check (release_reason is null or release_reason in ('booking_cancelled')),
  check ((released_at is null) = (release_reason is null))
);

alter table public.capacity_reservations add constraint capacity_reservation_booking_terms_fk
  foreign key (booking_id,trip_id,capacity_grams)
  references public.bookings(id,trip_id,reserved_capacity_grams) on delete restrict;
alter table public.capacity_reservations add constraint capacity_reservations_trip_fk
  foreign key (trip_id) references public.trips(id) on delete restrict;

create index capacity_reservations_trip_active_idx
  on public.capacity_reservations (trip_id, booking_id)
  include (capacity_grams) where released_at is null;

create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in (
    'proposed','accepted','rejected','cancelled','expired',
    'reservation_created','reservation_released'
  )),
  from_status text check (from_status is null or from_status in ('proposed','accepted','rejected','cancelled','expired')),
  to_status text check (to_status is null or to_status in ('proposed','accepted','rejected','cancelled','expired')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index booking_events_booking_created_idx on public.booking_events (booking_id, created_at, id);

create table public.booking_command_receipts (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  command_type text not null check (command_type in ('propose','accept','reject','cancel','expire')),
  idempotency_key uuid not null,
  resulting_status text not null check (resulting_status in ('proposed','accepted','rejected','cancelled','expired')),
  resulting_version integer not null check (resulting_version > 0),
  created_at timestamptz not null default now(),
  unique (actor_id, command_type, idempotency_key)
);

create index booking_command_receipts_booking_idx on public.booking_command_receipts (booking_id);

alter table public.bookings enable row level security;
alter table public.capacity_reservations enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_command_receipts enable row level security;
revoke all on public.bookings, public.capacity_reservations, public.booking_events,
  public.booking_command_receipts from anon, authenticated;
revoke all on sequence public.booking_events_id_seq, public.booking_command_receipts_id_seq
  from anon, authenticated;

create function private.trip_reserved_capacity(input_trip_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(r.capacity_grams), 0)::integer
  from public.capacity_reservations r
  where r.trip_id = input_trip_id and r.released_at is null;
$$;
revoke all on function private.trip_reserved_capacity(uuid) from public, anon, authenticated;

create or replace function private.current_matching_candidates(
  input_trip_id uuid default null,
  input_request_id uuid default null
) returns table (
  trip_id uuid,
  delivery_request_id uuid,
  trip_version integer,
  request_version integer,
  date_slack_minutes integer,
  capacity_slack_grams integer,
  score bigint,
  reason_codes text[]
) language sql stable security definer set search_path = '' as $$
  with eligible as (
    select
      t.id as trip_id,
      r.id as delivery_request_id,
      t.version as trip_version,
      r.version as request_version,
      floor(extract(epoch from (
        (t.departure_at - r.earliest_departure_at)
        + (r.latest_delivery_at - t.arrival_at)
      )) / 60)::integer as date_slack_minutes,
      (t.capacity_grams - private.trip_reserved_capacity(t.id) - i.weight_grams)::integer as capacity_slack_grams
    from public.trips t
    join public.delivery_requests r
      on r.origin_location_id = t.origin_location_id
     and r.destination_location_id = t.destination_location_id
     and r.status = 'published'
     and r.latest_delivery_at > now()
     and t.departure_at >= r.earliest_departure_at
     and t.arrival_at <= r.latest_delivery_at
     and r.owner_id <> t.owner_id
    join public.declared_items i on i.delivery_request_id = r.id
    join public.trip_categories tc
      on tc.trip_id = t.id and tc.category_code = i.category_code
    join public.item_categories c
      on c.code = i.category_code and c.active
    join public.profiles traveler
      on traveler.id = t.owner_id and traveler.account_status = 'active'
    join public.profiles sender
      on sender.id = r.owner_id and sender.account_status = 'active'
    where t.status = 'published'
      and t.departure_at > now()
      and t.capacity_grams - private.trip_reserved_capacity(t.id) >= i.weight_grams
      and (input_trip_id is null or t.id = input_trip_id)
      and (input_request_id is null or r.id = input_request_id)
  )
  select
    e.trip_id, e.delivery_request_id, e.trip_version, e.request_version,
    e.date_slack_minutes, e.capacity_slack_grams,
    ((100000 - least(e.date_slack_minutes, 100000))::bigint * 10001
      + (10000 - least(e.capacity_slack_grams / 100, 10000))::bigint) as score,
    array['exact_route','date_window_fit','category_accepted','capacity_sufficient']::text[]
  from eligible e;
$$;

create function private.assert_active_booking_actor(input_actor uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if input_actor is null or not exists (
    select 1 from public.profiles p where p.id = input_actor and p.account_status = 'active'
  ) then
    raise exception using errcode = '42501', message = 'active account required';
  end if;
end;
$$;
revoke all on function private.assert_active_booking_actor(uuid) from public, anon, authenticated;

create function private.booking_result(input_booking_id uuid)
returns table (booking_id uuid, status text, version integer)
language sql stable security definer set search_path = '' as $$
  select b.id, b.status, b.version from public.bookings b where b.id = input_booking_id;
$$;
revoke all on function private.booking_result(uuid) from public, anon, authenticated;

create function public.propose_booking(input_match_id uuid, input_idempotency_key uuid)
returns table (booking_id uuid, status text, version integer)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare existing_receipt public.booking_command_receipts%rowtype;
declare selected_match public.matches%rowtype;
declare trip_row public.trips%rowtype;
declare request_row public.delivery_requests%rowtype;
declare item_weight integer;
declare new_booking public.bookings%rowtype;
begin
  perform private.assert_active_booking_actor(actor);
  if input_match_id is null or input_idempotency_key is null then
    raise exception using errcode='22023', message='invalid booking proposal';
  end if;

  select * into existing_receipt from public.booking_command_receipts r
  where r.actor_id=actor and r.command_type='propose' and r.idempotency_key=input_idempotency_key;
  if found then return query select * from private.booking_result(existing_receipt.booking_id); return; end if;

  select * into selected_match from public.matches m where m.id=input_match_id for update;
  if not found or not selected_match.active then
    raise exception using errcode='P0001', message='match unavailable';
  end if;

  perform 1 from private.current_matching_candidates(selected_match.trip_id, selected_match.delivery_request_id);
  if not found then raise exception using errcode='P0001', message='match unavailable'; end if;

  select * into trip_row from public.trips t where t.id=selected_match.trip_id;
  select * into request_row from public.delivery_requests r where r.id=selected_match.delivery_request_id;
  if actor <> request_row.owner_id then
    raise exception using errcode='42501', message='sender required';
  end if;
  select i.weight_grams into item_weight from public.declared_items i
  where i.delivery_request_id=request_row.id;

  insert into public.bookings (
    match_id,trip_id,delivery_request_id,traveler_id,sender_id,
    reserved_capacity_grams,expires_at
  ) values (
    selected_match.id,trip_row.id,request_row.id,trip_row.owner_id,request_row.owner_id,
    item_weight,least(now()+interval '48 hours',trip_row.departure_at,request_row.latest_delivery_at)
  ) returning * into new_booking;

  insert into public.booking_events (booking_id,actor_id,event_type,to_status)
  values (new_booking.id,actor,'proposed','proposed');
  insert into public.booking_command_receipts (
    booking_id,actor_id,command_type,idempotency_key,resulting_status,resulting_version
  ) values (new_booking.id,actor,'propose',input_idempotency_key,new_booking.status,new_booking.version);
  return query select new_booking.id,new_booking.status,new_booking.version;
exception
  when unique_violation then
    select * into new_booking from public.bookings b where b.match_id=input_match_id;
    if found and new_booking.sender_id=actor then
      return query select new_booking.id,new_booking.status,new_booking.version;
      return;
    end if;
    raise;
end;
$$;

create function public.accept_booking(
  input_booking_id uuid,input_expected_version integer,input_idempotency_key uuid
) returns table (booking_id uuid,status text,version integer)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare existing_receipt public.booking_command_receipts%rowtype;
declare booking_row public.bookings%rowtype;
declare trip_row public.trips%rowtype;
declare reserved integer;
begin
  perform private.assert_active_booking_actor(actor);
  if input_booking_id is null or input_expected_version is null or input_idempotency_key is null then
    raise exception using errcode='22023',message='invalid booking acceptance';
  end if;
  select * into existing_receipt from public.booking_command_receipts r
  where r.actor_id=actor and r.command_type='accept' and r.idempotency_key=input_idempotency_key;
  if found then return query select * from private.booking_result(existing_receipt.booking_id); return; end if;

  select * into booking_row from public.bookings b where b.id=input_booking_id for update;
  if not found or booking_row.traveler_id<>actor then
    raise exception using errcode='42501',message='booking unavailable';
  end if;
  if booking_row.status='accepted' then return query select booking_row.id,booking_row.status,booking_row.version; return; end if;
  if booking_row.status<>'proposed' then raise exception using errcode='P0001',message='invalid booking transition'; end if;
  if booking_row.version<>input_expected_version then raise exception using errcode='40001',message='stale booking version'; end if;
  if booking_row.expires_at<=now() then
    update public.bookings b set status='expired',expired_at=now(),updated_at=now(),version=b.version+1
    where b.id=booking_row.id returning b.* into booking_row;
    insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status)
    values(booking_row.id,actor,'expired','proposed','expired');
    insert into public.booking_command_receipts(booking_id,actor_id,command_type,idempotency_key,resulting_status,resulting_version)
    values(booking_row.id,actor,'accept',input_idempotency_key,booking_row.status,booking_row.version);
    return query select booking_row.id,booking_row.status,booking_row.version; return;
  end if;

  select * into trip_row from public.trips t where t.id=booking_row.trip_id for update;
  if not exists(select 1 from private.current_matching_candidates(booking_row.trip_id,booking_row.delivery_request_id)) then
    raise exception using errcode='P0001',message='booking opportunity unavailable';
  end if;
  perform private.assert_active_booking_actor(booking_row.sender_id);
  select private.trip_reserved_capacity(trip_row.id) into reserved;
  if trip_row.capacity_grams-reserved<booking_row.reserved_capacity_grams then
    raise exception using errcode='P0001',message='insufficient trip capacity';
  end if;

  insert into public.capacity_reservations(booking_id,trip_id,capacity_grams)
  values(booking_row.id,trip_row.id,booking_row.reserved_capacity_grams);
  update public.bookings b set status='accepted',accepted_at=now(),updated_at=now(),version=b.version+1
  where b.id=booking_row.id returning b.* into booking_row;
  insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status)
  values(booking_row.id,actor,'accepted','proposed','accepted');
  insert into public.booking_events(booking_id,actor_id,event_type,metadata)
  values(booking_row.id,actor,'reservation_created',jsonb_build_object('capacity_grams',booking_row.reserved_capacity_grams));
  insert into public.booking_command_receipts(booking_id,actor_id,command_type,idempotency_key,resulting_status,resulting_version)
  values(booking_row.id,actor,'accept',input_idempotency_key,booking_row.status,booking_row.version);
  perform private.recompute_matches_for_trip(booking_row.trip_id);
  return query select booking_row.id,booking_row.status,booking_row.version;
end;
$$;

create function public.reject_booking(
  input_booking_id uuid,input_expected_version integer,input_idempotency_key uuid
) returns table (booking_id uuid,status text,version integer)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare receipt public.booking_command_receipts%rowtype;
declare b public.bookings%rowtype;
begin
  perform private.assert_active_booking_actor(actor);
  select * into receipt from public.booking_command_receipts r where r.actor_id=actor and r.command_type='reject' and r.idempotency_key=input_idempotency_key;
  if found then return query select * from private.booking_result(receipt.booking_id); return; end if;
  select * into b from public.bookings x where x.id=input_booking_id for update;
  if not found or b.traveler_id<>actor then raise exception using errcode='42501',message='booking unavailable'; end if;
  if b.status='rejected' then return query select b.id,b.status,b.version; return; end if;
  if b.status<>'proposed' then raise exception using errcode='P0001',message='invalid booking transition'; end if;
  if b.version<>input_expected_version then raise exception using errcode='40001',message='stale booking version'; end if;
  update public.bookings x set status='rejected',rejected_at=now(),updated_at=now(),version=x.version+1 where x.id=b.id returning x.* into b;
  insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status) values(b.id,actor,'rejected','proposed','rejected');
  insert into public.booking_command_receipts(booking_id,actor_id,command_type,idempotency_key,resulting_status,resulting_version) values(b.id,actor,'reject',input_idempotency_key,b.status,b.version);
  return query select b.id,b.status,b.version;
end;
$$;

create function public.cancel_booking(
  input_booking_id uuid,input_expected_version integer,input_idempotency_key uuid,input_reason text
) returns table (booking_id uuid,status text,version integer)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare receipt public.booking_command_receipts%rowtype;
declare b public.bookings%rowtype;
declare released integer;
begin
  if actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  if input_reason is null or char_length(btrim(input_reason)) not between 3 and 240 then raise exception using errcode='22023',message='invalid cancellation reason'; end if;
  select * into receipt from public.booking_command_receipts r where r.actor_id=actor and r.command_type='cancel' and r.idempotency_key=input_idempotency_key;
  if found then return query select * from private.booking_result(receipt.booking_id); return; end if;
  select * into b from public.bookings x where x.id=input_booking_id for update;
  if not found or actor not in (b.sender_id,b.traveler_id) then raise exception using errcode='42501',message='booking unavailable'; end if;
  if b.status='cancelled' then return query select b.id,b.status,b.version; return; end if;
  if b.status not in ('proposed','accepted') then raise exception using errcode='P0001',message='invalid booking transition'; end if;
  if b.version<>input_expected_version then raise exception using errcode='40001',message='stale booking version'; end if;
  if b.status='accepted' then perform 1 from public.trips t where t.id=b.trip_id for update; end if;
  update public.capacity_reservations r set released_at=now(),release_reason='booking_cancelled'
  where r.booking_id=b.id and r.released_at is null;
  get diagnostics released=row_count;
  update public.bookings x set status='cancelled',cancelled_at=now(),cancellation_reason=btrim(input_reason),updated_at=now(),version=x.version+1 where x.id=b.id returning x.* into b;
  insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status) values(b.id,actor,'cancelled',case when released=1 then 'accepted' else 'proposed' end,'cancelled');
  if released=1 then
    insert into public.booking_events(booking_id,actor_id,event_type,metadata) values(b.id,actor,'reservation_released',jsonb_build_object('capacity_grams',b.reserved_capacity_grams));
    perform private.recompute_matches_for_trip(b.trip_id);
  end if;
  insert into public.booking_command_receipts(booking_id,actor_id,command_type,idempotency_key,resulting_status,resulting_version) values(b.id,actor,'cancel',input_idempotency_key,b.status,b.version);
  return query select b.id,b.status,b.version;
end;
$$;

create function public.expire_booking(input_booking_id uuid,input_expected_version integer,input_idempotency_key uuid)
returns table (booking_id uuid,status text,version integer)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare receipt public.booking_command_receipts%rowtype;
declare b public.bookings%rowtype;
begin
  if actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  select * into receipt from public.booking_command_receipts r where r.actor_id=actor and r.command_type='expire' and r.idempotency_key=input_idempotency_key;
  if found then return query select * from private.booking_result(receipt.booking_id); return; end if;
  select * into b from public.bookings x where x.id=input_booking_id for update;
  if not found or actor not in (b.sender_id,b.traveler_id) then raise exception using errcode='42501',message='booking unavailable'; end if;
  if b.status='expired' then return query select b.id,b.status,b.version; return; end if;
  if b.status<>'proposed' or b.expires_at>now() then raise exception using errcode='P0001',message='booking not expirable'; end if;
  if b.version<>input_expected_version then raise exception using errcode='40001',message='stale booking version'; end if;
  update public.bookings x set status='expired',expired_at=now(),updated_at=now(),version=x.version+1 where x.id=b.id returning x.* into b;
  insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status) values(b.id,actor,'expired','proposed','expired');
  insert into public.booking_command_receipts(booking_id,actor_id,command_type,idempotency_key,resulting_status,resulting_version) values(b.id,actor,'expire',input_idempotency_key,b.status,b.version);
  return query select b.id,b.status,b.version;
end;
$$;

create function public.get_my_bookings(input_limit integer default 25,input_offset integer default 0)
returns table (
  booking_id uuid,match_id uuid,participant_role text,status text,version integer,reserved_capacity_grams integer,
  expires_at timestamptz,proposed_at timestamptz,accepted_at timestamptz,rejected_at timestamptz,
  cancelled_at timestamptz,expired_at timestamptz,trip_id uuid,delivery_request_id uuid,
  counterparty_id uuid,counterparty_display_name text,origin_name text,destination_name text,
  departure_at timestamptz,arrival_at timestamptz,item_title text,category_code text,
  offered_capacity_grams integer,reserved_trip_capacity_grams integer,available_capacity_grams integer
) language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare expired_booking uuid;
begin
  if actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  if input_limit not between 1 and 50 or input_offset not between 0 and 10000 then raise exception using errcode='22023',message='invalid booking pagination'; end if;
  for expired_booking in
    update public.bookings b set status='expired',expired_at=now(),updated_at=now(),version=b.version+1
    where b.status='proposed' and b.expires_at<=now() and actor in (b.sender_id,b.traveler_id)
    returning b.id
  loop
    insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status)
    values(expired_booking,null,'expired','proposed','expired');
  end loop;
  return query
  select b.id,b.match_id,case when b.sender_id=actor then 'sender' else 'traveler' end,b.status,b.version,b.reserved_capacity_grams,
    b.expires_at,b.proposed_at,b.accepted_at,b.rejected_at,b.cancelled_at,b.expired_at,b.trip_id,b.delivery_request_id,
    case when b.sender_id=actor then b.traveler_id else b.sender_id end,cp.display_name,
    ol.canonical_name,dl.canonical_name,t.departure_at,t.arrival_at,i.title,i.category_code,t.capacity_grams,
    private.trip_reserved_capacity(t.id),t.capacity_grams-private.trip_reserved_capacity(t.id)
  from public.bookings b
  join public.trips t on t.id=b.trip_id
  join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  join public.locations ol on ol.id=t.origin_location_id
  join public.locations dl on dl.id=t.destination_location_id
  join public.profiles cp on cp.id=case when b.sender_id=actor then b.traveler_id else b.sender_id end
  where actor in (b.sender_id,b.traveler_id)
  order by b.created_at desc,b.id
  limit input_limit offset input_offset;
end;
$$;

create function public.get_booking(input_booking_id uuid)
returns table (
  booking_id uuid,match_id uuid,participant_role text,status text,version integer,reserved_capacity_grams integer,
  expires_at timestamptz,proposed_at timestamptz,accepted_at timestamptz,rejected_at timestamptz,
  cancelled_at timestamptz,expired_at timestamptz,trip_id uuid,delivery_request_id uuid,
  counterparty_id uuid,counterparty_display_name text,origin_name text,destination_name text,
  departure_at timestamptz,arrival_at timestamptz,item_title text,category_code text,
  offered_capacity_grams integer,reserved_trip_capacity_grams integer,available_capacity_grams integer
) language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare expired_booking uuid;
begin
  if actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  update public.bookings b set status='expired',expired_at=now(),updated_at=now(),version=b.version+1
  where b.id=input_booking_id and b.status='proposed' and b.expires_at<=now()
    and actor in (b.sender_id,b.traveler_id)
  returning b.id into expired_booking;
  if expired_booking is not null then
    insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status)
    values(expired_booking,null,'expired','proposed','expired');
  end if;
  return query
  select b.id,b.match_id,case when b.sender_id=actor then 'sender' else 'traveler' end,b.status,b.version,b.reserved_capacity_grams,
    b.expires_at,b.proposed_at,b.accepted_at,b.rejected_at,b.cancelled_at,b.expired_at,b.trip_id,b.delivery_request_id,
    case when b.sender_id=actor then b.traveler_id else b.sender_id end,cp.display_name,
    ol.canonical_name,dl.canonical_name,t.departure_at,t.arrival_at,i.title,i.category_code,t.capacity_grams,
    private.trip_reserved_capacity(t.id),t.capacity_grams-private.trip_reserved_capacity(t.id)
  from public.bookings b
  join public.trips t on t.id=b.trip_id
  join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  join public.locations ol on ol.id=t.origin_location_id
  join public.locations dl on dl.id=t.destination_location_id
  join public.profiles cp on cp.id=case when b.sender_id=actor then b.traveler_id else b.sender_id end
  where b.id=input_booking_id and actor in (b.sender_id,b.traveler_id);
end;
$$;

do $$ begin
  revoke execute on function public.propose_booking(uuid,uuid) from public,anon;
  revoke execute on function public.accept_booking(uuid,integer,uuid) from public,anon;
  revoke execute on function public.reject_booking(uuid,integer,uuid) from public,anon;
  revoke execute on function public.cancel_booking(uuid,integer,uuid,text) from public,anon;
  revoke execute on function public.expire_booking(uuid,integer,uuid) from public,anon;
  revoke execute on function public.get_my_bookings(integer,integer) from public,anon;
  revoke execute on function public.get_booking(uuid) from public,anon;
  grant execute on function public.propose_booking(uuid,uuid) to authenticated;
  grant execute on function public.accept_booking(uuid,integer,uuid) to authenticated;
  grant execute on function public.reject_booking(uuid,integer,uuid) to authenticated;
  grant execute on function public.cancel_booking(uuid,integer,uuid,text) to authenticated;
  grant execute on function public.expire_booking(uuid,integer,uuid) to authenticated;
  grant execute on function public.get_my_bookings(integer,integer) to authenticated;
  grant execute on function public.get_booking(uuid) to authenticated;
end $$;
