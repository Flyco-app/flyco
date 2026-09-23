-- Phase 1E: deterministic, explainable and idempotent match projections.
-- Matching is advisory only. It does not reserve capacity or create bookings.

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete restrict,
  delivery_request_id uuid not null references public.delivery_requests(id) on delete restrict,
  algorithm_version text not null check (algorithm_version ~ '^v[1-9][0-9]*$'),
  trip_version integer not null check (trip_version > 0),
  request_version integer not null check (request_version > 0),
  date_slack_minutes integer not null check (date_slack_minutes >= 0),
  capacity_slack_grams integer not null check (capacity_slack_grams >= 0),
  score bigint not null check (score >= 0),
  reason_codes text[] not null check (
    reason_codes = array[
      'exact_route',
      'date_window_fit',
      'category_accepted',
      'capacity_sufficient'
    ]::text[]
  ),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  recomputed_at timestamptz not null default now(),
  unique (trip_id, delivery_request_id, algorithm_version)
);

create index matches_trip_active_rank_idx
  on public.matches (trip_id, score desc, delivery_request_id)
  where active;
create index matches_request_active_rank_idx
  on public.matches (delivery_request_id, score desc, trip_id)
  where active;
create index matches_delivery_request_fk_idx
  on public.matches (delivery_request_id);

alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;

create function private.current_matching_candidates(
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
      (t.capacity_grams - i.weight_grams)::integer as capacity_slack_grams
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
      and t.capacity_grams >= i.weight_grams
      and (input_trip_id is null or t.id = input_trip_id)
      and (input_request_id is null or r.id = input_request_id)
  )
  select
    e.trip_id,
    e.delivery_request_id,
    e.trip_version,
    e.request_version,
    e.date_slack_minutes,
    e.capacity_slack_grams,
    (
      (100000 - least(e.date_slack_minutes, 100000))::bigint * 10001
      + (10000 - least(e.capacity_slack_grams / 100, 10000))::bigint
    ) as score,
    array[
      'exact_route',
      'date_window_fit',
      'category_accepted',
      'capacity_sufficient'
    ]::text[] as reason_codes
  from eligible e;
$$;
revoke all on function private.current_matching_candidates(uuid,uuid)
  from public, anon, authenticated;

create function private.recompute_matches_for_trip(input_trip_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.matches m
  set active = false, recomputed_at = now()
  where m.trip_id = input_trip_id
    and m.algorithm_version = 'v1'
    and m.active;

  insert into public.matches (
    trip_id, delivery_request_id, algorithm_version,
    trip_version, request_version,
    date_slack_minutes, capacity_slack_grams,
    score, reason_codes, active, recomputed_at
  )
  select
    c.trip_id, c.delivery_request_id, 'v1',
    c.trip_version, c.request_version,
    c.date_slack_minutes, c.capacity_slack_grams,
    c.score, c.reason_codes, true, now()
  from private.current_matching_candidates(input_trip_id, null) c
  join public.delivery_requests ranked_request
    on ranked_request.id = c.delivery_request_id
  order by c.score desc, ranked_request.earliest_departure_at, c.delivery_request_id
  limit 500
  on conflict (trip_id, delivery_request_id, algorithm_version)
  do update set
    trip_version = excluded.trip_version,
    request_version = excluded.request_version,
    date_slack_minutes = excluded.date_slack_minutes,
    capacity_slack_grams = excluded.capacity_slack_grams,
    score = excluded.score,
    reason_codes = excluded.reason_codes,
    active = true,
    recomputed_at = now();

  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function private.recompute_matches_for_trip(uuid)
  from public, anon, authenticated;

create function private.recompute_matches_for_request(input_request_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer;
begin
  update public.matches m
  set active = false, recomputed_at = now()
  where m.delivery_request_id = input_request_id
    and m.algorithm_version = 'v1'
    and m.active;

  insert into public.matches (
    trip_id, delivery_request_id, algorithm_version,
    trip_version, request_version,
    date_slack_minutes, capacity_slack_grams,
    score, reason_codes, active, recomputed_at
  )
  select
    c.trip_id, c.delivery_request_id, 'v1',
    c.trip_version, c.request_version,
    c.date_slack_minutes, c.capacity_slack_grams,
    c.score, c.reason_codes, true, now()
  from private.current_matching_candidates(null, input_request_id) c
  join public.trips ranked_trip on ranked_trip.id = c.trip_id
  order by c.score desc, ranked_trip.departure_at, c.trip_id
  limit 500
  on conflict (trip_id, delivery_request_id, algorithm_version)
  do update set
    trip_version = excluded.trip_version,
    request_version = excluded.request_version,
    date_slack_minutes = excluded.date_slack_minutes,
    capacity_slack_grams = excluded.capacity_slack_grams,
    score = excluded.score,
    reason_codes = excluded.reason_codes,
    active = true,
    recomputed_at = now();

  get diagnostics changed = row_count;
  return changed;
end;
$$;
revoke all on function private.recompute_matches_for_request(uuid)
  from public, anon, authenticated;

create function private.refresh_match_projection()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_trip_id uuid;
declare target_request_id uuid;
begin
  if tg_table_name = 'trips' then
    target_trip_id := coalesce(new.id, old.id);
    perform private.recompute_matches_for_trip(target_trip_id);
  elsif tg_table_name = 'trip_categories' then
    target_trip_id := coalesce(new.trip_id, old.trip_id);
    perform private.recompute_matches_for_trip(target_trip_id);
  elsif tg_table_name = 'delivery_requests' then
    target_request_id := coalesce(new.id, old.id);
    perform private.recompute_matches_for_request(target_request_id);
  elsif tg_table_name = 'declared_items' then
    target_request_id := coalesce(new.delivery_request_id, old.delivery_request_id);
    perform private.recompute_matches_for_request(target_request_id);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function private.refresh_match_projection()
  from public, anon, authenticated;

create trigger refresh_matches_after_trip_change
after insert or update of status, origin_location_id, destination_location_id,
  departure_at, arrival_at, capacity_grams, version on public.trips
for each row execute function private.refresh_match_projection();

create trigger refresh_matches_after_trip_category_change
after insert or delete on public.trip_categories
for each row execute function private.refresh_match_projection();

create trigger refresh_matches_after_request_change
after insert or update of status, origin_location_id, destination_location_id,
  earliest_departure_at, latest_delivery_at, version on public.delivery_requests
for each row execute function private.refresh_match_projection();

create trigger refresh_matches_after_item_change
after insert or update of category_code, weight_grams on public.declared_items
for each row execute function private.refresh_match_projection();

create trigger refresh_matches_after_item_delete
after delete on public.declared_items
for each row execute function private.refresh_match_projection();

create function private.refresh_matches_after_account_status()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owned record;
begin
  if old.account_status is distinct from new.account_status then
    for owned in select t.id from public.trips t where t.owner_id = new.id loop
      perform private.recompute_matches_for_trip(owned.id);
    end loop;
    for owned in select r.id from public.delivery_requests r where r.owner_id = new.id loop
      perform private.recompute_matches_for_request(owned.id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.refresh_matches_after_account_status()
  from public, anon, authenticated;

create trigger refresh_matches_after_account_status
after update of account_status on public.profiles
for each row execute function private.refresh_matches_after_account_status();

create function public.get_trip_matches(
  input_trip_id uuid,
  input_limit integer default 25,
  input_offset integer default 0
) returns table (
  match_id uuid,
  delivery_request_id uuid,
  sender_id uuid,
  origin_location_id uuid,
  origin_name text,
  origin_timezone text,
  destination_location_id uuid,
  destination_name text,
  destination_timezone text,
  earliest_departure_at timestamptz,
  latest_delivery_at timestamptz,
  category_code text,
  item_title text,
  weight_grams integer,
  trip_capacity_grams integer,
  date_slack_minutes integer,
  capacity_slack_grams integer,
  score bigint,
  reason_codes text[],
  algorithm_version text,
  sender_display_name text,
  sender_email_verified boolean,
  sender_phone_verified boolean,
  sender_identity_verified boolean,
  sender_completed_jobs integer,
  sender_review_count integer,
  sender_rating_sum integer
) language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
begin
  if input_limit not between 1 and 50 or input_offset not between 0 and 10000 then
    raise exception 'invalid match pagination' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.trips t where t.id = input_trip_id and t.owner_id = actor
  ) then
    raise exception 'trip unavailable' using errcode = '42501';
  end if;

  perform private.recompute_matches_for_trip(input_trip_id);

  return query
  select
    m.id,
    r.id,
    r.owner_id,
    r.origin_location_id,
    origin.canonical_name,
    origin.timezone,
    r.destination_location_id,
    destination.canonical_name,
    destination.timezone,
    r.earliest_departure_at,
    r.latest_delivery_at,
    i.category_code,
    i.title,
    i.weight_grams,
    t.capacity_grams,
    m.date_slack_minutes,
    m.capacity_slack_grams,
    m.score,
    m.reason_codes,
    m.algorithm_version,
    mp.display_name,
    trust.email_verified,
    trust.phone_verified,
    trust.identity_verified,
    trust.completed_sender_jobs,
    trust.review_count,
    trust.rating_sum
  from public.matches m
  join public.trips t on t.id = m.trip_id
  join public.delivery_requests r on r.id = m.delivery_request_id
  join public.declared_items i on i.delivery_request_id = r.id
  join public.locations origin on origin.id = r.origin_location_id
  join public.locations destination on destination.id = r.destination_location_id
  join public.member_profiles mp on mp.id = r.owner_id
  join public.profile_trust trust on trust.profile_id = r.owner_id
  where m.trip_id = input_trip_id
    and m.algorithm_version = 'v1'
    and m.active
    and t.status = 'published' and t.departure_at > now()
    and r.status = 'published' and r.latest_delivery_at > now()
  order by m.score desc, r.earliest_departure_at, r.id
  limit input_limit offset input_offset;
end;
$$;
revoke all on function public.get_trip_matches(uuid,integer,integer) from public, anon;
grant execute on function public.get_trip_matches(uuid,integer,integer) to authenticated;

create function public.get_delivery_request_matches(
  input_request_id uuid,
  input_limit integer default 25,
  input_offset integer default 0
) returns table (
  match_id uuid,
  trip_id uuid,
  traveler_id uuid,
  origin_location_id uuid,
  origin_name text,
  origin_timezone text,
  destination_location_id uuid,
  destination_name text,
  destination_timezone text,
  departure_at timestamptz,
  arrival_at timestamptz,
  category_codes text[],
  trip_capacity_grams integer,
  item_weight_grams integer,
  date_slack_minutes integer,
  capacity_slack_grams integer,
  score bigint,
  reason_codes text[],
  algorithm_version text,
  traveler_display_name text,
  traveler_email_verified boolean,
  traveler_phone_verified boolean,
  traveler_identity_verified boolean,
  traveler_completed_jobs integer,
  traveler_review_count integer,
  traveler_rating_sum integer
) language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
begin
  if input_limit not between 1 and 50 or input_offset not between 0 and 10000 then
    raise exception 'invalid match pagination' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.delivery_requests r
    where r.id = input_request_id and r.owner_id = actor
  ) then
    raise exception 'delivery request unavailable' using errcode = '42501';
  end if;

  perform private.recompute_matches_for_request(input_request_id);

  return query
  select
    m.id,
    t.id,
    t.owner_id,
    t.origin_location_id,
    origin.canonical_name,
    origin.timezone,
    t.destination_location_id,
    destination.canonical_name,
    destination.timezone,
    t.departure_at,
    t.arrival_at,
    array_agg(tc.category_code order by c.sort_order),
    t.capacity_grams,
    i.weight_grams,
    m.date_slack_minutes,
    m.capacity_slack_grams,
    m.score,
    m.reason_codes,
    m.algorithm_version,
    mp.display_name,
    trust.email_verified,
    trust.phone_verified,
    trust.identity_verified,
    trust.completed_traveler_jobs,
    trust.review_count,
    trust.rating_sum
  from public.matches m
  join public.trips t on t.id = m.trip_id
  join public.delivery_requests r on r.id = m.delivery_request_id
  join public.declared_items i on i.delivery_request_id = r.id
  join public.trip_categories tc on tc.trip_id = t.id
  join public.item_categories c on c.code = tc.category_code and c.active
  join public.locations origin on origin.id = t.origin_location_id
  join public.locations destination on destination.id = t.destination_location_id
  join public.member_profiles mp on mp.id = t.owner_id
  join public.profile_trust trust on trust.profile_id = t.owner_id
  where m.delivery_request_id = input_request_id
    and m.algorithm_version = 'v1'
    and m.active
    and t.status = 'published' and t.departure_at > now()
    and r.status = 'published' and r.latest_delivery_at > now()
  group by
    m.id, t.id, r.id, i.id, origin.id, destination.id, mp.id, trust.profile_id
  order by m.score desc, t.departure_at, t.id
  limit input_limit offset input_offset;
end;
$$;
revoke all on function public.get_delivery_request_matches(uuid,integer,integer)
  from public, anon;
grant execute on function public.get_delivery_request_matches(uuid,integer,integer)
  to authenticated;

comment on table public.matches is
  'Versioned advisory compatibility projection. No capacity is reserved and no booking is created.';
comment on function public.get_trip_matches(uuid,integer,integer) is
  'Owner-only, narrow member projection of compatible published delivery requests.';
comment on function public.get_delivery_request_matches(uuid,integer,integer) is
  'Owner-only, narrow member projection of compatible published trips.';
