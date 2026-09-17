begin;
create extension if not exists pgtap with schema extensions;
select plan(2);
select ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  'Every public application table has RLS enabled'
);
select ok(
  not exists (
    select 1 from storage.buckets where public = true
  ),
  'No public storage buckets in the foundation'
);
select * from finish();
rollback;
