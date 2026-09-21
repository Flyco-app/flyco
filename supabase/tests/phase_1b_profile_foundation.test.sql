begin;
create extension if not exists pgtap with schema extensions;
select plan(35);
insert into auth.users(id,email,email_confirmed_at) values
 ('30000000-0000-4000-8000-000000000001','a@example.invalid',now()),
 ('30000000-0000-4000-8000-000000000002','b@example.invalid',now());

set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
insert into public.profiles(id,display_name,locale,first_name,phone_e164) values ('30000000-0000-4000-8000-000000000001','Alice','fr','Alice','+33612345678');
select is((select count(*)::integer from public.member_profiles where id='30000000-0000-4000-8000-000000000001'),1,'Public card initialized');
select is((select count(*)::integer from public.profile_trust where profile_id='30000000-0000-4000-8000-000000000001'),1,'Trust projection initialized');
select ok((select email_verified from public.profile_trust where profile_id='30000000-0000-4000-8000-000000000001'),'Email verification projected from Auth');
reset role;
update auth.users set email_confirmed_at=null where id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.sync_own_auth_trust()$$,'Member can refresh only their Auth-backed trust projection');
select ok(not (select email_verified from public.profile_trust where profile_id='30000000-0000-4000-8000-000000000001'),'Auth-backed email projection cannot remain client-forged');
select lives_ok($$select public.update_own_profile('Alice Public','Alice','Member','fr','+33612345678','Bio','20000000-0000-4000-8000-000000000001')$$,'Atomic own-profile update succeeds');
select is((select display_name from public.member_profiles where id='30000000-0000-4000-8000-000000000001'),'Alice Public','Public display name updated');
select is((select bio from public.member_profiles where id='30000000-0000-4000-8000-000000000001'),'Bio','Bio updated');
select throws_ok($$update public.profiles set phone_verified_at=now() where id='30000000-0000-4000-8000-000000000001'$$,'42501',null,'Member cannot forge phone verification');
select throws_ok($$update public.profiles set account_status='active' where id='30000000-0000-4000-8000-000000000001'$$,'42501',null,'Member cannot forge account status');
select throws_ok($$update public.profile_trust set identity_verified=true where profile_id='30000000-0000-4000-8000-000000000001'$$,'42501',null,'Member cannot forge trust');
select throws_ok($$insert into public.locations(id,country_code,country_name,city_name,city_slug,canonical_name,latitude,longitude,timezone) values(gen_random_uuid(),'FR','France','Evil','evil','Evil',0,0,'Europe/Paris')$$,'42501',null,'Member cannot inject location');
insert into public.identity_verifications(user_id) values ('30000000-0000-4000-8000-000000000001');
select is((select state from public.identity_verifications limit 1),'pending','Member starts pending verification');
select is((select count(*)::integer from public.identity_verification_events),1,'Start is audited');
select throws_ok($$update public.identity_verifications set state='verified',verified_at=now(),version=2$$,'42501',null,'Member cannot forge verified state');
update public.identity_verifications set state='cancelled',cancelled_at=now(),version=2;
select is((select state from public.identity_verifications limit 1),'cancelled','Member cancels eligible attempt');
select is((select count(*)::integer from public.identity_verification_events),2,'Cancellation is audited');
select lives_ok($$insert into storage.objects(bucket_id,name,owner_id) values ('avatars','30000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001.png','30000000-0000-4000-8000-000000000001')$$,'Own avatar path allowed');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values ('avatars','30000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002.png','30000000-0000-4000-8000-000000000001')$$,'42501',null,'Cross-user avatar path denied');
select throws_ok($$insert into storage.objects(bucket_id,name,owner_id) values ('avatars','../escape.exe','30000000-0000-4000-8000-000000000001')$$,'42501',null,'Unsafe avatar path denied');
select throws_ok($$update public.member_profiles set avatar_path='30000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002.png' where id='30000000-0000-4000-8000-000000000001'$$,'23514',null,'Profile cannot reference another member avatar path');
reset role;

insert into public.profiles(id,display_name,locale) values ('30000000-0000-4000-8000-000000000002','Bob','en');
update public.profiles set phone_verified_at=now() where id='30000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
update public.profiles set phone_e164='+33600000000' where id='30000000-0000-4000-8000-000000000001';
reset role;
select is((select phone_verified_at from public.profiles where id='30000000-0000-4000-8000-000000000001'),null,'Phone change invalidates verification');

set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
select is((select count(*)::integer from public.profiles),1,'Other member sees only own private profile');
select is((select count(*)::integer from public.member_profiles),2,'Other member sees public cards');
update public.member_profiles set display_name='Hijack' where id='30000000-0000-4000-8000-000000000001';
select is((select display_name from public.member_profiles where id='30000000-0000-4000-8000-000000000001'),'Alice Public','Cross-user public profile write changes no rows');
select is((select count(*)::integer from public.identity_verifications),0,'Other member cannot read verification attempts');
select throws_ok($$update public.member_profiles set id='30000000-0000-4000-8000-000000000001' where id='30000000-0000-4000-8000-000000000002'$$,'42501',null,'Ownership transfer denied');
reset role;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((select count(*)::integer from public.member_profiles),2,'Anonymous public cards readable');
select is((select count(*)::integer from public.profile_trust),2,'Anonymous objective trust readable');
select throws_ok($$select phone_e164 from public.profiles$$,'42501',null,'Anonymous private phone denied');
select throws_ok($$insert into storage.objects(bucket_id,name) values('avatars','x/y.png')$$,'42501',null,'Anonymous avatar write denied');
reset role;

select ok((select public from storage.buckets where id='avatars'),'Avatar bucket is intentionally public');
select is((select file_size_limit from storage.buckets where id='avatars'),2097152::bigint,'Avatar size capped at 2 MiB');
select ok(not has_table_privilege('authenticated','public.profile_trust','UPDATE'),'Trust table has no member writes');
select ok(not has_column_privilege('authenticated','public.identity_verifications','provider','UPDATE'),'Provider fields are internal');
select * from finish();
rollback;
