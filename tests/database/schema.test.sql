create extension if not exists pgtap with schema extensions;
select plan(21);
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
-- Check default-deny for both API roles, then test RLS independently of grants.
select ok(not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private') and c.relkind='r'
    and has_table_privilege('anon', c.oid, 'select,insert,update,delete')
), 'Anon has no premature grants');
grant select on public.profiles to authenticated, anon;
set local role authenticated;
select is((select count(*)::integer from public.profiles), 0, 'Authenticated cannot read fixture profiles even with SELECT grant');
reset role;
set local role anon;
select is((select count(*)::integer from public.profiles), 0, 'Anon cannot read fixture profiles even with SELECT grant');
reset role;
select ok(not exists (
  select 1 from pg_constraint c join pg_namespace n on n.oid=c.connamespace
  where c.contype='f' and n.nspname in ('public','private') and not exists (
    select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
      and i.indpred is null and i.indexprs is null and i.indkey[0]=c.conkey[1]
  )
), 'Every FK has a full index starting with its first lookup column');
insert into public.delivery_requests(id,sender_id,origin_city_id,destination_city_id,pickup_from,pickup_until,delivery_from,delivery_until,currency) values
('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','2030-01-01','2030-01-02','2030-01-01','2030-01-03','EUR');
insert into public.bookings(id,trip_id,request_id,sender_id,traveler_id,proposed_by,weight_grams,gross_minor,platform_fee_minor,traveler_net_minor,currency,fee_policy_version,terms_snapshot,expires_at) values
('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',500,1000,100,900,'EUR','fixture','{}','2030-01-01');
select lives_ok($$insert into private.capacity_reservations(booking_id,state,hold_until) values ('40000000-0000-0000-0000-000000000001','held','2030-01-01')$$, 'Matching reservation accepted');
select is((select sum(b.weight_grams) from private.capacity_reservations r join public.bookings b on b.id=r.booking_id where b.trip_id='20000000-0000-0000-0000-000000000001'), 500::bigint, 'Reservation derives agreed weight from booking without a second mutable value');
insert into private.payments(booking_id,provider_account_id,livemode,amount_minor,currency,state,idempotency_key) values
('40000000-0000-0000-0000-000000000001','acct_fixture',false,1000,'EUR','requires_confirmation','fixture');
select throws_ok($$insert into private.payments(booking_id,provider_account_id,livemode,amount_minor,currency,state,idempotency_key) values ('40000000-0000-0000-0000-000000000001','acct_fixture',false,1000,'EUR','created','fixture-second')$$, '23505', null, 'Outstanding collection blocks duplicate attempt');
select throws_ok($$insert into private.outbox_jobs(kind,resource_id,dedupe_key,state) values ('fixture','40000000-0000-0000-0000-000000000001','fixture','processing')$$, '23514', null, 'Processing job requires a fenced lease');
select throws_ok($$update private.payments set version=0$$, '23514', null, 'Payment version must be positive');
select throws_ok($$update public.bookings set expires_at=created_at$$, '23514', null, 'Proposal deadline must follow creation');
select lives_ok($$insert into public.cities(country_code,name,timezone) values ('FR','Paris','Europe/Paris')$$, 'City names are not globally unique within a country');
insert into private.payment_accounts(id,user_id,provider_account_id,livemode,country_code) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','acct_traveler_fixture',false,'FR');
select throws_ok($$insert into private.transfers(booking_id,payment_id,recipient_account_id,amount_minor,currency,state,idempotency_key) select booking_id,id,'50000000-0000-0000-0000-000000000001',900,'MAD','pending','transfer-fixture' from private.payments$$, '23503', null, 'Transfer cannot disagree with payment currency');
select lives_ok($$insert into private.transfers(booking_id,payment_id,recipient_account_id,amount_minor,currency,state,idempotency_key) select booking_id,id,'50000000-0000-0000-0000-000000000001',900,'EUR','pending','transfer-fixture' from private.payments$$, 'Matching transfer relationship accepted');
select * from finish();
