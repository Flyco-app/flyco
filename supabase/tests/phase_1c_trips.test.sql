begin;
create extension if not exists pgtap with schema extensions;
select plan(39);

insert into auth.users (id, email, email_confirmed_at) values
  ('40000000-0000-4000-8000-000000000001', 'trip-a@example.invalid', now()),
  ('40000000-0000-4000-8000-000000000002', 'trip-b@example.invalid', now()),
  ('40000000-0000-4000-8000-000000000003', 'trip-restricted@example.invalid', now()),
  ('40000000-0000-4000-8000-000000000004', 'trip-suspended@example.invalid', now());

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
insert into public.profiles (id, display_name, locale)
values ('40000000-0000-4000-8000-000000000001', 'Trip Owner', 'en');
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
insert into public.profiles (id, display_name, locale)
values ('40000000-0000-4000-8000-000000000002', 'Other Member', 'en');
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
insert into public.profiles (id, display_name, locale)
values ('40000000-0000-4000-8000-000000000003', 'Restricted Member', 'en');
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);
insert into public.profiles (id, display_name, locale)
values ('40000000-0000-4000-8000-000000000004', 'Suspended Member', 'en');
reset role;
update public.profiles set account_status = 'restricted'
where id = '40000000-0000-4000-8000-000000000003';
update public.profiles set account_status = 'suspended'
where id = '40000000-0000-4000-8000-000000000004';

create temporary table trip_test_ids (name text primary key, id uuid not null);
grant select, insert on trip_test_ids to authenticated, anon;

set local role anon;
select is((select count(*)::integer from public.item_categories), 5, 'Anonymous users can read active category reference data');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select lives_ok($$
  insert into trip_test_ids values (
    'main',
    public.create_trip_draft(
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000004',
      now() + interval '10 days', now() + interval '10 days 4 hours',
      5000, array['documents','clothing']
    )
  )
$$, 'Active member creates a draft through the command');
select is((select count(*)::integer from public.trips), 1, 'Owner can read own draft');
select is((select status from public.trips where id = (select id from trip_test_ids where name = 'main')), 'draft', 'Created trip is a draft');
select is((select version from public.trips where id = (select id from trip_test_ids where name = 'main')), 1, 'Created trip starts at version one');
select is((select count(*)::integer from public.trip_categories where trip_id = (select id from trip_test_ids where name = 'main')), 2, 'Categories are normalized rows');
select is((select count(*)::integer from public.trip_events where trip_id = (select id from trip_test_ids where name = 'main') and event_type = 'created'), 1, 'Create transition is audited');
select throws_ok($$
  insert into public.trips (
    owner_id, origin_location_id, destination_location_id,
    departure_at, arrival_at, capacity_grams
  ) values (
    '40000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '1 day', now() + interval '2 days', 1000
  )
$$, '42501', null, 'Member cannot forge an owner through direct insert');
select throws_ok($$
  update public.trips set status = 'published'
  where id = (select id from trip_test_ids where name = 'main')
$$, '42501', null, 'Member cannot forge trip status through direct update');
select throws_ok($$
  select public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    now() + interval '1 day', now() + interval '2 days',
    1000, array['documents']
  )
$$, '22023', 'invalid trip locations', 'Identical endpoints are rejected');
select throws_ok($$
  select public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '2 days', now() + interval '1 day',
    1000, array['documents']
  )
$$, '22023', 'invalid trip times', 'Arrival before departure is rejected');
select throws_ok($$
  select public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '1 day', now() + interval '2 days',
    0, array['documents']
  )
$$, '22023', 'invalid trip capacity', 'Invalid capacity is rejected');
select throws_ok($$
  select public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '1 day', now() + interval '2 days',
    1000, array['not_a_category']
  )
$$, '22023', 'invalid trip categories', 'Unknown category is rejected');
select throws_ok($$
  select public.publish_trip((select id from trip_test_ids where name = 'main'), 99)
$$, '40001', 'stale trip version', 'Stale publish is rejected');
select is(public.publish_trip((select id from trip_test_ids where name = 'main'), 1), 2, 'Valid publish increments version');
select is((select status from public.trips where id = (select id from trip_test_ids where name = 'main')), 'published', 'Publish changes state');
select is((select count(*)::integer from public.trip_events where trip_id = (select id from trip_test_ids where name = 'main') and event_type = 'published'), 1, 'Publish transition is audited');
reset role;

set local role anon;
select throws_ok($$select * from public.trips$$, '42501', null, 'Anonymous user cannot read the base trip aggregate');
select is((select count(*)::integer from public.get_public_trip((select id from trip_test_ids where name = 'main'))), 1, 'Anonymous user can read the narrow published projection');
select throws_ok($$select * from public.trip_cancellations$$, '42501', null, 'Anonymous user cannot read cancellation records');
select throws_ok($$select * from public.trip_events$$, '42501', null, 'Anonymous user cannot read audit events');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.get_public_trip((select id from trip_test_ids where name = 'main'))), 1, 'Another member sees only the published projection');
select throws_ok($$
  select public.cancel_trip((select id from trip_test_ids where name = 'main'), 2, 'Malicious cancellation')
$$, '42501', 'trip unavailable', 'Another member cannot cancel trip');
select throws_ok($$
  select public.update_trip(
    (select id from trip_test_ids where name = 'main'), 2,
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '11 days', now() + interval '11 days 4 hours',
    6000, array['documents']
  )
$$, '42501', 'trip unavailable', 'Another member cannot edit trip');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
select throws_ok($$
  select public.update_trip(
    (select id from trip_test_ids where name = 'main'), 1,
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '11 days', now() + interval '11 days 4 hours',
    6000, array['documents']
  )
$$, '40001', 'stale trip version', 'Stale edit is rejected');
select is(public.update_trip(
  (select id from trip_test_ids where name = 'main'), 2,
  '20000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000004',
  now() + interval '11 days', now() + interval '11 days 4 hours',
  6000, array['documents','electronics']
), 3, 'Valid expected version edit succeeds');
select is((select count(*)::integer from public.trip_events where trip_id = (select id from trip_test_ids where name = 'main') and event_type = 'published_edited'), 1, 'Published edit is audited');
select throws_ok($$
  select public.update_trip(
    (select id from trip_test_ids where name = 'main'), 3,
    '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '11 days', now() + interval '11 days 4 hours',
    6000, array['documents']
  )
$$, '55000', 'published route cannot be changed', 'Published route is immutable');
select is(public.cancel_trip((select id from trip_test_ids where name = 'main'), 3, 'Plans changed'), 4, 'Owner cancels eligible trip');
select is((select status from public.trips where id = (select id from trip_test_ids where name = 'main')), 'cancelled', 'Cancellation changes state');
select is((select reason from public.trip_cancellations where trip_id = (select id from trip_test_ids where name = 'main')), 'Plans changed', 'Owner can read cancellation reason');
reset role;

set local role anon;
select is((select count(*)::integer from public.get_public_trip((select id from trip_test_ids where name = 'main'))), 0, 'Cancelled trip is no longer public');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000003', true);
select throws_ok($$
  select public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '2 days', now() + interval '3 days',
    1000, array['documents']
  )
$$, '42501', 'active member required', 'Restricted member cannot create or publish trips');
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000004', true);
select throws_ok($$
  select public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '2 days', now() + interval '3 days',
    1000, array['documents']
  )
$$, '42501', 'active member required', 'Suspended member cannot create or publish trips');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', true);
insert into trip_test_ids values (
  'past',
  public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() - interval '2 days', now() - interval '1 day',
    1000, array['documents']
  )
);
select throws_ok($$
  select public.publish_trip((select id from trip_test_ids where name = 'past'), 1)
$$, '22023', 'departure outside publication window', 'Past departure cannot be published');
insert into trip_test_ids values (
  'expiry',
  public.create_trip_draft(
    '20000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000004',
    now() + interval '2 days', now() + interval '3 days',
    1000, array['documents']
  )
);
select is(public.publish_trip((select id from trip_test_ids where name = 'expiry'), 1), 2, 'Expiry fixture is published');
reset role;
update public.trips set departure_at = now() - interval '2 hours', arrival_at = now() + interval '2 hours'
where id = (select id from trip_test_ids where name = 'expiry');
select is(private.expire_due_trips(10), 1, 'Trusted bounded worker expires due trips');
select is((select status from public.trips where id = (select id from trip_test_ids where name = 'expiry')), 'expired', 'Expired state is persisted');
select is((select count(*)::integer from public.trip_events where trip_id = (select id from trip_test_ids where name = 'expiry') and event_type = 'expired'), 1, 'Expiration is audited');

select * from finish();
rollback;
