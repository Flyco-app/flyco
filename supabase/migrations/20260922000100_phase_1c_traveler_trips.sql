-- Phase 1C: traveler trips, explicit lifecycle commands, narrow discovery,
-- optimistic concurrency, normalized categories and transition audit.

create table public.item_categories (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  sort_order smallint not null unique check (sort_order > 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.item_categories enable row level security;
revoke all on public.item_categories from anon, authenticated;
grant select (code, sort_order, active) on public.item_categories to anon, authenticated;
create policy item_categories_read_active on public.item_categories
  for select to anon, authenticated using (active);

insert into public.item_categories (code, sort_order) values
  ('documents', 10),
  ('clothing', 20),
  ('electronics', 30),
  ('packaged_goods', 40),
  ('other_personal_items', 50);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  origin_location_id uuid not null references public.locations(id) on delete restrict,
  destination_location_id uuid not null references public.locations(id) on delete restrict,
  departure_at timestamptz not null,
  arrival_at timestamptz not null,
  capacity_grams integer not null check (capacity_grams between 1 and 50000),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'expired', 'completed')),
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_location_id <> destination_location_id),
  check (arrival_at > departure_at),
  check ((status <> 'published') or published_at is not null),
  check ((status <> 'cancelled') or cancelled_at is not null),
  check ((status <> 'expired') or expired_at is not null),
  check ((status <> 'completed') or completed_at is not null)
);
create index trips_owner_updated_idx on public.trips (owner_id, updated_at desc);
create index trips_published_route_departure_idx
  on public.trips (origin_location_id, destination_location_id, departure_at)
  where status = 'published';
alter table public.trips enable row level security;
revoke all on public.trips from anon, authenticated;
grant select (
  id, owner_id, origin_location_id, destination_location_id,
  departure_at, arrival_at, capacity_grams, status, version,
  published_at, cancelled_at, expired_at, completed_at, created_at, updated_at
) on public.trips to authenticated;
create policy trips_read_own on public.trips
  for select to authenticated using (owner_id = (select auth.uid()));

create table public.trip_categories (
  trip_id uuid not null references public.trips(id) on delete restrict,
  category_code text not null references public.item_categories(code) on delete restrict,
  primary key (trip_id, category_code)
);
create index trip_categories_category_trip_idx
  on public.trip_categories (category_code, trip_id);
alter table public.trip_categories enable row level security;
revoke all on public.trip_categories from anon, authenticated;
grant select (trip_id, category_code) on public.trip_categories to authenticated;
create policy trip_categories_read_own on public.trip_categories
  for select to authenticated using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.owner_id = (select auth.uid())
    )
  );

create table public.trip_cancellations (
  trip_id uuid primary key references public.trips(id) on delete restrict,
  reason text not null check (
    char_length(reason) between 3 and 500 and reason = btrim(reason)
  ),
  cancelled_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.trip_cancellations enable row level security;
revoke all on public.trip_cancellations from anon, authenticated;
grant select (trip_id, reason, created_at) on public.trip_cancellations to authenticated;
create policy trip_cancellations_read_own on public.trip_cancellations
  for select to authenticated using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.owner_id = (select auth.uid())
    )
  );

create table public.trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('member', 'system')),
  event_type text not null check (
    event_type in (
      'created', 'draft_edited', 'published',
      'published_edited', 'cancelled', 'expired', 'completed'
    )
  ),
  from_status text,
  to_status text not null,
  trip_version integer not null check (trip_version > 0),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index trip_events_trip_created_idx on public.trip_events (trip_id, created_at);
alter table public.trip_events enable row level security;
revoke all on public.trip_events from anon, authenticated;
grant select (
  id, trip_id, actor_kind, event_type, from_status,
  to_status, trip_version, metadata, created_at
) on public.trip_events to authenticated;
create policy trip_events_read_own on public.trip_events
  for select to authenticated using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.owner_id = (select auth.uid())
    )
  );

create function private.current_active_member()
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not exists (
    select 1 from public.profiles p
    where p.id = actor and p.account_status = 'active'
  ) then
    raise exception 'active member required' using errcode = '42501';
  end if;
  return actor;
end;
$$;
revoke all on function private.current_active_member() from public, anon, authenticated;

create function private.validate_trip_input(
  input_origin uuid,
  input_destination uuid,
  input_departure timestamptz,
  input_arrival timestamptz,
  input_capacity_grams integer,
  input_category_codes text[]
) returns void language plpgsql security definer set search_path = '' as $$
declare requested_count integer;
declare available_count integer;
begin
  if input_origin is null or input_destination is null or input_origin = input_destination then
    raise exception 'invalid trip locations' using errcode = '22023';
  end if;
  if (select count(*) from public.locations l where l.id in (input_origin, input_destination) and l.active) <> 2 then
    raise exception 'inactive or unknown trip location' using errcode = '22023';
  end if;
  if input_departure is null or input_arrival is null or input_arrival <= input_departure then
    raise exception 'invalid trip times' using errcode = '22023';
  end if;
  if input_capacity_grams is null or input_capacity_grams not between 1 and 50000 then
    raise exception 'invalid trip capacity' using errcode = '22023';
  end if;
  requested_count := coalesce(cardinality(input_category_codes), 0);
  if requested_count < 1 or requested_count > 10
     or array_position(input_category_codes, null) is not null then
    raise exception 'invalid trip categories' using errcode = '22023';
  end if;
  select count(distinct c.code) into available_count
  from public.item_categories c
  where c.active and c.code = any(input_category_codes);
  if available_count <> requested_count then
    raise exception 'invalid trip categories' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.validate_trip_input(uuid,uuid,timestamptz,timestamptz,integer,text[]) from public, anon, authenticated;

create function public.create_trip_draft(
  input_origin uuid,
  input_destination uuid,
  input_departure timestamptz,
  input_arrival timestamptz,
  input_capacity_grams integer,
  input_category_codes text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare new_trip_id uuid;
begin
  perform private.validate_trip_input(
    input_origin, input_destination, input_departure, input_arrival,
    input_capacity_grams, input_category_codes
  );
  insert into public.trips (
    owner_id, origin_location_id, destination_location_id,
    departure_at, arrival_at, capacity_grams
  ) values (
    actor, input_origin, input_destination,
    input_departure, input_arrival, input_capacity_grams
  ) returning id into new_trip_id;
  insert into public.trip_categories (trip_id, category_code)
  select new_trip_id, category.code
  from unnest(input_category_codes) as category(code);
  insert into public.trip_events (
    trip_id, actor_id, actor_kind, event_type,
    from_status, to_status, trip_version
  ) values (new_trip_id, actor, 'member', 'created', null, 'draft', 1);
  return new_trip_id;
end;
$$;
revoke all on function public.create_trip_draft(uuid,uuid,timestamptz,timestamptz,integer,text[]) from public, anon;
grant execute on function public.create_trip_draft(uuid,uuid,timestamptz,timestamptz,integer,text[]) to authenticated;

create function public.update_trip(
  input_trip_id uuid,
  input_expected_version integer,
  input_origin uuid,
  input_destination uuid,
  input_departure timestamptz,
  input_arrival timestamptz,
  input_capacity_grams integer,
  input_category_codes text[]
) returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_trip public.trips%rowtype;
declare next_version integer;
declare event_name text;
begin
  select * into current_trip from public.trips
  where id = input_trip_id and owner_id = actor for update;
  if not found then raise exception 'trip unavailable' using errcode = '42501'; end if;
  if current_trip.version <> input_expected_version then
    raise exception 'stale trip version' using errcode = '40001';
  end if;
  if current_trip.status not in ('draft', 'published')
     or (current_trip.status = 'published' and current_trip.departure_at <= now()) then
    raise exception 'trip cannot be edited' using errcode = '55000';
  end if;
  perform private.validate_trip_input(
    input_origin, input_destination, input_departure, input_arrival,
    input_capacity_grams, input_category_codes
  );
  if current_trip.status = 'published' then
    if input_origin <> current_trip.origin_location_id
       or input_destination <> current_trip.destination_location_id
       or input_departure <= now()
       or input_departure > now() + interval '1 year' then
      raise exception 'published route cannot be changed' using errcode = '55000';
    end if;
    event_name := 'published_edited';
  else
    event_name := 'draft_edited';
  end if;
  next_version := current_trip.version + 1;
  update public.trips set
    origin_location_id = input_origin,
    destination_location_id = input_destination,
    departure_at = input_departure,
    arrival_at = input_arrival,
    capacity_grams = input_capacity_grams,
    version = next_version,
    updated_at = now()
  where id = input_trip_id;
  delete from public.trip_categories where trip_id = input_trip_id;
  insert into public.trip_categories (trip_id, category_code)
  select input_trip_id, category.code
  from unnest(input_category_codes) as category(code);
  insert into public.trip_events (
    trip_id, actor_id, actor_kind, event_type,
    from_status, to_status, trip_version
  ) values (
    input_trip_id, actor, 'member', event_name,
    current_trip.status, current_trip.status, next_version
  );
  return next_version;
end;
$$;
revoke all on function public.update_trip(uuid,integer,uuid,uuid,timestamptz,timestamptz,integer,text[]) from public, anon;
grant execute on function public.update_trip(uuid,integer,uuid,uuid,timestamptz,timestamptz,integer,text[]) to authenticated;

create function public.publish_trip(
  input_trip_id uuid,
  input_expected_version integer
) returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_trip public.trips%rowtype;
declare next_version integer;
begin
  select * into current_trip from public.trips
  where id = input_trip_id and owner_id = actor for update;
  if not found then raise exception 'trip unavailable' using errcode = '42501'; end if;
  if current_trip.version <> input_expected_version then
    raise exception 'stale trip version' using errcode = '40001';
  end if;
  if current_trip.status <> 'draft' then
    raise exception 'trip cannot be published' using errcode = '55000';
  end if;
  perform private.validate_trip_input(
    current_trip.origin_location_id, current_trip.destination_location_id,
    current_trip.departure_at, current_trip.arrival_at,
    current_trip.capacity_grams,
    array(select tc.category_code from public.trip_categories tc where tc.trip_id = current_trip.id)
  );
  if current_trip.departure_at <= now()
     or current_trip.departure_at > now() + interval '1 year' then
    raise exception 'departure outside publication window' using errcode = '22023';
  end if;
  next_version := current_trip.version + 1;
  update public.trips set
    status = 'published', version = next_version,
    published_at = now(), updated_at = now()
  where id = input_trip_id;
  insert into public.trip_events (
    trip_id, actor_id, actor_kind, event_type,
    from_status, to_status, trip_version
  ) values (
    input_trip_id, actor, 'member', 'published',
    'draft', 'published', next_version
  );
  return next_version;
end;
$$;
revoke all on function public.publish_trip(uuid,integer) from public, anon;
grant execute on function public.publish_trip(uuid,integer) to authenticated;

create function public.cancel_trip(
  input_trip_id uuid,
  input_expected_version integer,
  input_reason text
) returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_trip public.trips%rowtype;
declare next_version integer;
declare clean_reason text := btrim(input_reason);
begin
  select * into current_trip from public.trips
  where id = input_trip_id and owner_id = actor for update;
  if not found then raise exception 'trip unavailable' using errcode = '42501'; end if;
  if current_trip.version <> input_expected_version then
    raise exception 'stale trip version' using errcode = '40001';
  end if;
  if current_trip.status not in ('draft', 'published')
     or (current_trip.status = 'published' and current_trip.departure_at <= now()) then
    raise exception 'trip cannot be cancelled' using errcode = '55000';
  end if;
  if clean_reason is null or char_length(clean_reason) not between 3 and 500 then
    raise exception 'invalid cancellation reason' using errcode = '22023';
  end if;
  next_version := current_trip.version + 1;
  update public.trips set
    status = 'cancelled', version = next_version,
    cancelled_at = now(), updated_at = now()
  where id = input_trip_id;
  insert into public.trip_cancellations (trip_id, reason, cancelled_by)
  values (input_trip_id, clean_reason, actor);
  insert into public.trip_events (
    trip_id, actor_id, actor_kind, event_type,
    from_status, to_status, trip_version
  ) values (
    input_trip_id, actor, 'member', 'cancelled',
    current_trip.status, 'cancelled', next_version
  );
  return next_version;
end;
$$;
revoke all on function public.cancel_trip(uuid,integer,text) from public, anon;
grant execute on function public.cancel_trip(uuid,integer,text) to authenticated;

create function private.expire_due_trips(input_limit integer default 500)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer := 0;
declare expired_trip record;
begin
  if input_limit not between 1 and 5000 then
    raise exception 'invalid expiration batch size' using errcode = '22023';
  end if;
  for expired_trip in
    with due as (
      select t.id from public.trips t
      where t.status = 'published' and t.departure_at <= now()
      order by t.departure_at, t.id
      limit input_limit for update skip locked
    ), updated as (
      update public.trips t set
        status = 'expired', expired_at = now(),
        version = t.version + 1, updated_at = now()
      from due where t.id = due.id
      returning t.id, t.version
    ) select * from updated
  loop
    insert into public.trip_events (
      trip_id, actor_id, actor_kind, event_type,
      from_status, to_status, trip_version
    ) values (
      expired_trip.id, null, 'system', 'expired',
      'published', 'expired', expired_trip.version
    );
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;
revoke all on function private.expire_due_trips(integer) from public, anon, authenticated;

create function public.expire_own_departed_trips()
returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
declare changed integer := 0;
declare expired_trip record;
begin
  if actor is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  for expired_trip in
    with updated as (
      update public.trips t set
        status = 'expired', expired_at = now(),
        version = t.version + 1, updated_at = now()
      where t.owner_id = actor and t.status = 'published' and t.departure_at <= now()
      returning t.id, t.version
    ) select * from updated
  loop
    insert into public.trip_events (
      trip_id, actor_id, actor_kind, event_type,
      from_status, to_status, trip_version
    ) values (
      expired_trip.id, null, 'system', 'expired',
      'published', 'expired', expired_trip.version
    );
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;
revoke all on function public.expire_own_departed_trips() from public, anon;
grant execute on function public.expire_own_departed_trips() to authenticated;

create function public.get_public_trip(input_trip_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  origin_location_id uuid,
  destination_location_id uuid,
  departure_at timestamptz,
  arrival_at timestamptz,
  capacity_grams integer,
  status text,
  category_codes text[]
) language sql stable security definer set search_path = '' as $$
  select
    t.id,
    t.owner_id,
    t.origin_location_id,
    t.destination_location_id,
    t.departure_at,
    t.arrival_at,
    t.capacity_grams,
    t.status,
    array_agg(tc.category_code order by c.sort_order)
  from public.trips t
  join public.trip_categories tc on tc.trip_id = t.id
  join public.item_categories c on c.code = tc.category_code and c.active
  where t.id = input_trip_id
    and t.status = 'published'
    and t.departure_at > now()
  group by t.id;
$$;
revoke all on function public.get_public_trip(uuid) from public;
grant execute on function public.get_public_trip(uuid) to anon, authenticated;

comment on table public.trips is
  'Traveler trip aggregate. Mutations are available only through versioned lifecycle commands.';
comment on table public.trip_categories is
  'Normalized accepted-category membership for a trip; no comma-separated category storage.';
comment on function public.get_public_trip(uuid) is
  'Narrow public marketplace projection. Excludes versions, private cancellation data and audit records.';
comment on function private.expire_due_trips(integer) is
  'Bounded expiration worker entry point. Keep unexposed; invoke from a trusted scheduled worker when configured.';
