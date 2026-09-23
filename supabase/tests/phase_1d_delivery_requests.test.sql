begin;
select plan(59);

insert into auth.users (id,email,email_confirmed_at) values
  ('50000000-0000-4000-8000-000000000001','request-owner@example.invalid',now()),
  ('50000000-0000-4000-8000-000000000002','request-other@example.invalid',now()),
  ('50000000-0000-4000-8000-000000000003','request-restricted@example.invalid',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
insert into public.profiles (id,display_name,locale) values ('50000000-0000-4000-8000-000000000001','Request Owner','en');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
insert into public.profiles (id,display_name,locale) values ('50000000-0000-4000-8000-000000000002','Other Member','en');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
insert into public.profiles (id,display_name,locale) values ('50000000-0000-4000-8000-000000000003','Restricted Member','en');
reset role;
update public.profiles set account_status='restricted' where id='50000000-0000-4000-8000-000000000003';

create temporary table request_test_ids (name text primary key,id uuid not null);
grant select,insert on request_test_ids to authenticated,anon;

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select lives_ok($$
  insert into request_test_ids values ('main',public.create_delivery_request_draft(
    '20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',
    now()+interval '10 days',now()+interval '14 days','documents','Signed documents',
    'A sealed envelope containing signed contracts.','Two signed paper contracts',1250,
    255,180,25,1,false,null
  ))
$$,'Owner creates an atomic request and item draft');
select is((select count(*)::integer from public.declared_items),1,'Draft contains exactly one declared item');
select is((select count(*)::integer from public.delivery_requests),1,'Owner can read own draft');
select is((select status from public.delivery_requests where id=(select id from request_test_ids where name='main')),'draft','New request is draft');
select is((select version from public.delivery_requests where id=(select id from request_test_ids where name='main')),1,'New request starts at version one');
select is((select count(*)::integer from public.delivery_request_events where event_type='created'),1,'Create is audited');
select throws_ok($$insert into public.delivery_requests(owner_id,origin_location_id,destination_location_id,earliest_departure_at,latest_delivery_at) values ('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '1 day',now()+interval '2 days')$$,'42501',null,'Direct owner forgery is denied');
select throws_ok($$update public.delivery_requests set status='published'$$,'42501',null,'Direct status forgery is denied');
select throws_ok($$select public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',now()+interval '1 day',now()+interval '2 days','documents','Valid title','A sufficiently detailed description.','Paper documents inside',1000,null,null,null,1,false,null)$$,'22023','invalid request locations','Identical endpoints are rejected');
select throws_ok($$select public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '2 days',now()+interval '1 day','documents','Valid title','A sufficiently detailed description.','Paper documents inside',1000,null,null,null,1,false,null)$$,'22023','invalid delivery window','Reversed window is rejected');
select throws_ok($$select public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '1 day',now()+interval '2 days','documents','Valid title','A sufficiently detailed description.','Paper documents inside',0,null,null,null,1,false,null)$$,'22023','invalid item weight','Invalid weight is rejected');
select throws_ok($$select public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '1 day',now()+interval '2 days','documents','Valid title','A sufficiently detailed description.','Paper documents inside',1000,10,null,10,1,false,null)$$,'22023','invalid item dimensions','Partial dimensions are rejected');
select throws_ok($$select public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '1 day',now()+interval '2 days','invalid','Valid title','A sufficiently detailed description.','Paper documents inside',1000,null,null,null,1,false,null)$$,'22023','invalid item category','Invalid category is rejected');
select throws_ok($$select public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '1 day',now()+interval '2 days','documents','Valid title','short','tiny',1000,null,null,null,1,false,null)$$,'22023','invalid item declaration','Insufficient declaration is rejected');
select throws_ok($$select public.publish_delivery_request((select id from request_test_ids where name='main'),1,false)$$,'22023','sender declaration required','Publishing requires an explicit safety acknowledgement');
select throws_ok($$select public.publish_delivery_request((select id from request_test_ids where name='main'),99,true)$$,'40001','stale delivery request version','Stale publish is rejected');
select is(public.publish_delivery_request((select id from request_test_ids where name='main'),1,true),2,'Valid publish increments version');
select is((select status from public.delivery_requests where id=(select id from request_test_ids where name='main')),'published','Publish changes state');
select is((select count(*)::integer from public.delivery_request_events where event_type='published'),1,'Publish is audited');
reset role;
select is((select policy_version from public.policy_acknowledgements where delivery_request_id=(select id from request_test_ids where name='main')),'sender-safety-2026-09-v1','Server records the current sender policy version');
select is(has_table_privilege('authenticated','public.policy_acknowledgements','INSERT'),false,'Members cannot forge policy acknowledgements');

set local role anon;
select throws_ok($$select * from public.delivery_requests$$,'42501',null,'Anonymous base request access is denied');
select throws_ok($$select * from public.declared_items$$,'42501',null,'Anonymous item access is denied');
select throws_ok($$select * from public.item_photos$$,'42501',null,'Anonymous photo metadata access is denied');
select is((select count(*)::integer from public.get_public_delivery_request((select id from request_test_ids where name='main'))),1,'Anonymous public projection works');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.delivery_requests),0,'Other member cannot read draft or base request');
select is((select count(*)::integer from public.declared_items),0,'Other member cannot read private item');
select throws_ok($$select public.cancel_delivery_request((select id from request_test_ids where name='main'),2,'Malicious cancellation')$$,'42501','delivery request unavailable','Other member cannot cancel request');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.update_delivery_request((select id from request_test_ids where name='main'),1,'20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '11 days',now()+interval '15 days','documents','Signed documents','A sealed envelope containing signed contracts.','Two signed paper contracts',1300,255,180,25,1,false,null)$$,'40001','stale delivery request version','Stale update is rejected');
select is(public.update_delivery_request((select id from request_test_ids where name='main'),2,'20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '11 days',now()+interval '15 days','documents','Signed documents','A sealed envelope containing updated signed contracts.','Three signed paper contracts',1300,255,180,25,1,false,null),3,'Valid published edit succeeds');
select is((select count(*)::integer from public.delivery_request_events where event_type='published_edited'),1,'Published edit is audited');
select throws_ok($$select public.update_delivery_request((select id from request_test_ids where name='main'),3,'20000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000004',now()+interval '11 days',now()+interval '15 days','documents','Signed documents','A sealed envelope containing updated signed contracts.','Three signed paper contracts',1300,255,180,25,1,false,null)$$,'55000','published request route cannot be changed','Published route is immutable');
select throws_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='main'),3,'application/pdf',128)$$,'22023','invalid item photo','Unsafe photo MIME is rejected');
select throws_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='main'),3,'image/jpeg',5242881)$$,'22023','invalid item photo','Oversized photo is rejected');

create temporary table photo_test as select * from public.begin_item_photo_upload((select id from request_test_ids where name='main'),3,'image/jpeg',128);
grant select on photo_test to authenticated;
select is((select request_version from photo_test),4,'Photo reservation increments aggregate version');
select is(split_part((select storage_path from photo_test),'/',1),'50000000-0000-4000-8000-000000000001','Database generates owner-scoped photo path');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.item_photos),0,'Other member cannot read photo metadata');
select throws_ok($$select * from public.remove_item_photo((select photo_id from photo_test),4)$$,'42501','item photo unavailable','Other member cannot remove photo');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.finalize_item_photo_upload((select photo_id from photo_test),4)$$,'55000','item photo upload incomplete','Missing storage object cannot be finalized');
select is((select request_version from public.remove_item_photo((select photo_id from photo_test),4)),5,'Owner can discard pending photo with current version');
select is((select count(*)::integer from public.delivery_request_events where event_type='photo_removed'),1,'Photo removal is audited');
select is(public.cancel_delivery_request((select id from request_test_ids where name='main'),5,'No longer needed'),6,'Owner cancels eligible request');
reset role;

set local role anon;
select is((select count(*)::integer from public.get_public_delivery_request((select id from request_test_ids where name='main'))),0,'Cancelled request disappears from public projection');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000003',true);
select throws_ok($$select public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '1 day',now()+interval '2 days','documents','Valid title','A sufficiently detailed description.','Paper documents inside',1000,null,null,null,1,false,null)$$,'42501','active member required','Restricted member cannot create requests');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
insert into request_test_ids values ('past',public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()-interval '2 days',now()-interval '1 day','documents','Valid title','A sufficiently detailed description.','Paper documents inside',1000,null,null,null,1,false,null));
select throws_ok($$select public.publish_delivery_request((select id from request_test_ids where name='past'),1,true)$$,'22023','delivery window outside publication range','Past request cannot publish');
insert into request_test_ids values ('expiry',public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '2 days',now()+interval '3 days','documents','Valid title','A sufficiently detailed description.','Paper documents inside',1000,null,null,null,1,false,null));
select is(public.publish_delivery_request((select id from request_test_ids where name='expiry'),1,true),2,'Expiry fixture publishes');
reset role;
update public.delivery_requests set earliest_departure_at=now()-interval '2 days',latest_delivery_at=now()-interval '1 hour' where id=(select id from request_test_ids where name='expiry');
select is(private.expire_due_delivery_requests(10),1,'Trusted worker expires due request');
select is((select status from public.delivery_requests where id=(select id from request_test_ids where name='expiry')),'expired','Expired state persists');
select is((select count(*)::integer from public.delivery_request_events where delivery_request_id=(select id from request_test_ids where name='expiry') and event_type='expired'),1,'Expiration is audited');
select is(has_table_privilege('authenticated','public.delivery_requests','INSERT'),false,'Authenticated cannot insert base requests');
select is(has_table_privilege('authenticated','public.delivery_request_events','INSERT'),false,'Members cannot forge audit events');
select is((select public from storage.buckets where id='item-photos'),false,'Item photo bucket is private');
select is((select count(*)::integer from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'item_photos_storage_%'),4,'Storage uses explicit owner and booking-participant policies');

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
insert into request_test_ids values ('photo_limit',public.create_delivery_request_draft('20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000004',now()+interval '20 days',now()+interval '21 days','documents','Photo limit item','A sufficiently detailed description.','Paper documents inside',1000,null,null,null,1,false,null));
select lives_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='photo_limit'),1,'image/jpeg',128)$$,'First photo reservation succeeds');
select lives_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='photo_limit'),2,'image/jpeg',128)$$,'Second photo reservation succeeds');
select lives_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='photo_limit'),3,'image/jpeg',128)$$,'Third photo reservation succeeds');
select lives_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='photo_limit'),4,'image/jpeg',128)$$,'Fourth photo reservation succeeds');
select lives_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='photo_limit'),5,'image/jpeg',128)$$,'Fifth photo reservation succeeds');
select throws_ok($$select * from public.begin_item_photo_upload((select id from request_test_ids where name='photo_limit'),6,'image/jpeg',128)$$,'22023','item photo limit reached','Sixth photo reservation is rejected under the locked aggregate');
reset role;

select * from finish();
rollback;
