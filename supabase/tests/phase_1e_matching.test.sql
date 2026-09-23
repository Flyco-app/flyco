begin;
select no_plan();

insert into auth.users (id,email,email_confirmed_at) values
  ('60000000-0000-4000-8000-000000000001','match-traveler@example.invalid',now()),
  ('60000000-0000-4000-8000-000000000002','match-sender@example.invalid',now()),
  ('60000000-0000-4000-8000-000000000003','match-other@example.invalid',now()),
  ('60000000-0000-4000-8000-000000000004','match-restricted@example.invalid',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
insert into public.profiles (id,display_name,locale) values
  ('60000000-0000-4000-8000-000000000001','Match Traveler','en');
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
insert into public.profiles (id,display_name,locale) values
  ('60000000-0000-4000-8000-000000000002','Match Sender','en');
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
insert into public.profiles (id,display_name,locale) values
  ('60000000-0000-4000-8000-000000000003','Match Other','en');
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000004',true);
insert into public.profiles (id,display_name,locale) values
  ('60000000-0000-4000-8000-000000000004','Match Restricted','en');
reset role;

update public.profiles set account_status='restricted'
where id='60000000-0000-4000-8000-000000000004';

insert into public.trips (
  id,owner_id,origin_location_id,destination_location_id,
  departure_at,arrival_at,capacity_grams,status,published_at
) values
  ('61000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days',now()+interval '10 days 4 hours',1500,'published',now()),
  ('61000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days 1 hour',now()+interval '10 days 5 hours',2500,'published',now()),
  ('61000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000004',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days',now()+interval '10 days 4 hours',1500,'published',now()),
  ('61000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days',now()+interval '10 days 4 hours',1500,'published',now()),
  ('61000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()-interval '1 hour',now()+interval '3 hours',1500,'published',now()),
  ('61000000-0000-4000-8000-000000000006','60000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days',now()+interval '10 days 4 hours',1499,'published',now()),
  ('61000000-0000-4000-8000-000000000007','60000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005',
   now()+interval '10 days',now()+interval '10 days 4 hours',1500,'published',now()),
  ('61000000-0000-4000-8000-000000000008','60000000-0000-4000-8000-000000000003',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days',now()+interval '10 days 4 hours',1500,'published',now());

update public.trips set status='expired',expired_at=now()
where id='61000000-0000-4000-8000-000000000008';

insert into public.trip_categories (trip_id,category_code) values
  ('61000000-0000-4000-8000-000000000001','documents'),
  ('61000000-0000-4000-8000-000000000002','documents'),
  ('61000000-0000-4000-8000-000000000003','documents'),
  ('61000000-0000-4000-8000-000000000004','documents'),
  ('61000000-0000-4000-8000-000000000005','documents'),
  ('61000000-0000-4000-8000-000000000006','documents'),
  ('61000000-0000-4000-8000-000000000007','documents'),
  ('61000000-0000-4000-8000-000000000008','documents');

insert into public.delivery_requests (
  id,owner_id,origin_location_id,destination_location_id,
  earliest_departure_at,latest_delivery_at,status,published_at
) values
  ('62000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days',now()+interval '10 days 5 hours','published',now()),
  ('62000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004',
   now()+interval '9 days',now()+interval '11 days','published',now()),
  ('62000000-0000-4000-8000-000000000003','60000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '10 days 1 second',now()+interval '11 days','published',now()),
  ('62000000-0000-4000-8000-000000000004','60000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '9 days',now()+interval '10 days 3 hours 59 minutes 59 seconds','published',now()),
  ('62000000-0000-4000-8000-000000000005','60000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '9 days',now()+interval '11 days','published',now()),
  ('62000000-0000-4000-8000-000000000006','60000000-0000-4000-8000-000000000001',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '9 days',now()+interval '11 days','published',now()),
  ('62000000-0000-4000-8000-000000000007','60000000-0000-4000-8000-000000000004',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '9 days',now()+interval '11 days','published',now()),
  ('62000000-0000-4000-8000-000000000008','60000000-0000-4000-8000-000000000002',
   '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
   now()+interval '9 days',now()+interval '11 days','published',now());

update public.delivery_requests set status='expired',expired_at=now()
where id='62000000-0000-4000-8000-000000000008';

insert into public.declared_items (
  id,delivery_request_id,category_code,title,description,declared_contents,
  weight_grams,quantity,fragile
) values
  ('63000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','documents',
   'Boundary documents','A sealed envelope containing signed documents.','Two signed contracts',1500,1,false),
  ('63000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000002','documents',
   'Wrong route','A sealed envelope containing signed documents.','Two signed contracts',1000,1,false),
  ('63000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000003','documents',
   'Late pickup','A sealed envelope containing signed documents.','Two signed contracts',1000,1,false),
  ('63000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000004','documents',
   'Early arrival limit','A sealed envelope containing signed documents.','Two signed contracts',1000,1,false),
  ('63000000-0000-4000-8000-000000000005','62000000-0000-4000-8000-000000000005','electronics',
   'Category mismatch','A boxed personal electronic device.','One personal tablet',1000,1,false),
  ('63000000-0000-4000-8000-000000000006','62000000-0000-4000-8000-000000000006','documents',
   'Self match','A sealed envelope containing signed documents.','Two signed contracts',1000,1,false),
  ('63000000-0000-4000-8000-000000000007','62000000-0000-4000-8000-000000000007','documents',
   'Restricted sender','A sealed envelope containing signed documents.','Two signed contracts',1000,1,false),
  ('63000000-0000-4000-8000-000000000008','62000000-0000-4000-8000-000000000008','documents',
   'Expired request','A sealed envelope containing signed documents.','Two signed contracts',1000,1,false);

select is(
  (select count(*)::integer from private.current_matching_candidates(
    '61000000-0000-4000-8000-000000000001',null
  )), 1,
  'Only the exact eligible request matches the primary trip'
);
select is(
  (select date_slack_minutes from private.current_matching_candidates(
    '61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001'
  )), 60,
  'Exact earliest departure and capacity equality are inclusive'
);
select is(
  (select capacity_slack_grams from private.current_matching_candidates(
    '61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001'
  )), 0,
  'Exact capacity equality is eligible'
);
select is(
  (select count(*)::integer from private.current_matching_candidates(
    '61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001'
  )), 1,
  'Capacity greater than item weight remains eligible at latest delivery equality'
);
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002')),0,'Wrong origin is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000007','62000000-0000-4000-8000-000000000001')),0,'Wrong destination is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000003')),0,'Departure just before earliest pickup is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000004')),0,'Arrival just after latest delivery is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000005')),0,'Unaccepted category is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000006','62000000-0000-4000-8000-000000000001')),0,'Insufficient capacity is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000006')),0,'Self-match is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000003',null)),0,'Restricted traveler is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000007')),0,'Restricted sender is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000005',null)),0,'Departed trip is ineligible even before persisted expiry');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000008',null)),0,'Expired trip is ineligible');
select is((select count(*)::integer from private.current_matching_candidates('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000008')),0,'Expired request is ineligible');

select is(
  (select count(*)::integer from public.matches where active),
  (select count(*)::integer from private.current_matching_candidates()),
  'Triggers persist exactly the currently eligible match pairs'
);
select is((select algorithm_version from public.matches where trip_id='61000000-0000-4000-8000-000000000001' and active),'v1','Algorithm version is persisted');
select is((select reason_codes from public.matches where trip_id='61000000-0000-4000-8000-000000000001' and active),array['exact_route','date_window_fit','category_accepted','capacity_sufficient']::text[],'Reason codes are deterministic');
select is(private.recompute_matches_for_trip('61000000-0000-4000-8000-000000000001'),1,'Explicit recomputation finds the same eligible pair');
select is((select count(*)::integer from public.matches where trip_id='61000000-0000-4000-8000-000000000001'),1,'Recomputation does not duplicate a pair');

set local role anon;
select throws_ok($$select * from public.matches$$,'42501',null,'Anonymous base match access is denied');
select throws_ok($$select * from public.get_trip_matches('61000000-0000-4000-8000-000000000001',25,0)$$,'42501',null,'Anonymous match RPC access is denied');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000003',true);
select throws_ok($$select * from public.matches$$,'42501',null,'Members cannot read the base match table');
select throws_ok($$insert into public.matches(trip_id,delivery_request_id,algorithm_version,trip_version,request_version,date_slack_minutes,capacity_slack_grams,score,reason_codes) values ('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','v1',1,1,0,0,999999,array['exact_route','date_window_fit','category_accepted','capacity_sufficient'])$$,'42501',null,'Members cannot forge matches');
select throws_ok($$select * from public.get_trip_matches('61000000-0000-4000-8000-000000000001',25,0)$$,'42501','trip unavailable','Another member cannot read traveler match results');
select throws_ok($$select * from public.get_delivery_request_matches('62000000-0000-4000-8000-000000000001',25,0)$$,'42501','delivery request unavailable','Another member cannot read sender match results');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.get_trip_matches('61000000-0000-4000-8000-000000000001',25,0)),1,'Traveler sees one narrow compatible request');
select is((select algorithm_version from public.get_trip_matches('61000000-0000-4000-8000-000000000001',25,0)),'v1','Traveler projection returns algorithm version');
select throws_ok($$select * from public.get_trip_matches('61000000-0000-4000-8000-000000000001',51,0)$$,'22023','invalid match pagination','Pagination is bounded');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','60000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.get_delivery_request_matches('62000000-0000-4000-8000-000000000001',25,0)),2,'Sender sees both compatible trips');
select is((select trip_id from public.get_delivery_request_matches('62000000-0000-4000-8000-000000000001',1,0)),'61000000-0000-4000-8000-000000000001'::uuid,'Tighter date and capacity fit ranks first deterministically');
select is((select trip_id from public.get_delivery_request_matches('62000000-0000-4000-8000-000000000001',1,1)),'61000000-0000-4000-8000-000000000002'::uuid,'Stable pagination returns the deterministic second result');
select is((select score from public.get_delivery_request_matches('62000000-0000-4000-8000-000000000001',1,0)),999509940::bigint,'V1 score is reproducible from the documented date and capacity components');
reset role;

update public.declared_items set weight_grams=3000
where delivery_request_id='62000000-0000-4000-8000-000000000001';
select is((select active from public.matches where trip_id='61000000-0000-4000-8000-000000000001' and delivery_request_id='62000000-0000-4000-8000-000000000001'),false,'An incompatible item edit invalidates the match');
update public.declared_items set weight_grams=1500
where delivery_request_id='62000000-0000-4000-8000-000000000001';
select is((select count(*)::integer from public.matches where trip_id='61000000-0000-4000-8000-000000000001' and delivery_request_id='62000000-0000-4000-8000-000000000001' and active),1,'A compatible edit reactivates the same unique match');

update public.trips set status='cancelled',cancelled_at=now(),version=version+1
where id='61000000-0000-4000-8000-000000000001';
select is((select active from public.matches where trip_id='61000000-0000-4000-8000-000000000001'),false,'Trip cancellation immediately invalidates its match');

update public.delivery_requests set status='cancelled',cancelled_at=now(),version=version+1
where id='62000000-0000-4000-8000-000000000001';
select is((select active from public.matches where trip_id='61000000-0000-4000-8000-000000000002' and delivery_request_id='62000000-0000-4000-8000-000000000001'),false,'Request cancellation immediately invalidates its matches');

select is(has_table_privilege('authenticated','public.matches','SELECT'),false,'Authenticated has no base match-table read grant');
select is(has_table_privilege('authenticated','public.matches','INSERT'),false,'Authenticated has no base match-table write grant');
select is(has_function_privilege('anon','public.get_trip_matches(uuid,integer,integer)','EXECUTE'),false,'Anonymous cannot execute traveler match projection');
select is(has_function_privilege('authenticated','private.recompute_matches_for_trip(uuid)','EXECUTE'),false,'Members cannot call trusted recomputation directly');

select * from finish();
rollback;
