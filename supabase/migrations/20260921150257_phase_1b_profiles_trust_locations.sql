-- Phase 1B: private profile details, public cards, objective trust,
-- provider-neutral locations, identity attempts, and avatar storage.

alter table public.profiles
  add column first_name text,
  add column last_name text,
  add column phone_e164 text,
  add column phone_verified_at timestamptz,
  add column updated_at timestamptz not null default now(),
  add constraint profiles_first_name_check check (first_name is null or (char_length(first_name) between 1 and 80 and first_name = btrim(first_name))),
  add constraint profiles_last_name_check check (last_name is null or (char_length(last_name) between 1 and 80 and last_name = btrim(last_name))),
  add constraint profiles_phone_e164_check check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

create unique index profiles_verified_phone_e164_unique_idx on public.profiles (phone_e164)
  where phone_e164 is not null and phone_verified_at is not null;

create function private.prepare_profile_update() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.phone_e164 is distinct from old.phone_e164 then
    new.phone_verified_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.prepare_profile_update() from public, anon, authenticated;
create trigger profiles_prepare_update before update on public.profiles
for each row execute function private.prepare_profile_update();
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name, locale, first_name, last_name, phone_e164) on public.profiles to authenticated;
grant update (display_name, locale, first_name, last_name, phone_e164) on public.profiles to authenticated;

create table public.locations (
  id uuid primary key,
  kind text not null default 'city' check (kind in ('city','airport','train_station','port','neighborhood','pickup_point')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  country_name text not null check (char_length(country_name) between 2 and 100),
  administrative_region text check (administrative_region is null or char_length(administrative_region) <= 120),
  city_name text not null check (char_length(city_name) between 1 and 120),
  city_slug text not null check (city_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  canonical_name text not null check (char_length(canonical_name) between 2 and 180),
  latitude numeric(9,6) not null check (latitude between -90 and 90),
  longitude numeric(9,6) not null check (longitude between -180 and 180),
  timezone text not null check (timezone ~ '^[A-Za-z_]+(?:/[A-Za-z_+-]+)+$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (country_code, city_slug, kind)
);
alter table public.locations enable row level security;
revoke all on public.locations from anon, authenticated;
grant select on public.locations to anon, authenticated;
create policy locations_read_active on public.locations for select to anon, authenticated using (active);

insert into public.locations (id,country_code,country_name,administrative_region,city_name,city_slug,canonical_name,latitude,longitude,timezone) values
('20000000-0000-4000-8000-000000000001','FR','France','Île-de-France','Paris','paris','Paris, France',48.856600,2.352200,'Europe/Paris'),
('20000000-0000-4000-8000-000000000002','FR','France','Auvergne-Rhône-Alpes','Lyon','lyon','Lyon, France',45.764000,4.835700,'Europe/Paris'),
('20000000-0000-4000-8000-000000000003','FR','France','Provence-Alpes-Côte d''Azur','Marseille','marseille','Marseille, France',43.296500,5.369800,'Europe/Paris'),
('20000000-0000-4000-8000-000000000004','MA','Morocco','Casablanca-Settat','Casablanca','casablanca','Casablanca, Morocco',33.573100,-7.589800,'Africa/Casablanca'),
('20000000-0000-4000-8000-000000000005','MA','Morocco','Rabat-Salé-Kénitra','Rabat','rabat','Rabat, Morocco',34.020900,-6.841600,'Africa/Casablanca'),
('20000000-0000-4000-8000-000000000006','MA','Morocco','Marrakesh-Safi','Marrakesh','marrakesh','Marrakesh, Morocco',31.629500,-7.981100,'Africa/Casablanca'),
('20000000-0000-4000-8000-000000000007','MA','Morocco','Tanger-Tétouan-Al Hoceïma','Tangier','tangier','Tangier, Morocco',35.759500,-5.834000,'Africa/Casablanca');

create table private.location_provider_references (
  location_id uuid not null references public.locations(id) on delete cascade,
  provider text not null check (provider ~ '^[a-z][a-z0-9_-]{1,39}$'),
  provider_place_id text not null check (char_length(provider_place_id) between 1 and 255),
  created_at timestamptz not null default now(),
  primary key (provider, provider_place_id), unique (location_id, provider)
);
alter table private.location_provider_references enable row level security;
alter table private.location_provider_references force row level security;
revoke all on private.location_provider_references from public, anon, authenticated;

create table public.member_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80 and display_name = btrim(display_name)),
  avatar_path text check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  bio text check (bio is null or (char_length(bio) <= 500 and bio = btrim(bio))),
  residence_location_id uuid references public.locations(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.member_profiles enable row level security;
revoke all on public.member_profiles from anon, authenticated;
grant select on public.member_profiles to anon, authenticated;
grant insert (id,display_name,avatar_path,bio,residence_location_id) on public.member_profiles to authenticated;
grant update (display_name,avatar_path,bio,residence_location_id) on public.member_profiles to authenticated;
create policy member_profiles_public_read on public.member_profiles for select to anon, authenticated using (true);
create policy member_profiles_insert_self on public.member_profiles for insert to authenticated with check (id = (select auth.uid()));
create policy member_profiles_update_self on public.member_profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create index member_profiles_residence_idx on public.member_profiles (residence_location_id) where residence_location_id is not null;
insert into public.member_profiles (id,display_name,created_at,updated_at) select id,display_name,created_at,created_at from public.profiles on conflict do nothing;

create function private.touch_updated_at() returns trigger language plpgsql
set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
create trigger member_profiles_touch_updated_at before update on public.member_profiles
for each row execute function private.touch_updated_at();

create table public.profile_trust (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  identity_verified boolean not null default false,
  completed_deliveries integer not null default 0 check (completed_deliveries >= 0),
  completed_traveler_jobs integer not null default 0 check (completed_traveler_jobs >= 0),
  completed_sender_jobs integer not null default 0 check (completed_sender_jobs >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  rating_sum integer not null default 0 check (rating_sum >= 0),
  cancellation_count integer not null default 0 check (cancellation_count >= 0),
  dispute_count integer not null default 0 check (dispute_count >= 0),
  updated_at timestamptz not null default now(),
  check (review_count > 0 or rating_sum = 0), check (review_count = 0 or rating_sum <= review_count * 500)
);
alter table public.profile_trust enable row level security;
revoke all on public.profile_trust from anon, authenticated;
grant select on public.profile_trust to anon, authenticated;
create policy profile_trust_public_read on public.profile_trust for select to anon, authenticated using (true);
insert into public.profile_trust (profile_id) select id from public.profiles on conflict do nothing;

create function public.update_own_profile(
  new_display_name text, new_first_name text, new_last_name text,
  new_locale text, new_phone_e164 text, new_bio text,
  new_residence_location_id uuid
) returns void language plpgsql security invoker set search_path = '' as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  update public.profiles set
    display_name=new_display_name, first_name=new_first_name,
    last_name=new_last_name, locale=new_locale, phone_e164=new_phone_e164
  where id=actor;
  if not found then raise exception 'profile unavailable' using errcode='42501'; end if;
  update public.member_profiles set
    display_name=new_display_name, bio=new_bio,
    residence_location_id=new_residence_location_id
  where id=actor;
  if not found then raise exception 'public profile unavailable' using errcode='42501'; end if;
end;
$$;
revoke all on function public.update_own_profile(text,text,text,text,text,text,uuid) from public, anon;
grant execute on function public.update_own_profile(text,text,text,text,text,text,uuid) to authenticated;

create function private.initialize_profile_domain() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.member_profiles (id,display_name,created_at,updated_at)
  values (new.id,new.display_name,new.created_at,new.created_at) on conflict do nothing;
  insert into public.profile_trust (profile_id,email_verified)
  values (new.id, exists (select 1 from auth.users u where u.id=new.id and u.email_confirmed_at is not null))
  on conflict do nothing;
  return new;
end;
$$;
revoke all on function private.initialize_profile_domain() from public, anon, authenticated;
create trigger profiles_initialize_domain after insert on public.profiles
for each row execute function private.initialize_profile_domain();

create function public.sync_own_auth_trust() returns void language plpgsql security definer
set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'authentication required' using errcode='42501'; end if;
  update public.profile_trust t
  set email_verified = (u.email_confirmed_at is not null), updated_at = now()
  from auth.users u
  where t.profile_id = actor and u.id = actor;
end;
$$;
revoke all on function public.sync_own_auth_trust() from public, anon;
grant execute on function public.sync_own_auth_trust() to authenticated;

create table public.identity_verifications (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  provider text, provider_reference text,
  state text not null default 'pending' check (state in ('pending','requires_input','under_review','verified','rejected','cancelled','expired','revoked')),
  reason_code text check (reason_code is null or reason_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  submitted_at timestamptz, reviewed_at timestamptz, verified_at timestamptz, expires_at timestamptz, revoked_at timestamptz, cancelled_at timestamptz,
  version integer not null default 1 check (version > 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((provider is null) = (provider_reference is null)),
  check (state <> 'verified' or verified_at is not null), check (state <> 'cancelled' or cancelled_at is not null), check (state <> 'revoked' or revoked_at is not null)
);
create unique index identity_verifications_provider_reference_idx on public.identity_verifications (provider,provider_reference) where provider_reference is not null;
create index identity_verifications_user_created_idx on public.identity_verifications (user_id,created_at desc);
create unique index identity_verifications_one_active_idx on public.identity_verifications (user_id) where state in ('pending','requires_input','under_review','verified');
alter table public.identity_verifications enable row level security;
revoke all on public.identity_verifications from anon, authenticated;
grant select on public.identity_verifications to authenticated;
grant insert (id,user_id) on public.identity_verifications to authenticated;
grant update (state,cancelled_at,updated_at,version) on public.identity_verifications to authenticated;
create policy identity_verifications_read_self on public.identity_verifications for select to authenticated using (user_id = (select auth.uid()));
create policy identity_verifications_start_self on public.identity_verifications for insert to authenticated with check (user_id = (select auth.uid()) and state = 'pending' and provider is null and provider_reference is null);
create policy identity_verifications_cancel_self on public.identity_verifications for update to authenticated
  using (user_id = (select auth.uid()) and state in ('pending','requires_input'))
  with check (user_id = (select auth.uid()) and state = 'cancelled' and cancelled_at is not null and version > 1);

create function private.prepare_identity_verification_update() returns trigger language plpgsql
set search_path = '' as $$
begin
  if new.version <> old.version + 1 then
    raise exception 'stale identity verification version' using errcode='40001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.prepare_identity_verification_update() from public, anon, authenticated;
create trigger identity_verifications_prepare_update before update on public.identity_verifications
for each row execute function private.prepare_identity_verification_update();

create table public.identity_verification_events (
  id bigint generated always as identity primary key,
  verification_id uuid not null references public.identity_verifications(id) on delete cascade,
  from_state text, to_state text not null, actor_kind text not null check (actor_kind in ('member','provider','staff','system')),
  reason_code text, created_at timestamptz not null default now()
);
create index identity_verification_events_verification_idx on public.identity_verification_events (verification_id,created_at);
alter table public.identity_verification_events enable row level security;
revoke all on public.identity_verification_events from anon, authenticated;
grant select on public.identity_verification_events to authenticated;
create policy identity_verification_events_read_self on public.identity_verification_events for select to authenticated
  using (exists (select 1 from public.identity_verifications v where v.id = verification_id and v.user_id = (select auth.uid())));

create function private.audit_identity_verification() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.identity_verification_events (verification_id,from_state,to_state,actor_kind,reason_code)
  values (new.id,case when tg_op='UPDATE' then old.state else null end,new.state,
    case when (select auth.uid())=new.user_id then 'member' else 'system' end,new.reason_code);
  return new;
end;
$$;
revoke all on function private.audit_identity_verification() from public, anon, authenticated;
create trigger identity_verifications_audit after insert or update on public.identity_verifications
for each row execute function private.audit_identity_verification();

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy avatars_insert_own on storage.objects for insert to authenticated with check (
  bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid()::text) and owner_id=(select auth.uid()::text) and
  name ~ ('^' || (select auth.uid()::text) || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
);
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id='avatars' and owner_id=(select auth.uid()::text))
  with check (bucket_id='avatars' and (storage.foldername(name))[1]=(select auth.uid()::text) and owner_id=(select auth.uid()::text));
create policy avatars_delete_own on storage.objects for delete to authenticated using (bucket_id='avatars' and owner_id=(select auth.uid()::text));

comment on table public.member_profiles is 'Public profile card; member writes are limited to presentation columns and self-owned rows.';
comment on table public.profile_trust is 'System-controlled objective trust projection; average rating is rating_sum divided by review_count.';
comment on table public.locations is 'Provider-neutral canonical location catalog; members have read-only access.';
comment on table public.identity_verifications is 'KYC attempts; member direct writes only start and eligible cancellation. Provider/staff transitions require an internal command.';
