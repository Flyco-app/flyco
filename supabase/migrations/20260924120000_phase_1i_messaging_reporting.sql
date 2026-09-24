-- Phase 1I: booking-scoped private messaging and safety-report intake.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  traveler_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  check (sender_id <> traveler_id),
  unique (id, booking_id),
  unique (id, sender_id),
  unique (id, traveler_id)
);

create index conversations_sender_activity_idx on public.conversations(sender_id,coalesce(last_message_at,created_at) desc,id);
create index conversations_traveler_activity_idx on public.conversations(traveler_id,coalesce(last_message_at,created_at) desc,id);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id,user_id)
);
create index conversation_participants_user_idx on public.conversation_participants(user_id,conversation_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 2000 and body=btrim(body)),
  created_at timestamptz not null default now()
);
create index messages_conversation_cursor_idx on public.messages(conversation_id,created_at desc,id desc);

create table public.conversation_events (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('created','messaging_disabled')),
  created_at timestamptz not null default now()
);
create index conversation_events_conversation_idx on public.conversation_events(conversation_id,created_at,id);

create table private.message_rate_limits (
  scope text not null check (scope in ('user_burst','user_minute','conversation_minute')),
  key_id uuid not null,
  window_started_at timestamptz not null,
  attempts integer not null check (attempts > 0),
  expires_at timestamptz not null,
  primary key (scope,key_id,window_started_at)
);
create index message_rate_limits_expiry_idx on private.message_rate_limits(expires_at);
alter table private.message_rate_limits enable row level security;
alter table private.message_rate_limits force row level security;

create table public.safety_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  reported_user_id uuid references public.profiles(id) on delete restrict,
  reported_message_id uuid references public.messages(id) on delete restrict,
  reason_code text not null check (reason_code in ('harassment','suspicious_behavior','prohibited_item','scam_fraud','unsafe_conduct','inappropriate_content','other')),
  description text not null check (char_length(description) between 10 and 2000 and description=btrim(description)),
  state text not null default 'submitted' check (state in ('submitted','under_review','closed')),
  created_at timestamptz not null default now(),
  check (reported_user_id is not null or reported_message_id is not null)
);
create index safety_reports_booking_created_idx on public.safety_reports(booking_id,created_at desc,id);
create index safety_reports_conversation_idx on public.safety_reports(conversation_id);
create index safety_reports_message_idx on public.safety_reports(reported_message_id) where reported_message_id is not null;
create index safety_reports_reported_user_idx on public.safety_reports(reported_user_id) where reported_user_id is not null;

create table public.safety_report_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.safety_reports(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('submitted','state_changed')),
  created_at timestamptz not null default now()
);
create index safety_report_events_report_idx on public.safety_report_events(report_id,created_at,id);

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_events enable row level security;
alter table public.safety_reports enable row level security;
alter table public.safety_report_events enable row level security;
revoke all on public.conversations,public.conversation_participants,public.messages,public.conversation_events,public.safety_reports,public.safety_report_events from anon,authenticated;
revoke all on private.message_rate_limits from public,anon,authenticated;
revoke all on sequence public.conversation_events_id_seq,public.safety_report_events_id_seq from anon,authenticated;

create function private.create_booking_conversation()
returns trigger language plpgsql security definer set search_path='' as $$
declare conversation uuid;
begin
  insert into public.conversations(booking_id,sender_id,traveler_id)
  values(new.id,new.sender_id,new.traveler_id) returning id into conversation;
  insert into public.conversation_participants(conversation_id,user_id)
  values(conversation,new.sender_id),(conversation,new.traveler_id);
  insert into public.conversation_events(conversation_id,actor_id,event_type)
  values(conversation,new.sender_id,'created');
  return new;
end;
$$;
revoke all on function private.create_booking_conversation() from public,anon,authenticated;

create trigger booking_conversation_after_insert
after insert on public.bookings for each row execute function private.create_booking_conversation();

-- Backfill only supports upgrade from Phase 1H; the unique booking key makes it idempotent.
insert into public.conversations(booking_id,sender_id,traveler_id)
select b.id,b.sender_id,b.traveler_id from public.bookings b
on conflict (booking_id) do nothing;
insert into public.conversation_participants(conversation_id,user_id)
select c.id,c.sender_id from public.conversations c union
select c.id,c.traveler_id from public.conversations c
on conflict do nothing;
insert into public.conversation_events(conversation_id,actor_id,event_type)
select c.id,c.sender_id,'created' from public.conversations c
where not exists(select 1 from public.conversation_events e where e.conversation_id=c.id and e.event_type='created');

create function private.assert_conversation_participant(input_conversation_id uuid,input_actor uuid)
returns public.conversations language plpgsql stable security definer set search_path='' as $$
declare result public.conversations%rowtype;
begin
  if input_actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  select * into result from public.conversations c where c.id=input_conversation_id and input_actor in(c.sender_id,c.traveler_id);
  if not found then raise exception using errcode='42501',message='conversation unavailable'; end if;
  return result;
end;
$$;
revoke all on function private.assert_conversation_participant(uuid,uuid) from public,anon,authenticated;

create function private.consume_message_limit(input_scope text,input_key uuid,input_window interval,input_limit integer)
returns void language plpgsql security definer set search_path='' as $$
declare started timestamptz := to_timestamp(floor(extract(epoch from clock_timestamp())/extract(epoch from input_window))*extract(epoch from input_window));
declare used integer;
begin
  delete from private.message_rate_limits where ctid in(select ctid from private.message_rate_limits where expires_at<clock_timestamp() limit 50);
  insert into private.message_rate_limits(scope,key_id,window_started_at,attempts,expires_at)
  values(input_scope,input_key,started,1,started+input_window+interval '1 minute')
  on conflict(scope,key_id,window_started_at) do update set attempts=private.message_rate_limits.attempts+1
  returning attempts into used;
  if used>input_limit then raise exception using errcode='P0001',message='message rate limit exceeded'; end if;
end;
$$;
revoke all on function private.consume_message_limit(text,uuid,interval,integer) from public,anon,authenticated;

create function public.get_my_conversations(input_limit integer default 25)
returns table(conversation_id uuid,booking_id uuid,booking_status text,counterparty_id uuid,counterparty_display_name text,origin_name text,destination_name text,item_title text,last_message_at timestamptz,last_message_preview text,unread_count bigint)
language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null then raise exception using errcode='42501',message='authentication required'; end if;
  if input_limit not between 1 and 50 then raise exception using errcode='22023',message='invalid conversation pagination'; end if;
  return query select c.id,c.booking_id,b.status,
    case when c.sender_id=actor then c.traveler_id else c.sender_id end,cp.display_name,
    ol.canonical_name,dl.canonical_name,i.title,c.last_message_at,
    left(lm.body,120),count(m.id) filter(where m.sender_id<>actor and m.created_at>p.last_read_at)
  from public.conversations c join public.bookings b on b.id=c.booking_id
  join public.conversation_participants p on p.conversation_id=c.id and p.user_id=actor
  join public.profiles cp on cp.id=case when c.sender_id=actor then c.traveler_id else c.sender_id end
  join public.trips t on t.id=b.trip_id join public.locations ol on ol.id=t.origin_location_id join public.locations dl on dl.id=t.destination_location_id
  join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  left join lateral(select x.body from public.messages x where x.conversation_id=c.id order by x.created_at desc,x.id desc limit 1) lm on true
  left join public.messages m on m.conversation_id=c.id
  group by c.id,b.status,cp.id,ol.id,dl.id,i.id,p.last_read_at,lm.body
  order by coalesce(c.last_message_at,c.created_at) desc,c.id
  limit input_limit;
end;
$$;

create function public.get_conversation(input_conversation_id uuid)
returns table(conversation_id uuid,booking_id uuid,booking_status text,counterparty_id uuid,counterparty_display_name text,origin_name text,destination_name text,item_title text,category_code text,can_send boolean)
language sql stable security definer set search_path='' as $$
  select c.id,c.booking_id,b.status,case when c.sender_id=auth.uid() then c.traveler_id else c.sender_id end,cp.display_name,
    ol.canonical_name,dl.canonical_name,i.title,i.category_code,b.status in('proposed','accepted')
  from public.conversations c join public.bookings b on b.id=c.booking_id
  join public.profiles cp on cp.id=case when c.sender_id=auth.uid() then c.traveler_id else c.sender_id end
  join public.trips t on t.id=b.trip_id join public.locations ol on ol.id=t.origin_location_id join public.locations dl on dl.id=t.destination_location_id
  join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  where c.id=input_conversation_id and auth.uid() in(c.sender_id,c.traveler_id)
$$;

create function public.get_booking_conversation(input_booking_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
  select c.id from public.conversations c where c.booking_id=input_booking_id and auth.uid() in(c.sender_id,c.traveler_id)
$$;

create function public.get_conversation_messages(input_conversation_id uuid,input_limit integer default 50,input_before timestamptz default null,input_before_id uuid default null)
returns table(message_id uuid,sender_id uuid,sender_display_name text,body text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_conversation_participant(input_conversation_id,auth.uid());
  if input_limit not between 1 and 100 or ((input_before is null)<>(input_before_id is null)) then raise exception using errcode='22023',message='invalid message pagination'; end if;
  return query select m.id,m.sender_id,p.display_name,m.body,m.created_at from public.messages m join public.profiles p on p.id=m.sender_id
  where m.conversation_id=input_conversation_id and (input_before is null or (m.created_at,m.id)<(input_before,input_before_id))
  order by m.created_at desc,m.id desc limit input_limit;
end;
$$;

create function public.send_conversation_message(input_conversation_id uuid,input_body text)
returns table(message_id uuid,created_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); declare c public.conversations%rowtype; declare b public.bookings%rowtype; declare normalized text; declare sent public.messages%rowtype;
begin
  c:=private.assert_conversation_participant(input_conversation_id,actor);
  perform private.assert_active_booking_actor(actor);
  normalized:=btrim(replace(replace(coalesce(input_body,''),E'\r\n',E'\n'),E'\r',E'\n'));
  if char_length(normalized) not between 1 and 2000 then raise exception using errcode='22023',message='message must contain 1 to 2000 characters'; end if;
  select * into b from public.bookings x where x.id=c.booking_id for share;
  if b.status not in('proposed','accepted') then raise exception using errcode='P0001',message='messaging is closed for this booking'; end if;
  perform private.consume_message_limit('user_burst',actor,interval '10 seconds',5);
  perform private.consume_message_limit('user_minute',actor,interval '1 minute',20);
  perform private.consume_message_limit('conversation_minute',c.id,interval '1 minute',40);
  insert into public.messages(conversation_id,sender_id,body) values(c.id,actor,normalized) returning * into sent;
  update public.conversations x set last_message_at=sent.created_at where x.id=c.id;
  return query select sent.id,sent.created_at;
end;
$$;

create function public.mark_conversation_read(input_conversation_id uuid,input_through_message_id uuid default null)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); declare marked timestamptz;
begin
  perform private.assert_conversation_participant(input_conversation_id,actor);
  if input_through_message_id is null then
    select c.created_at into marked from public.conversations c where c.id=input_conversation_id;
  else
    select m.created_at into marked from public.messages m where m.id=input_through_message_id and m.conversation_id=input_conversation_id;
    if not found then raise exception using errcode='22023',message='invalid read cursor'; end if;
  end if;
  update public.conversation_participants p set last_read_at=greatest(p.last_read_at,marked) where p.conversation_id=input_conversation_id and p.user_id=actor;
  return marked;
end;
$$;

create function public.submit_safety_report(input_booking_id uuid,input_conversation_id uuid,input_reported_user_id uuid,input_reported_message_id uuid,input_reason_code text,input_description text)
returns table(report_id uuid,submitted_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); declare c public.conversations%rowtype; declare report public.safety_reports%rowtype; declare note text:=btrim(coalesce(input_description,''));
begin
  c:=private.assert_conversation_participant(input_conversation_id,actor);
  if c.booking_id<>input_booking_id then raise exception using errcode='42501',message='report context unavailable'; end if;
  if input_reason_code not in('harassment','suspicious_behavior','prohibited_item','scam_fraud','unsafe_conduct','inappropriate_content','other') or char_length(note) not between 10 and 2000 then raise exception using errcode='22023',message='invalid report'; end if;
  if input_reported_user_id is null or input_reported_user_id=actor or input_reported_user_id not in(c.sender_id,c.traveler_id) then raise exception using errcode='42501',message='report context unavailable'; end if;
  if input_reported_message_id is not null and not exists(select 1 from public.messages m where m.id=input_reported_message_id and m.conversation_id=c.id and m.sender_id=input_reported_user_id) then raise exception using errcode='42501',message='report context unavailable'; end if;
  insert into public.safety_reports(reporter_id,booking_id,conversation_id,reported_user_id,reported_message_id,reason_code,description)
  values(actor,c.booking_id,c.id,input_reported_user_id,input_reported_message_id,input_reason_code,note) returning * into report;
  insert into public.safety_report_events(report_id,actor_id,event_type) values(report.id,actor,'submitted');
  return query select report.id,report.created_at;
end;
$$;

do $$ declare signature regprocedure; begin
  for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_my_conversations','get_conversation','get_booking_conversation','get_conversation_messages','send_conversation_message','mark_conversation_read','submit_safety_report') loop
    execute format('revoke all on function %s from public,anon',signature);
    execute format('grant execute on function %s to authenticated',signature);
  end loop;
end $$;
