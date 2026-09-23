create table public.policy_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  policy_type text not null check (policy_type in ('sender_declaration','traveler_safety')),
  policy_version text not null,
  delivery_request_id uuid references public.delivery_requests(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete restrict,
  resource_version integer not null check (resource_version > 0),
  acknowledged_at timestamptz not null default now(),
  check (
    (policy_type='sender_declaration' and delivery_request_id is not null and booking_id is null) or
    (policy_type='traveler_safety' and booking_id is not null and delivery_request_id is null)
  )
);
create unique index policy_ack_sender_once
  on public.policy_acknowledgements(user_id,policy_type,policy_version,delivery_request_id,resource_version)
  where delivery_request_id is not null;
create unique index policy_ack_traveler_once
  on public.policy_acknowledgements(user_id,policy_type,policy_version,booking_id,resource_version)
  where booking_id is not null;
create index policy_ack_request_idx on public.policy_acknowledgements(delivery_request_id) where delivery_request_id is not null;
create index policy_ack_booking_idx on public.policy_acknowledgements(booking_id) where booking_id is not null;
alter table public.policy_acknowledgements enable row level security;
revoke all on public.policy_acknowledgements from anon, authenticated;

drop function public.publish_delivery_request(uuid,integer);
create function public.publish_delivery_request(
  input_request_id uuid,input_expected_version integer,input_policy_acknowledged boolean
) returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_request public.delivery_requests%rowtype;
declare current_item public.declared_items%rowtype;
declare next_version integer;
begin
  if input_policy_acknowledged is distinct from true then
    raise exception 'sender declaration required' using errcode='22023';
  end if;
  select * into current_request from public.delivery_requests
  where id=input_request_id and owner_id=actor for update;
  if not found then raise exception 'delivery request unavailable' using errcode='42501'; end if;
  if current_request.version <> input_expected_version then
    raise exception 'stale delivery request version' using errcode='40001';
  end if;
  if current_request.status <> 'draft' then
    raise exception 'delivery request cannot be published' using errcode='55000';
  end if;
  select * into strict current_item from public.declared_items where delivery_request_id=input_request_id;
  perform private.validate_delivery_request_input(
    current_request.origin_location_id,current_request.destination_location_id,
    current_request.earliest_departure_at,current_request.latest_delivery_at,
    current_item.category_code,current_item.title,current_item.description,
    current_item.declared_contents,current_item.weight_grams,current_item.length_mm,
    current_item.width_mm,current_item.height_mm,current_item.quantity,
    current_item.fragile,current_item.handling_notes
  );
  if current_request.earliest_departure_at <= now()
     or current_request.latest_delivery_at <= now()
     or current_request.earliest_departure_at > now() + interval '1 year' then
    raise exception 'delivery window outside publication range' using errcode='22023';
  end if;
  next_version := current_request.version + 1;
  update public.delivery_requests set status='published',version=next_version,published_at=now(),updated_at=now()
  where id=input_request_id;
  insert into public.policy_acknowledgements(user_id,policy_type,policy_version,delivery_request_id,resource_version)
  values(actor,'sender_declaration','sender-safety-2026-09-v1',input_request_id,next_version);
  insert into public.delivery_request_events(delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,request_version)
  values(input_request_id,actor,'member','published','draft','published',next_version);
  return next_version;
end;
$$;
revoke all on function public.publish_delivery_request(uuid,integer,boolean) from public,anon;
grant execute on function public.publish_delivery_request(uuid,integer,boolean) to authenticated;

drop function public.accept_booking(uuid,integer,uuid);
create function public.accept_booking(
  input_booking_id uuid,input_expected_version integer,input_idempotency_key uuid,input_policy_acknowledged boolean
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
  if input_policy_acknowledged is distinct from true then
    raise exception using errcode='22023',message='traveler safety acknowledgement required';
  end if;
  select * into booking_row from public.bookings b where b.id=input_booking_id for update;
  if not found or booking_row.traveler_id<>actor then raise exception using errcode='42501',message='booking unavailable'; end if;
  if booking_row.status='accepted' then return query select booking_row.id,booking_row.status,booking_row.version; return; end if;
  if booking_row.status<>'proposed' then raise exception using errcode='P0001',message='invalid booking transition'; end if;
  if booking_row.version<>input_expected_version then raise exception using errcode='40001',message='stale booking version'; end if;
  if booking_row.expires_at<=now() then
    update public.bookings b set status='expired',expired_at=now(),updated_at=now(),version=b.version+1 where b.id=booking_row.id returning b.* into booking_row;
    insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status) values(booking_row.id,actor,'expired','proposed','expired');
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
  if trip_row.capacity_grams-reserved<booking_row.reserved_capacity_grams then raise exception using errcode='P0001',message='insufficient trip capacity'; end if;
  insert into public.capacity_reservations(booking_id,trip_id,capacity_grams) values(booking_row.id,trip_row.id,booking_row.reserved_capacity_grams);
  update public.bookings b set status='accepted',accepted_at=now(),updated_at=now(),version=b.version+1 where b.id=booking_row.id returning b.* into booking_row;
  insert into public.policy_acknowledgements(user_id,policy_type,policy_version,booking_id,resource_version)
  values(actor,'traveler_safety','traveler-safety-2026-09-v1',booking_row.id,booking_row.version);
  insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status) values(booking_row.id,actor,'accepted','proposed','accepted');
  insert into public.booking_events(booking_id,actor_id,event_type,metadata) values(booking_row.id,actor,'reservation_created',jsonb_build_object('capacity_grams',booking_row.reserved_capacity_grams));
  insert into public.booking_command_receipts(booking_id,actor_id,command_type,idempotency_key,resulting_status,resulting_version)
  values(booking_row.id,actor,'accept',input_idempotency_key,booking_row.status,booking_row.version);
  perform private.recompute_matches_for_trip(booking_row.trip_id);
  return query select booking_row.id,booking_row.status,booking_row.version;
end;
$$;
revoke all on function public.accept_booking(uuid,integer,uuid,boolean) from public,anon;
grant execute on function public.accept_booking(uuid,integer,uuid,boolean) to authenticated;

drop function public.get_booking(uuid);
create function public.get_booking(input_booking_id uuid)
returns table (
  booking_id uuid,match_id uuid,participant_role text,status text,version integer,reserved_capacity_grams integer,
  expires_at timestamptz,proposed_at timestamptz,accepted_at timestamptz,rejected_at timestamptz,
  cancelled_at timestamptz,expired_at timestamptz,trip_id uuid,delivery_request_id uuid,
  counterparty_id uuid,counterparty_display_name text,origin_name text,destination_name text,
  departure_at timestamptz,arrival_at timestamptz,item_title text,category_code text,
  offered_capacity_grams integer,reserved_trip_capacity_grams integer,available_capacity_grams integer,
  item_description text,declared_contents text,handling_notes text,fragile boolean,quantity integer
) language plpgsql volatile security definer set search_path = '' as $$
declare actor uuid := auth.uid();
declare expired_booking uuid;
begin
  if actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  update public.bookings b set status='expired',expired_at=now(),updated_at=now(),version=b.version+1
  where b.id=input_booking_id and b.status='proposed' and b.expires_at<=now() and actor in (b.sender_id,b.traveler_id)
  returning b.id into expired_booking;
  if expired_booking is not null then
    insert into public.booking_events(booking_id,actor_id,event_type,from_status,to_status) values(expired_booking,null,'expired','proposed','expired');
  end if;
  return query
  select b.id,b.match_id,case when b.sender_id=actor then 'sender' else 'traveler' end,b.status,b.version,b.reserved_capacity_grams,
    b.expires_at,b.proposed_at,b.accepted_at,b.rejected_at,b.cancelled_at,b.expired_at,b.trip_id,b.delivery_request_id,
    case when b.sender_id=actor then b.traveler_id else b.sender_id end,cp.display_name,
    ol.canonical_name,dl.canonical_name,t.departure_at,t.arrival_at,i.title,i.category_code,t.capacity_grams,
    private.trip_reserved_capacity(t.id),t.capacity_grams-private.trip_reserved_capacity(t.id),
    i.description,i.declared_contents,i.handling_notes,i.fragile,i.quantity::integer
  from public.bookings b
  join public.trips t on t.id=b.trip_id join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  join public.locations ol on ol.id=t.origin_location_id join public.locations dl on dl.id=t.destination_location_id
  join public.profiles cp on cp.id=case when b.sender_id=actor then b.traveler_id else b.sender_id end
  where b.id=input_booking_id and actor in (b.sender_id,b.traveler_id);
end;
$$;
revoke all on function public.get_booking(uuid) from public,anon;
grant execute on function public.get_booking(uuid) to authenticated;

create function public.get_booking_item_photos(input_booking_id uuid)
returns table(photo_id uuid,storage_path text,mime_type text)
language sql stable security definer set search_path = '' as $$
  select p.id,p.storage_path,p.mime_type
  from public.bookings b
  join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  join public.item_photos p on p.item_id=i.id and p.status='ready'
  where b.id=input_booking_id and auth.uid() in (b.sender_id,b.traveler_id)
  order by p.created_at,p.id
$$;
revoke all on function public.get_booking_item_photos(uuid) from public,anon;
grant execute on function public.get_booking_item_photos(uuid) to authenticated;

create function private.can_read_booking_item_photo(input_path text,input_actor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select input_actor is not null and exists (
    select 1 from public.item_photos p
    join public.declared_items i on i.id=p.item_id
    join public.bookings b on b.delivery_request_id=i.delivery_request_id
    where p.storage_path=input_path and p.status='ready' and input_actor in (b.sender_id,b.traveler_id)
  )
$$;
revoke all on function private.can_read_booking_item_photo(text,uuid) from public,anon;
grant execute on function private.can_read_booking_item_photo(text,uuid) to authenticated;

create policy item_photos_storage_select_booking_participant
  on storage.objects for select to authenticated using (
    bucket_id='item-photos' and (select private.can_read_booking_item_photo(name,auth.uid()))
  );
