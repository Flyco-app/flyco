create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type private.auth_rate_limit_operation as enum ('signup','login','recovery','email_change','confirmation');
exception when duplicate_object then null; end $$;

create table private.auth_rate_limits (
  operation private.auth_rate_limit_operation not null,
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (operation, key_hash, window_started_at),
  check (expires_at > window_started_at)
);
alter table private.auth_rate_limits enable row level security;
alter table private.auth_rate_limits force row level security;
revoke all on private.auth_rate_limits from public, anon, authenticated;
create index auth_rate_limits_expiry_idx on private.auth_rate_limits (expires_at);

create function private.consume_auth_rate_limit(
  requested_operation private.auth_rate_limit_operation,
  requested_key_hash text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_window interval;
  maximum_attempts integer;
  bucket_start timestamptz;
  new_attempts integer;
begin
  delete from private.auth_rate_limits where ctid in (select ctid from private.auth_rate_limits where expires_at < clock_timestamp() limit 100);
  if requested_key_hash !~ '^[a-f0-9]{64}$' then
    return false;
  end if;
  select x.window_size, x.max_attempts into current_window, maximum_attempts
  from (values
    ('signup'::private.auth_rate_limit_operation, interval '15 minutes', 5),
    ('login'::private.auth_rate_limit_operation, interval '5 minutes', 10),
    ('recovery'::private.auth_rate_limit_operation, interval '15 minutes', 5),
    ('email_change'::private.auth_rate_limit_operation, interval '15 minutes', 3),
    ('confirmation'::private.auth_rate_limit_operation, interval '10 minutes', 10)
  ) as x(operation, window_size, max_attempts)
  where x.operation = requested_operation;
  if current_window is null then return false; end if;
  bucket_start := to_timestamp(floor(extract(epoch from clock_timestamp()) / extract(epoch from current_window)) * extract(epoch from current_window));
  insert into private.auth_rate_limits(operation,key_hash,window_started_at,attempts,expires_at)
  values(requested_operation,requested_key_hash,bucket_start,1,bucket_start + current_window * 2)
  on conflict (operation,key_hash,window_started_at)
  do update set attempts = private.auth_rate_limits.attempts + 1
  returning attempts into new_attempts;
  return new_attempts <= maximum_attempts;
end; $$;

revoke all on function private.consume_auth_rate_limit(private.auth_rate_limit_operation,text) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.consume_auth_rate_limit(private.auth_rate_limit_operation,text) to anon, authenticated;

create function public.consume_auth_rate_limit(operation text, key_hash text)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select case when operation in ('signup','login','recovery','email_change','confirmation')
    then private.consume_auth_rate_limit(operation::private.auth_rate_limit_operation, key_hash)
    else false end;
$$;
revoke all on function public.consume_auth_rate_limit(text,text) from public;
grant execute on function public.consume_auth_rate_limit(text,text) to anon, authenticated;
comment on function public.consume_auth_rate_limit(text,text) is 'Consumes one server-HMACed auth throttle bucket; invalid operation/hash fails.';
