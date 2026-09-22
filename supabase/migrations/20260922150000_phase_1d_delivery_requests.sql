-- Phase 1D: sender delivery requests, declared items, private item photos,
-- explicit lifecycle commands, narrow discovery and optimistic concurrency.

create table public.delivery_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  origin_location_id uuid not null references public.locations(id) on delete restrict,
  destination_location_id uuid not null references public.locations(id) on delete restrict,
  earliest_departure_at timestamptz not null,
  latest_delivery_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled', 'expired')),
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (origin_location_id <> destination_location_id),
  check (latest_delivery_at > earliest_departure_at),
  check (latest_delivery_at <= earliest_departure_at + interval '90 days'),
  check ((status <> 'published') or published_at is not null),
  check ((status <> 'cancelled') or cancelled_at is not null),
  check ((status <> 'expired') or expired_at is not null)
);
create index delivery_requests_owner_updated_idx
  on public.delivery_requests (owner_id, updated_at desc);
create index delivery_requests_published_route_window_idx
  on public.delivery_requests (
    origin_location_id, destination_location_id,
    earliest_departure_at, latest_delivery_at
  ) where status = 'published';
create index delivery_requests_origin_location_idx
  on public.delivery_requests (origin_location_id);
create index delivery_requests_destination_location_idx
  on public.delivery_requests (destination_location_id);
alter table public.delivery_requests enable row level security;
revoke all on public.delivery_requests from anon, authenticated;
grant select (
  id, owner_id, origin_location_id, destination_location_id,
  earliest_departure_at, latest_delivery_at, status, version,
  published_at, cancelled_at, expired_at, created_at, updated_at
) on public.delivery_requests to authenticated;
create policy delivery_requests_read_own on public.delivery_requests
  for select to authenticated using (owner_id = (select auth.uid()));

create table public.declared_items (
  id uuid primary key default gen_random_uuid(),
  delivery_request_id uuid not null unique
    references public.delivery_requests(id) on delete restrict,
  category_code text not null references public.item_categories(code) on delete restrict,
  title text not null check (char_length(title) between 3 and 120 and title = btrim(title)),
  description text not null
    check (char_length(description) between 20 and 2000 and description = btrim(description)),
  declared_contents text not null
    check (char_length(declared_contents) between 10 and 1000 and declared_contents = btrim(declared_contents)),
  weight_grams integer not null check (weight_grams between 1 and 50000),
  length_mm integer check (length_mm between 1 and 2000),
  width_mm integer check (width_mm between 1 and 2000),
  height_mm integer check (height_mm between 1 and 2000),
  quantity smallint not null default 1 check (quantity between 1 and 100),
  fragile boolean not null default false,
  handling_notes text check (
    handling_notes is null or (
      char_length(handling_notes) between 3 and 1000 and handling_notes = btrim(handling_notes)
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (length_mm is null and width_mm is null and height_mm is null) or
    (length_mm is not null and width_mm is not null and height_mm is not null)
  )
);
create index declared_items_category_request_idx
  on public.declared_items (category_code, delivery_request_id);
alter table public.declared_items enable row level security;
revoke all on public.declared_items from anon, authenticated;
grant select (
  id, delivery_request_id, category_code, title, description,
  declared_contents, weight_grams, length_mm, width_mm, height_mm,
  quantity, fragile, handling_notes, created_at, updated_at
) on public.declared_items to authenticated;
create policy declared_items_read_own on public.declared_items
  for select to authenticated using (
    exists (
      select 1 from public.delivery_requests r
      where r.id = delivery_request_id and r.owner_id = (select auth.uid())
    )
  );

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.declared_items(id) on delete restrict,
  storage_path text not null unique check (
    storage_path = btrim(storage_path) and
    storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
  ),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  status text not null default 'pending' check (status in ('pending', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  deleted_at timestamptz,
  check ((status <> 'ready') or ready_at is not null),
  check ((status <> 'deleted') or deleted_at is not null)
);
create index item_photos_item_status_idx on public.item_photos (item_id, status, created_at);
alter table public.item_photos enable row level security;
revoke all on public.item_photos from anon, authenticated;
grant select (
  id, item_id, storage_path, mime_type, size_bytes, status,
  created_at, ready_at, deleted_at
) on public.item_photos to authenticated;
create policy item_photos_read_own on public.item_photos
  for select to authenticated using (
    exists (
      select 1 from public.declared_items i
      join public.delivery_requests r on r.id = i.delivery_request_id
      where i.id = item_id and r.owner_id = (select auth.uid())
    )
  );

create table public.delivery_request_cancellations (
  delivery_request_id uuid primary key
    references public.delivery_requests(id) on delete restrict,
  reason text not null check (
    char_length(reason) between 3 and 500 and reason = btrim(reason)
  ),
  cancelled_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index delivery_request_cancellations_cancelled_by_idx
  on public.delivery_request_cancellations (cancelled_by);
alter table public.delivery_request_cancellations enable row level security;
revoke all on public.delivery_request_cancellations from anon, authenticated;
grant select (delivery_request_id, reason, created_at)
  on public.delivery_request_cancellations to authenticated;
create policy delivery_request_cancellations_read_own
  on public.delivery_request_cancellations for select to authenticated using (
    exists (
      select 1 from public.delivery_requests r
      where r.id = delivery_request_id and r.owner_id = (select auth.uid())
    )
  );

create table public.delivery_request_events (
  id bigint generated always as identity primary key,
  delivery_request_id uuid not null
    references public.delivery_requests(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  actor_kind text not null check (actor_kind in ('member', 'system')),
  event_type text not null check (
    event_type in (
      'created', 'draft_edited', 'published', 'published_edited',
      'photo_added', 'photo_removed', 'cancelled', 'expired'
    )
  ),
  from_status text,
  to_status text not null,
  request_version integer not null check (request_version > 0),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);
create index delivery_request_events_request_created_idx
  on public.delivery_request_events (delivery_request_id, created_at);
create index delivery_request_events_actor_idx
  on public.delivery_request_events (actor_id) where actor_id is not null;
alter table public.delivery_request_events enable row level security;
revoke all on public.delivery_request_events from anon, authenticated;
grant select (
  id, delivery_request_id, actor_kind, event_type, from_status,
  to_status, request_version, metadata, created_at
) on public.delivery_request_events to authenticated;
create policy delivery_request_events_read_own
  on public.delivery_request_events for select to authenticated using (
    exists (
      select 1 from public.delivery_requests r
      where r.id = delivery_request_id and r.owner_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-photos', 'item-photos', false, 5242880,
  array['image/jpeg','image/png','image/webp']
);

create policy item_photos_storage_insert_pending
  on storage.objects for insert to authenticated with check (
    bucket_id = 'item-photos' and owner_id = (select auth.uid()::text) and
    exists (
      select 1 from public.item_photos p
      join public.declared_items i on i.id = p.item_id
      join public.delivery_requests r on r.id = i.delivery_request_id
      where p.storage_path = name and p.status = 'pending'
        and r.owner_id = (select auth.uid())
    )
  );
create policy item_photos_storage_select_ready
  on storage.objects for select to authenticated using (
    bucket_id = 'item-photos' and
    exists (
      select 1 from public.item_photos p
      join public.declared_items i on i.id = p.item_id
      join public.delivery_requests r on r.id = i.delivery_request_id
      where p.storage_path = name and p.status = 'ready'
        and r.owner_id = (select auth.uid())
    )
  );
create policy item_photos_storage_delete_owned
  on storage.objects for delete to authenticated using (
    bucket_id = 'item-photos' and
    exists (
      select 1 from public.item_photos p
      join public.declared_items i on i.id = p.item_id
      join public.delivery_requests r on r.id = i.delivery_request_id
      where p.storage_path = name and p.status in ('ready', 'deleted')
        and r.owner_id = (select auth.uid())
    )
  );

create function private.validate_delivery_request_input(
  input_origin uuid,
  input_destination uuid,
  input_earliest_departure timestamptz,
  input_latest_delivery timestamptz,
  input_category_code text,
  input_title text,
  input_description text,
  input_declared_contents text,
  input_weight_grams integer,
  input_length_mm integer,
  input_width_mm integer,
  input_height_mm integer,
  input_quantity integer,
  input_fragile boolean,
  input_handling_notes text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if input_origin is null or input_destination is null or input_origin = input_destination then
    raise exception 'invalid request locations' using errcode = '22023';
  end if;
  if (select count(*) from public.locations l where l.id in (input_origin, input_destination) and l.active) <> 2 then
    raise exception 'inactive or unknown request location' using errcode = '22023';
  end if;
  if input_earliest_departure is null or input_latest_delivery is null
     or input_latest_delivery <= input_earliest_departure
     or input_latest_delivery > input_earliest_departure + interval '90 days' then
    raise exception 'invalid delivery window' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.item_categories c
    where c.code = input_category_code and c.active
  ) then raise exception 'invalid item category' using errcode = '22023'; end if;
  if input_title is null or btrim(input_title) <> input_title or char_length(input_title) not between 3 and 120
     or input_description is null or btrim(input_description) <> input_description or char_length(input_description) not between 20 and 2000
     or input_declared_contents is null or btrim(input_declared_contents) <> input_declared_contents or char_length(input_declared_contents) not between 10 and 1000 then
    raise exception 'invalid item declaration' using errcode = '22023';
  end if;
  if input_weight_grams is null or input_weight_grams not between 1 and 50000 then
    raise exception 'invalid item weight' using errcode = '22023';
  end if;
  if not (
    (input_length_mm is null and input_width_mm is null and input_height_mm is null) or
    (input_length_mm is not null and input_width_mm is not null and input_height_mm is not null and
     input_length_mm between 1 and 2000 and input_width_mm between 1 and 2000 and input_height_mm between 1 and 2000)
  ) then raise exception 'invalid item dimensions' using errcode = '22023'; end if;
  if input_quantity is null or input_quantity not between 1 and 100 or input_fragile is null then
    raise exception 'invalid item quantity' using errcode = '22023';
  end if;
  if input_handling_notes is not null and (
    btrim(input_handling_notes) <> input_handling_notes or
    char_length(input_handling_notes) not between 3 and 1000
  ) then raise exception 'invalid handling notes' using errcode = '22023'; end if;
end;
$$;
revoke all on function private.validate_delivery_request_input(
  uuid,uuid,timestamptz,timestamptz,text,text,text,text,integer,
  integer,integer,integer,integer,boolean,text
) from public, anon, authenticated;

create function public.create_delivery_request_draft(
  input_origin uuid,
  input_destination uuid,
  input_earliest_departure timestamptz,
  input_latest_delivery timestamptz,
  input_category_code text,
  input_title text,
  input_description text,
  input_declared_contents text,
  input_weight_grams integer,
  input_length_mm integer,
  input_width_mm integer,
  input_height_mm integer,
  input_quantity integer,
  input_fragile boolean,
  input_handling_notes text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare new_request_id uuid;
begin
  perform private.validate_delivery_request_input(
    input_origin,input_destination,input_earliest_departure,input_latest_delivery,
    input_category_code,input_title,input_description,input_declared_contents,
    input_weight_grams,input_length_mm,input_width_mm,input_height_mm,
    input_quantity,input_fragile,input_handling_notes
  );
  insert into public.delivery_requests (
    owner_id,origin_location_id,destination_location_id,
    earliest_departure_at,latest_delivery_at
  ) values (
    actor,input_origin,input_destination,input_earliest_departure,input_latest_delivery
  ) returning id into new_request_id;
  insert into public.declared_items (
    delivery_request_id,category_code,title,description,declared_contents,
    weight_grams,length_mm,width_mm,height_mm,quantity,fragile,handling_notes
  ) values (
    new_request_id,input_category_code,input_title,input_description,input_declared_contents,
    input_weight_grams,input_length_mm,input_width_mm,input_height_mm,
    input_quantity,input_fragile,input_handling_notes
  );
  insert into public.delivery_request_events (
    delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,request_version
  ) values (new_request_id,actor,'member','created',null,'draft',1);
  return new_request_id;
end;
$$;
revoke all on function public.create_delivery_request_draft(
  uuid,uuid,timestamptz,timestamptz,text,text,text,text,integer,
  integer,integer,integer,integer,boolean,text
) from public, anon;
grant execute on function public.create_delivery_request_draft(
  uuid,uuid,timestamptz,timestamptz,text,text,text,text,integer,
  integer,integer,integer,integer,boolean,text
) to authenticated;

create function public.update_delivery_request(
  input_request_id uuid,
  input_expected_version integer,
  input_origin uuid,
  input_destination uuid,
  input_earliest_departure timestamptz,
  input_latest_delivery timestamptz,
  input_category_code text,
  input_title text,
  input_description text,
  input_declared_contents text,
  input_weight_grams integer,
  input_length_mm integer,
  input_width_mm integer,
  input_height_mm integer,
  input_quantity integer,
  input_fragile boolean,
  input_handling_notes text
) returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_request public.delivery_requests%rowtype;
declare next_version integer;
declare event_name text;
begin
  select * into current_request from public.delivery_requests
  where id = input_request_id and owner_id = actor for update;
  if not found then raise exception 'delivery request unavailable' using errcode = '42501'; end if;
  if current_request.version <> input_expected_version then
    raise exception 'stale delivery request version' using errcode = '40001';
  end if;
  if current_request.status not in ('draft','published')
     or (current_request.status = 'published' and current_request.latest_delivery_at <= now()) then
    raise exception 'delivery request cannot be edited' using errcode = '55000';
  end if;
  perform private.validate_delivery_request_input(
    input_origin,input_destination,input_earliest_departure,input_latest_delivery,
    input_category_code,input_title,input_description,input_declared_contents,
    input_weight_grams,input_length_mm,input_width_mm,input_height_mm,
    input_quantity,input_fragile,input_handling_notes
  );
  if current_request.status = 'published' and (
    input_origin <> current_request.origin_location_id or
    input_destination <> current_request.destination_location_id or
    input_latest_delivery <= now() or input_earliest_departure > now() + interval '1 year'
  ) then raise exception 'published request route cannot be changed' using errcode = '55000'; end if;
  next_version := current_request.version + 1;
  event_name := case when current_request.status = 'published' then 'published_edited' else 'draft_edited' end;
  update public.delivery_requests set
    origin_location_id=input_origin,destination_location_id=input_destination,
    earliest_departure_at=input_earliest_departure,latest_delivery_at=input_latest_delivery,
    version=next_version,updated_at=now()
  where id=input_request_id;
  update public.declared_items set
    category_code=input_category_code,title=input_title,description=input_description,
    declared_contents=input_declared_contents,weight_grams=input_weight_grams,
    length_mm=input_length_mm,width_mm=input_width_mm,height_mm=input_height_mm,
    quantity=input_quantity,fragile=input_fragile,handling_notes=input_handling_notes,
    updated_at=now()
  where delivery_request_id=input_request_id;
  insert into public.delivery_request_events (
    delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,request_version
  ) values (
    input_request_id,actor,'member',event_name,current_request.status,
    current_request.status,next_version
  );
  return next_version;
end;
$$;
revoke all on function public.update_delivery_request(
  uuid,integer,uuid,uuid,timestamptz,timestamptz,text,text,text,text,integer,
  integer,integer,integer,integer,boolean,text
) from public, anon;
grant execute on function public.update_delivery_request(
  uuid,integer,uuid,uuid,timestamptz,timestamptz,text,text,text,text,integer,
  integer,integer,integer,integer,boolean,text
) to authenticated;

create function public.publish_delivery_request(input_request_id uuid,input_expected_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_request public.delivery_requests%rowtype;
declare current_item public.declared_items%rowtype;
declare next_version integer;
begin
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
  update public.delivery_requests set
    status='published',version=next_version,published_at=now(),updated_at=now()
  where id=input_request_id;
  insert into public.delivery_request_events (
    delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,request_version
  ) values (input_request_id,actor,'member','published','draft','published',next_version);
  return next_version;
end;
$$;
revoke all on function public.publish_delivery_request(uuid,integer) from public, anon;
grant execute on function public.publish_delivery_request(uuid,integer) to authenticated;

create function public.cancel_delivery_request(
  input_request_id uuid,input_expected_version integer,input_reason text
) returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_request public.delivery_requests%rowtype;
declare next_version integer;
declare clean_reason text := btrim(input_reason);
begin
  select * into current_request from public.delivery_requests
  where id=input_request_id and owner_id=actor for update;
  if not found then raise exception 'delivery request unavailable' using errcode='42501'; end if;
  if current_request.version <> input_expected_version then
    raise exception 'stale delivery request version' using errcode='40001';
  end if;
  if current_request.status not in ('draft','published')
     or (current_request.status='published' and current_request.latest_delivery_at <= now()) then
    raise exception 'delivery request cannot be cancelled' using errcode='55000';
  end if;
  if clean_reason is null or char_length(clean_reason) not between 3 and 500 then
    raise exception 'invalid cancellation reason' using errcode='22023';
  end if;
  next_version := current_request.version + 1;
  update public.delivery_requests set
    status='cancelled',version=next_version,cancelled_at=now(),updated_at=now()
  where id=input_request_id;
  insert into public.delivery_request_cancellations (delivery_request_id,reason,cancelled_by)
  values (input_request_id,clean_reason,actor);
  insert into public.delivery_request_events (
    delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,request_version
  ) values (
    input_request_id,actor,'member','cancelled',current_request.status,'cancelled',next_version
  );
  return next_version;
end;
$$;
revoke all on function public.cancel_delivery_request(uuid,integer,text) from public, anon;
grant execute on function public.cancel_delivery_request(uuid,integer,text) to authenticated;

create function public.begin_item_photo_upload(
  input_request_id uuid,input_expected_version integer,
  input_mime_type text,input_size_bytes integer
) returns table(photo_id uuid,storage_path text,request_version integer)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_request public.delivery_requests%rowtype;
declare current_item_id uuid;
declare new_photo_id uuid := gen_random_uuid();
declare extension text;
begin
  select * into current_request from public.delivery_requests
  where id=input_request_id and owner_id=actor for update;
  if not found then raise exception 'delivery request unavailable' using errcode='42501'; end if;
  if current_request.version <> input_expected_version then
    raise exception 'stale delivery request version' using errcode='40001';
  end if;
  if current_request.status not in ('draft','published') or current_request.latest_delivery_at <= now() then
    raise exception 'delivery request photos cannot be changed' using errcode='55000';
  end if;
  extension := case input_mime_type
    when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else null end;
  if extension is null or input_size_bytes not between 1 and 5242880 then
    raise exception 'invalid item photo' using errcode='22023';
  end if;
  select id into strict current_item_id from public.declared_items
  where delivery_request_id=input_request_id;
  if (select count(*) from public.item_photos p
      where p.item_id=current_item_id and p.status in ('pending','ready')) >= 5 then
    raise exception 'item photo limit reached' using errcode='22023';
  end if;
  storage_path := actor::text || '/' || current_item_id::text || '/' || new_photo_id::text || '.' || extension;
  insert into public.item_photos (id,item_id,storage_path,mime_type,size_bytes)
  values (new_photo_id,current_item_id,storage_path,input_mime_type,input_size_bytes);
  request_version := current_request.version + 1;
  update public.delivery_requests set version=request_version,updated_at=now()
  where id=input_request_id;
  photo_id := new_photo_id;
  return next;
end;
$$;
revoke all on function public.begin_item_photo_upload(uuid,integer,text,integer) from public, anon;
grant execute on function public.begin_item_photo_upload(uuid,integer,text,integer) to authenticated;

create function public.finalize_item_photo_upload(
  input_photo_id uuid,input_expected_version integer
) returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_request public.delivery_requests%rowtype;
declare current_photo public.item_photos%rowtype;
declare next_version integer;
begin
  select r.* into current_request
  from public.delivery_requests r
  join public.declared_items i on i.delivery_request_id=r.id
  join public.item_photos p on p.item_id=i.id
  where p.id=input_photo_id and r.owner_id=actor for update of r;
  if not found then raise exception 'item photo unavailable' using errcode='42501'; end if;
  if current_request.version <> input_expected_version then
    raise exception 'stale delivery request version' using errcode='40001';
  end if;
  select * into current_photo from public.item_photos where id=input_photo_id for update;
  if current_photo.status <> 'pending' or not exists (
    select 1 from storage.objects o
    where o.bucket_id='item-photos' and o.name=current_photo.storage_path
      and o.owner_id=actor::text
      and o.metadata->>'mimetype'=current_photo.mime_type
      and (o.metadata->>'size')::bigint=current_photo.size_bytes
  ) then raise exception 'item photo upload incomplete' using errcode='55000'; end if;
  update public.item_photos set status='ready',ready_at=now() where id=input_photo_id;
  next_version := current_request.version + 1;
  update public.delivery_requests set version=next_version,updated_at=now()
  where id=current_request.id;
  insert into public.delivery_request_events (
    delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,
    request_version,metadata
  ) values (
    current_request.id,actor,'member','photo_added',current_request.status,
    current_request.status,next_version,jsonb_build_object('photo_id',input_photo_id)
  );
  return next_version;
end;
$$;
revoke all on function public.finalize_item_photo_upload(uuid,integer) from public, anon;
grant execute on function public.finalize_item_photo_upload(uuid,integer) to authenticated;

create function public.remove_item_photo(
  input_photo_id uuid,input_expected_version integer
) returns table(storage_path text,request_version integer)
language plpgsql security definer set search_path = '' as $$
declare actor uuid := private.current_active_member();
declare current_request public.delivery_requests%rowtype;
declare current_photo public.item_photos%rowtype;
begin
  select r.* into current_request
  from public.delivery_requests r
  join public.declared_items i on i.delivery_request_id=r.id
  join public.item_photos p on p.item_id=i.id
  where p.id=input_photo_id and r.owner_id=actor for update of r;
  if not found then raise exception 'item photo unavailable' using errcode='42501'; end if;
  if current_request.version <> input_expected_version then
    raise exception 'stale delivery request version' using errcode='40001';
  end if;
  select * into current_photo from public.item_photos where id=input_photo_id for update;
  if current_photo.status not in ('pending','ready') or current_request.status not in ('draft','published') then
    raise exception 'item photo cannot be removed' using errcode='55000';
  end if;
  update public.item_photos set status='deleted',deleted_at=now() where id=input_photo_id;
  request_version := current_request.version + 1;
  update public.delivery_requests set version=request_version,updated_at=now()
  where id=current_request.id;
  insert into public.delivery_request_events (
    delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,
    request_version,metadata
  ) values (
    current_request.id,actor,'member','photo_removed',current_request.status,
    current_request.status,request_version,jsonb_build_object('photo_id',input_photo_id)
  );
  storage_path := current_photo.storage_path;
  return next;
end;
$$;
revoke all on function public.remove_item_photo(uuid,integer) from public, anon;
grant execute on function public.remove_item_photo(uuid,integer) to authenticated;

create function private.expire_due_delivery_requests(input_limit integer default 500)
returns integer language plpgsql security definer set search_path = '' as $$
declare changed integer := 0;
declare expired_request record;
begin
  if input_limit not between 1 and 5000 then
    raise exception 'invalid expiration batch size' using errcode='22023';
  end if;
  for expired_request in
    with due as (
      select r.id from public.delivery_requests r
      where r.status='published' and r.latest_delivery_at <= now()
      order by r.latest_delivery_at,r.id limit input_limit for update skip locked
    ), updated as (
      update public.delivery_requests r set
        status='expired',expired_at=now(),version=r.version+1,updated_at=now()
      from due where r.id=due.id returning r.id,r.version
    ) select * from updated
  loop
    insert into public.delivery_request_events (
      delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,request_version
    ) values (expired_request.id,null,'system','expired','published','expired',expired_request.version);
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;
revoke all on function private.expire_due_delivery_requests(integer) from public,anon,authenticated;

create function public.expire_own_delivery_requests()
returns integer language plpgsql security definer set search_path = '' as $$
declare actor uuid := (select auth.uid());
declare changed integer := 0;
declare expired_request record;
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  for expired_request in
    with updated as (
      update public.delivery_requests r set
        status='expired',expired_at=now(),version=r.version+1,updated_at=now()
      where r.owner_id=actor and r.status='published' and r.latest_delivery_at <= now()
      returning r.id,r.version
    ) select * from updated
  loop
    insert into public.delivery_request_events (
      delivery_request_id,actor_id,actor_kind,event_type,from_status,to_status,request_version
    ) values (expired_request.id,null,'system','expired','published','expired',expired_request.version);
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;
revoke all on function public.expire_own_delivery_requests() from public,anon;
grant execute on function public.expire_own_delivery_requests() to authenticated;

create function public.get_public_delivery_request(input_request_id uuid)
returns table (
  id uuid,owner_id uuid,origin_location_id uuid,destination_location_id uuid,
  earliest_departure_at timestamptz,latest_delivery_at timestamptz,status text,
  category_code text,title text,weight_grams integer,length_mm integer,
  width_mm integer,height_mm integer,quantity smallint,fragile boolean
) language sql stable security definer set search_path = '' as $$
  select r.id,r.owner_id,r.origin_location_id,r.destination_location_id,
    r.earliest_departure_at,r.latest_delivery_at,r.status,
    i.category_code,i.title,i.weight_grams,i.length_mm,i.width_mm,i.height_mm,
    i.quantity,i.fragile
  from public.delivery_requests r
  join public.declared_items i on i.delivery_request_id=r.id
  join public.item_categories c on c.code=i.category_code and c.active
  where r.id=input_request_id and r.status='published' and r.latest_delivery_at > now();
$$;
revoke all on function public.get_public_delivery_request(uuid) from public;
grant execute on function public.get_public_delivery_request(uuid) to anon,authenticated;

comment on table public.delivery_requests is
  'Sender request aggregate. All mutations use versioned lifecycle commands.';
comment on table public.declared_items is
  'One declared shipment item per delivery request in V1; weights and dimensions are exact integers.';
comment on table public.item_photos is
  'Private item-photo metadata. Only ready owner photos can be signed/read; public discovery excludes photos.';
comment on function public.get_public_delivery_request(uuid) is
  'Narrow discovery projection excluding contents, descriptions, handling notes, photos, versions and audit data.';
comment on function private.expire_due_delivery_requests(integer) is
  'Bounded worker entry point; not exposed to application roles.';
