begin;
select no_plan();

insert into auth.users(id,email,email_confirmed_at) values
 ('70000000-0000-4000-8000-000000000001','booking-traveler@example.invalid',now()),
 ('70000000-0000-4000-8000-000000000002','booking-sender-a@example.invalid',now()),
 ('70000000-0000-4000-8000-000000000003','booking-sender-b@example.invalid',now()),
 ('70000000-0000-4000-8000-000000000004','booking-other@example.invalid',now());
insert into public.profiles(id,display_name,locale) values
 ('70000000-0000-4000-8000-000000000001','Booking Traveler','en'),
 ('70000000-0000-4000-8000-000000000002','Booking Sender A','en'),
 ('70000000-0000-4000-8000-000000000003','Booking Sender B','en'),
 ('70000000-0000-4000-8000-000000000004','Booking Other','en');

insert into public.trips(id,owner_id,origin_location_id,destination_location_id,departure_at,arrival_at,capacity_grams,status,published_at)
values('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
 now()+interval '10 days',now()+interval '10 days 4 hours',5000,'published',now());
insert into public.trip_categories(trip_id,category_code) values('71000000-0000-4000-8000-000000000001','documents');

insert into public.delivery_requests(id,owner_id,origin_location_id,destination_location_id,earliest_departure_at,latest_delivery_at,status,published_at)
values
 ('72000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '9 days',now()+interval '11 days','published',now()),
 ('72000000-0000-4000-8000-000000000002','70000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '9 days',now()+interval '11 days','published',now()),
 ('72000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '9 days',now()+interval '11 days','published',now());
insert into public.declared_items(id,delivery_request_id,category_code,title,description,declared_contents,weight_grams,quantity,fragile)
values
 ('73000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','documents','Sender A papers','Signed documents in an envelope.','Two signed contracts',3000,1,false),
 ('73000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000002','documents','Sender B papers','Signed documents in an envelope.','Two signed contracts',3000,1,false),
 ('73000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000003','documents','Expiring papers','Signed documents in an envelope.','One signed contract',1000,1,false);

update public.matches set id=case delivery_request_id
  when '72000000-0000-4000-8000-000000000001' then '73500000-0000-4000-8000-000000000001'::uuid
  when '72000000-0000-4000-8000-000000000002' then '73500000-0000-4000-8000-000000000002'::uuid
  else '73500000-0000-4000-8000-000000000003'::uuid end
where trip_id='71000000-0000-4000-8000-000000000001';
create temporary table booking_test_ids(label text primary key,id uuid not null);
grant select,insert on booking_test_ids to authenticated;

select is((select count(*)::integer from public.matches where active and trip_id='71000000-0000-4000-8000-000000000001'),3,'Three eligible opportunities exist before reservations');

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000002',true);
insert into booking_test_ids select 'a',booking_id from public.propose_booking(
 '73500000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001');
select is((select status from public.get_booking((select id from booking_test_ids where label='a'))),'proposed','Sender creates a proposal from a current match');
select is((select status from public.propose_booking(
 '73500000-0000-4000-8000-000000000001',
 '74000000-0000-4000-8000-000000000001')),'proposed','Proposal retry with the same key is idempotent');
select throws_ok($$update public.bookings set status='accepted'$$,'42501',null,'Member cannot forge booking status');
select throws_ok($$insert into public.capacity_reservations(booking_id,trip_id,capacity_grams) values ('75000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001',1)$$,'42501',null,'Member cannot forge a reservation');
reset role;
select is((select count(*)::integer from public.bookings where delivery_request_id='72000000-0000-4000-8000-000000000001'),1,'Retry does not duplicate the booking');

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000003',true);
insert into booking_test_ids select 'b',booking_id from public.propose_booking(
 '73500000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000002');
select is((select status from public.get_booking((select id from booking_test_ids where label='b'))),'proposed','Second sender creates a competing proposal');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000004',true);
select is((select count(*)::integer from public.get_my_bookings(25,0)),0,'Third party cannot list participant bookings');
select is((select count(*)::integer from public.get_booking((select id from booking_test_ids where label='a'))),0,'Third party cannot read a booking by ID');
select throws_ok($$select * from public.accept_booking((select id from booking_test_ids where label='a'),1,'74000000-0000-4000-8000-000000000003')$$,'42501','booking unavailable','Third party cannot accept');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
select throws_ok($$select * from public.accept_booking(
 (select id from booking_test_ids where label='a'),99,
 '74000000-0000-4000-8000-000000000010')$$,'40001','stale booking version','Stale acceptance is rejected before capacity changes');
reset role;
update public.profiles set account_status='restricted' where id='70000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
select throws_ok($$select * from public.accept_booking(
 (select id from booking_test_ids where label='a'),1,
 '74000000-0000-4000-8000-000000000011')$$,'42501','active account required','Restricted traveler cannot accept a booking');
reset role;
update public.profiles set account_status='active' where id='70000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
select is((select status from public.accept_booking(
 (select id from booking_test_ids where label='a'),1,
 '74000000-0000-4000-8000-000000000004')),'accepted','Traveler accepts the first proposal');
select is((select status from public.accept_booking(
 (select id from booking_test_ids where label='a'),1,
 '74000000-0000-4000-8000-000000000004')),'accepted','Repeated acceptance with the same key is safe');
select throws_ok($$select * from public.accept_booking(
 (select id from booking_test_ids where label='b'),1,
 '74000000-0000-4000-8000-000000000005')$$,'P0001','booking opportunity unavailable','Competing 3000g acceptance cannot oversubscribe remaining 2000g');
reset role;
select is(private.trip_reserved_capacity('71000000-0000-4000-8000-000000000001'),3000,'Acceptance reserves the declared item weight');
select is((select count(*)::integer from public.capacity_reservations where released_at is null),1,'Exactly one active reservation exists');
select is((select active from public.matches where delivery_request_id='72000000-0000-4000-8000-000000000002'),false,'Insufficient-capacity match is inactive after reservation');

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000002',true);
select is((select status from public.cancel_booking(
 (select id from booking_test_ids where label='a'),2,
 '74000000-0000-4000-8000-000000000006','Plans changed')),'cancelled','Either participant may cancel an accepted booking');
select is((select status from public.cancel_booking(
 (select id from booking_test_ids where label='a'),2,
 '74000000-0000-4000-8000-000000000007','Plans changed')),'cancelled','Repeated cancellation is a safe terminal no-op');

reset role;
select is(private.trip_reserved_capacity('71000000-0000-4000-8000-000000000001'),0,'Accepted cancellation releases capacity');
select is((select count(*)::integer from public.matches where delivery_request_id='72000000-0000-4000-8000-000000000002' and active),1,'Released capacity reactivates compatible matches');

set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000002',true);
insert into booking_test_ids select 'expiry',booking_id from public.propose_booking(
 '73500000-0000-4000-8000-000000000003','74000000-0000-4000-8000-000000000008');
select is((select status from public.get_booking((select id from booking_test_ids where label='expiry'))),'proposed','Sender creates proposal used for expiry test');
reset role;

update public.bookings set proposed_at=now()-interval '72 hours',expires_at=now()-interval '1 hour'
where delivery_request_id='72000000-0000-4000-8000-000000000003';
set local role authenticated;
select set_config('request.jwt.claim.sub','70000000-0000-4000-8000-000000000001',true);
select is((select status from public.accept_booking(
 (select id from booking_test_ids where label='expiry'),1,
 '74000000-0000-4000-8000-000000000009')),'expired','Expired proposal cannot be accepted');
reset role;
select is(private.trip_reserved_capacity('71000000-0000-4000-8000-000000000001'),0,'Expired proposal consumes no capacity');

select is((select count(*)::integer from public.booking_events where event_type='proposed'),3,'Proposal events are append-only and server-created');
select is((select count(*)::integer from public.booking_events where event_type='reservation_created'),1,'Reservation creation is audited');
select is((select count(*)::integer from public.booking_events where event_type='reservation_released'),1,'Reservation release is audited');
select is((select count(*)::integer from public.booking_events where event_type='expired'),1,'Expiration is audited');
select is(has_table_privilege('authenticated','public.bookings','SELECT'),false,'Authenticated cannot read booking base table');
select is(has_table_privilege('authenticated','public.capacity_reservations','INSERT'),false,'Authenticated cannot write reservation base table');
select is(has_table_privilege('authenticated','public.booking_events','INSERT'),false,'Authenticated cannot forge booking events');
select is(has_function_privilege('anon','public.propose_booking(uuid,uuid)','EXECUTE'),false,'Anonymous cannot propose bookings');
select is(has_function_privilege('anon','public.expire_booking(uuid,integer,uuid)','EXECUTE'),false,'Anonymous cannot expire bookings');
select is(has_function_privilege('authenticated','private.trip_reserved_capacity(uuid)','EXECUTE'),false,'Members cannot execute internal capacity helper');

select * from finish();
rollback;
