create extension if not exists pgtap with schema extensions;
select plan(8);
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind='r'
    and (not c.relrowsecurity or not c.relforcerowsecurity)
), 'All reference tables enable and force RLS');
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind='r'
    and has_table_privilege('authenticated', c.oid, 'select,insert,update,delete')
), 'Authenticated role has no premature table grants');
select throws_ok($$insert into public.countries values ('fra','country.fr')$$, '23514', null, 'Country codes require two uppercase letters');
insert into public.countries values ('FR','country.fr'),('MA','country.ma');
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into public.profiles(id,display_name) values ('00000000-0000-0000-0000-000000000001','Sender fixture'),('00000000-0000-0000-0000-000000000002','Traveler fixture');
insert into public.cities(id,country_code,name,timezone) values
('10000000-0000-0000-0000-000000000001','FR','Paris','Europe/Paris'),
('10000000-0000-0000-0000-000000000002','MA','Casablanca','Africa/Casablanca');
insert into public.trips(id,traveler_id,origin_city_id,destination_city_id,departure_at,arrival_at,capacity_grams) values
('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','2030-01-01T10:00:00Z','2030-01-01T15:00:00Z',1000);
select throws_ok($$update public.trips set capacity_grams=0$$, '23514', null, 'Capacity must be positive');
select throws_ok($$update public.trips set arrival_at='2029-01-01T10:00:00Z'$$, '23514', null, 'Arrival cannot precede departure');
select throws_ok($$insert into public.user_blocks(blocker_id,blocked_id) values ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001')$$, '23514', null, 'No self blocks');
select throws_ok($$insert into public.reviews(booking_id,author_id,subject_id,rating) values ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',6)$$, '23514', null, 'Ratings bounded to five');
select throws_ok($$insert into public.reports(reporter_id,reason_code) values ('00000000-0000-0000-0000-000000000001','fixture')$$, '23514', null, 'Report must have exactly one target');
select * from finish();
