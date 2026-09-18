-- Phase 1A: only the self-owned public profile. Auth owns credentials and email.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80 and display_name = btrim(display_name)),
  locale text not null default 'fr' check (locale in ('fr', 'en', 'ar')),
  account_status text not null default 'active' check (account_status in ('active', 'restricted', 'suspended', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, display_name, locale) on public.profiles to authenticated;
grant update (display_name, locale) on public.profiles to authenticated;

create policy profiles_select_self on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and account_status = 'active');
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) and account_status = 'active')
  with check (id = (select auth.uid()) and account_status = 'active');

create index profiles_account_status_idx on public.profiles (account_status)
  where account_status <> 'active';
comment on table public.profiles is 'Phase 1A: self-owned profile; account_status is controlled outside member SQL grants.';
