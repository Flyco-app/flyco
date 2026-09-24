-- Phase 1J: live staff authorization, moderation cases, audited evidence access,
-- account controls, and a durable transactional notification outbox.

create table private.staff_role_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  role_code text not null check (role_code in ('support','moderator','administrator')),
  granted_by uuid references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  reason text not null check (char_length(reason) between 3 and 500 and reason=btrim(reason)),
  revoke_reason text check (revoke_reason is null or (char_length(revoke_reason) between 3 and 500 and revoke_reason=btrim(revoke_reason))),
  check ((revoked_at is null)=(revoked_by is null)),
  check ((revoked_at is null)=(revoke_reason is null))
);
create unique index staff_role_assignments_active_unique on private.staff_role_assignments(user_id,role_code) where revoked_at is null;
create index staff_role_assignments_live_user_idx on private.staff_role_assignments(user_id,role_code) where revoked_at is null;
alter table private.staff_role_assignments enable row level security;
alter table private.staff_role_assignments force row level security;

create table private.staff_role_events (
  id bigint generated always as identity primary key,
  assignment_id uuid not null references private.staff_role_assignments(id) on delete restrict,
  actor_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('granted','revoked','bootstrapped')),
  reason text not null check (char_length(reason) between 3 and 500 and reason=btrim(reason)),
  created_at timestamptz not null default now()
);
create index staff_role_events_assignment_idx on private.staff_role_events(assignment_id,created_at,id);
alter table private.staff_role_events enable row level security;
alter table private.staff_role_events force row level security;

alter table public.safety_reports drop constraint safety_reports_state_check;
update public.safety_reports set state=case state when 'submitted' then 'open' when 'closed' then 'resolved' else state end;
alter table public.safety_reports alter column state set default 'open';
alter table public.safety_reports add constraint safety_reports_state_check check (state in ('open','under_review','resolved','dismissed'));
create index safety_reports_queue_idx on public.safety_reports(state,created_at,id);

create table public.moderation_notes (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.safety_reports(id) on delete restrict,
  author_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 3 and 2000 and body=btrim(body)),
  created_at timestamptz not null default now()
);
create index moderation_notes_report_idx on public.moderation_notes(report_id,created_at,id);

create table public.moderation_decisions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.safety_reports(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid references public.profiles(id) on delete restrict,
  decision_code text not null check (decision_code in ('no_action','warning_recorded','account_restricted','account_suspended','account_restored','report_dismissed','escalation_required')),
  reason_code text not null check (reason_code in ('policy_violation','safety_risk','harassment','fraud_risk','prohibited_item','insufficient_evidence','duplicate_report','resolved_by_support','other')),
  rationale text not null check (char_length(rationale) between 10 and 1000 and rationale=btrim(rationale)),
  report_state_before text not null check (report_state_before in ('open','under_review','resolved','dismissed')),
  report_state_after text not null check (report_state_after in ('open','under_review','resolved','dismissed')),
  account_state_before text check (account_state_before is null or account_state_before in ('active','restricted','suspended','closed')),
  account_state_after text check (account_state_after is null or account_state_after in ('active','restricted','suspended','closed')),
  created_at timestamptz not null default now()
);
create index moderation_decisions_report_idx on public.moderation_decisions(report_id,created_at,id);
create index moderation_decisions_target_idx on public.moderation_decisions(target_user_id,created_at desc) where target_user_id is not null;

create table public.evidence_access_events (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.safety_reports(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  resource_type text not null check (resource_type in ('report','booking','message','item_details','account_summary')),
  resource_id uuid not null,
  purpose_code text not null check (purpose_code in ('initial_review','follow_up','decision_review','safety_escalation')),
  created_at timestamptz not null default now()
);
create index evidence_access_events_report_idx on public.evidence_access_events(report_id,created_at,id);
create index evidence_access_events_actor_idx on public.evidence_access_events(actor_id,created_at desc);

create table public.moderation_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete restrict,
  report_id uuid references public.safety_reports(id) on delete restrict,
  target_user_id uuid references public.profiles(id) on delete restrict,
  event_type text not null check (event_type in ('report_opened','note_added','decision_recorded','account_restricted','account_suspended','account_restored','staff_role_granted','staff_role_revoked')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);
create index moderation_audit_report_idx on public.moderation_audit_events(report_id,created_at,id) where report_id is not null;
create index moderation_audit_target_idx on public.moderation_audit_events(target_user_id,created_at desc) where target_user_id is not null;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  deduplication_key text not null unique check (char_length(deduplication_key) between 8 and 200),
  event_type text not null check (event_type in ('booking_proposed','booking_accepted','booking_rejected','booking_cancelled','new_message','report_submitted','account_restricted','account_suspended','account_restored','staff_role_granted','staff_role_revoked')),
  recipient_id uuid not null references public.profiles(id) on delete restrict,
  resource_type text not null check (resource_type in ('booking','conversation','report','account','staff_assignment')),
  resource_id uuid not null,
  payload_version smallint not null default 1 check (payload_version between 1 and 100),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload)='object'),
  state text not null default 'pending' check (state in ('pending','processing','delivered','failed')),
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  claimed_by text check (claimed_by is null or char_length(claimed_by) between 3 and 100),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  last_error_code text check (last_error_code is null or char_length(last_error_code) <= 100),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  check ((state='processing')=(claimed_at is not null and claimed_by is not null)),
  check ((state='delivered')=(delivered_at is not null))
);
create index notification_outbox_claim_idx on public.notification_outbox(state,available_at,created_at,id) where state in ('pending','failed');
create index notification_outbox_recipient_idx on public.notification_outbox(recipient_id,created_at desc);

alter table public.moderation_notes enable row level security;
alter table public.moderation_decisions enable row level security;
alter table public.evidence_access_events enable row level security;
alter table public.moderation_audit_events enable row level security;
alter table public.notification_outbox enable row level security;
revoke all on private.staff_role_assignments,private.staff_role_events from public,anon,authenticated;
revoke all on public.moderation_notes,public.moderation_decisions,public.evidence_access_events,public.moderation_audit_events,public.notification_outbox from anon,authenticated;
revoke all on sequence private.staff_role_events_id_seq,public.evidence_access_events_id_seq,public.moderation_audit_events_id_seq from public,anon,authenticated;

create function private.current_authentication_assurance() returns text
language sql stable security definer set search_path='' as $$ select coalesce(auth.jwt()->>'aal','aal1') $$;
revoke all on function private.current_authentication_assurance() from public,anon,authenticated;

create function private.has_live_staff_role(input_actor uuid,input_roles text[])
returns boolean language sql stable security definer set search_path='' as $$
  select input_actor is not null and exists(
    select 1 from private.staff_role_assignments a join public.profiles p on p.id=a.user_id
    where a.user_id=input_actor and a.revoked_at is null and a.role_code=any(input_roles) and p.account_status='active'
  )
$$;
revoke all on function private.has_live_staff_role(uuid,text[]) from public,anon,authenticated;

create function private.assert_staff(input_roles text[],input_require_aal2 boolean default true)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not private.has_live_staff_role(actor,input_roles) then
    raise exception using errcode='42501',message='staff access denied';
  end if;
  if input_require_aal2 and private.current_authentication_assurance()<>'aal2' then
    raise exception using errcode='42501',message='multi-factor authentication required';
  end if;
  return actor;
end;
$$;
revoke all on function private.assert_staff(text[],boolean) from public,anon,authenticated;

create function private.enqueue_notification(input_key text,input_type text,input_recipient uuid,input_resource_type text,input_resource_id uuid,input_payload jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare event_id uuid;
begin
  insert into public.notification_outbox(deduplication_key,event_type,recipient_id,resource_type,resource_id,payload)
  values(input_key,input_type,input_recipient,input_resource_type,input_resource_id,coalesce(input_payload,'{}'::jsonb))
  on conflict(deduplication_key) do update set deduplication_key=excluded.deduplication_key
  returning id into event_id;
  return event_id;
end;
$$;
revoke all on function private.enqueue_notification(text,text,uuid,text,uuid,jsonb) from public,anon,authenticated;

create function private.enqueue_booking_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; event_name text;
begin
  if tg_op='INSERT' then event_name:='booking_proposed'; recipient:=new.traveler_id;
  elsif new.status is not distinct from old.status or new.status not in('accepted','rejected','cancelled') then return new;
  else event_name:='booking_'||new.status; recipient:=case when new.status in('accepted','rejected') then new.sender_id else case when auth.uid()=new.sender_id then new.traveler_id else new.sender_id end end;
  end if;
  perform private.enqueue_notification('booking:'||new.id||':'||event_name||':'||new.version,event_name,recipient,'booking',new.id,jsonb_build_object('booking_id',new.id,'status',new.status));
  return new;
end;
$$;
revoke all on function private.enqueue_booking_notification() from public,anon,authenticated;
create trigger booking_notification_outbox after insert or update of status on public.bookings for each row execute function private.enqueue_booking_notification();

create function private.enqueue_message_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid;
begin
  select case when c.sender_id=new.sender_id then c.traveler_id else c.sender_id end into recipient from public.conversations c where c.id=new.conversation_id;
  perform private.enqueue_notification('message:'||new.id,'new_message',recipient,'conversation',new.conversation_id,jsonb_build_object('conversation_id',new.conversation_id,'message_id',new.id));
  return new;
end;
$$;
revoke all on function private.enqueue_message_notification() from public,anon,authenticated;
create trigger message_notification_outbox after insert on public.messages for each row execute function private.enqueue_message_notification();

create function private.enqueue_report_notification() returns trigger language plpgsql security definer set search_path='' as $$
begin
  perform private.enqueue_notification('report:'||new.id||':submitted','report_submitted',new.reporter_id,'report',new.id,jsonb_build_object('report_id',new.id));
  return new;
end;
$$;
revoke all on function private.enqueue_report_notification() from public,anon,authenticated;
create trigger report_notification_outbox after insert on public.safety_reports for each row execute function private.enqueue_report_notification();

create function public.get_my_staff_access()
returns table(is_staff boolean,roles text[],aal2 boolean) language plpgsql stable security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
  return query select exists(select 1 from private.staff_role_assignments a join public.profiles p on p.id=a.user_id where a.user_id=actor and a.revoked_at is null and p.account_status='active'),
    coalesce(array(select a.role_code from private.staff_role_assignments a where a.user_id=actor and a.revoked_at is null order by a.role_code),array[]::text[]),
    private.current_authentication_assurance()='aal2';
end;
$$;

create function public.get_moderation_report_queue(input_limit integer default 25,input_before_created_at timestamptz default null,input_before_id uuid default null)
returns table(report_id uuid,state text,reason_code text,reported_user_id uuid,reported_display_name text,booking_id uuid,conversation_id uuid,reported_message_id uuid,submitted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_staff(array['support','moderator','administrator'],true);
  if input_limit not between 1 and 50 or ((input_before_created_at is null)<>(input_before_id is null)) then raise exception using errcode='22023',message='invalid pagination'; end if;
  return query select r.id,r.state,r.reason_code,r.reported_user_id,p.display_name,r.booking_id,r.conversation_id,r.reported_message_id,r.created_at
  from public.safety_reports r left join public.member_profiles p on p.id=r.reported_user_id
  where input_before_created_at is null or (r.created_at,r.id)<(input_before_created_at,input_before_id)
  order by r.created_at,r.id limit input_limit;
end;
$$;

create function public.get_moderation_report(input_report_id uuid)
returns table(report_id uuid,state text,reason_code text,description text,reporter_id uuid,reporter_display_name text,reported_user_id uuid,reported_display_name text,reported_account_status text,booking_id uuid,booking_status text,conversation_id uuid,reported_message_id uuid,origin_name text,destination_name text,item_title text,submitted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_staff(array['support','moderator','administrator'],true);
  return query select r.id,r.state,r.reason_code,r.description,r.reporter_id,rp.display_name,r.reported_user_id,tp.display_name,ap.account_status,r.booking_id,b.status,r.conversation_id,r.reported_message_id,ol.canonical_name,dl.canonical_name,i.title,r.created_at
  from public.safety_reports r join public.member_profiles rp on rp.id=r.reporter_id left join public.member_profiles tp on tp.id=r.reported_user_id left join public.profiles ap on ap.id=r.reported_user_id
  join public.bookings b on b.id=r.booking_id join public.trips t on t.id=b.trip_id join public.locations ol on ol.id=t.origin_location_id join public.locations dl on dl.id=t.destination_location_id join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  where r.id=input_report_id;
end;
$$;

create function public.open_moderation_report(input_report_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_staff(array['moderator','administrator'],true); current_state text;
begin
  select state into current_state from public.safety_reports where id=input_report_id for update;
  if not found then raise exception using errcode='42501',message='report unavailable'; end if;
  if current_state='under_review' then return current_state; end if;
  if current_state<>'open' then raise exception using errcode='P0001',message='invalid report transition'; end if;
  update public.safety_reports set state='under_review' where id=input_report_id;
  insert into public.safety_report_events(report_id,actor_id,event_type) values(input_report_id,actor,'state_changed');
  insert into public.moderation_audit_events(actor_id,report_id,event_type,metadata) values(actor,input_report_id,'report_opened',jsonb_build_object('from','open','to','under_review'));
  return 'under_review';
end;
$$;

create function public.get_moderation_evidence(input_report_id uuid,input_purpose_code text)
returns table(message_id uuid,message_body text,message_created_at timestamptz,item_title text,item_description text,declared_contents text,handling_notes text,booking_status text)
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_staff(array['moderator','administrator'],true); r public.safety_reports%rowtype; item_id uuid;
begin
  if input_purpose_code not in('initial_review','follow_up','decision_review','safety_escalation') then raise exception using errcode='22023',message='invalid evidence purpose'; end if;
  select * into r from public.safety_reports where id=input_report_id;
  if not found then raise exception using errcode='42501',message='report unavailable'; end if;
  select i.id into item_id from public.bookings b join public.declared_items i on i.delivery_request_id=b.delivery_request_id where b.id=r.booking_id;
  insert into public.evidence_access_events(report_id,actor_id,resource_type,resource_id,purpose_code) values
    (r.id,actor,'report',r.id,input_purpose_code),(r.id,actor,'booking',r.booking_id,input_purpose_code),(r.id,actor,'item_details',item_id,input_purpose_code),(r.id,actor,'account_summary',r.reported_user_id,input_purpose_code);
  if r.reported_message_id is not null then insert into public.evidence_access_events(report_id,actor_id,resource_type,resource_id,purpose_code) values(r.id,actor,'message',r.reported_message_id,input_purpose_code); end if;
  return query select m.id,m.body,m.created_at,i.title,i.description,i.declared_contents,i.handling_notes,b.status
  from public.safety_reports sr join public.bookings b on b.id=sr.booking_id join public.declared_items i on i.delivery_request_id=b.delivery_request_id left join public.messages m on m.id=sr.reported_message_id where sr.id=r.id;
end;
$$;

create function public.add_moderation_note(input_report_id uuid,input_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_staff(array['support','moderator','administrator'],true); note_id uuid; normalized text:=btrim(coalesce(input_body,''));
begin
  if char_length(normalized) not between 3 and 2000 or not exists(select 1 from public.safety_reports where id=input_report_id) then raise exception using errcode='22023',message='invalid moderation note'; end if;
  insert into public.moderation_notes(report_id,author_id,body) values(input_report_id,actor,normalized) returning id into note_id;
  insert into public.moderation_audit_events(actor_id,report_id,event_type) values(actor,input_report_id,'note_added');
  return note_id;
end;
$$;

create function public.get_moderation_case_history(input_report_id uuid)
returns table(entry_type text,entry_id uuid,actor_id uuid,code text,body text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_staff(array['support','moderator','administrator'],true);
  return query select 'note',n.id,n.author_id,'note',n.body,n.created_at from public.moderation_notes n where n.report_id=input_report_id
  union all select 'decision',d.id,d.actor_id,d.decision_code,d.rationale,d.created_at from public.moderation_decisions d where d.report_id=input_report_id order by created_at;
end;
$$;

create function public.record_moderation_decision(input_report_id uuid,input_decision_code text,input_reason_code text,input_rationale text,input_target_account_state text default null)
returns table(report_state text,account_state text) language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_staff(array['moderator','administrator'],true); r public.safety_reports%rowtype; before_account text; after_report text; rationale text:=btrim(coalesce(input_rationale,''));
begin
  select * into r from public.safety_reports where id=input_report_id for update;
  if not found or r.state<>'under_review' then raise exception using errcode='P0001',message='report must be under review'; end if;
  if input_decision_code not in('no_action','warning_recorded','account_restricted','account_suspended','account_restored','report_dismissed','escalation_required') or input_reason_code not in('policy_violation','safety_risk','harassment','fraud_risk','prohibited_item','insufficient_evidence','duplicate_report','resolved_by_support','other') or char_length(rationale) not between 10 and 1000 then raise exception using errcode='22023',message='invalid moderation decision'; end if;
  if input_decision_code in('account_restricted','account_suspended','account_restored') then
    if r.reported_user_id is null then raise exception using errcode='P0001',message='account action requires a reported user'; end if;
    select account_status into before_account from public.profiles where id=r.reported_user_id for update;
    if before_account='closed' then raise exception using errcode='P0001',message='closed account cannot transition'; end if;
    if input_target_account_state is distinct from (case input_decision_code when 'account_restricted' then 'restricted' when 'account_suspended' then 'suspended' else 'active' end) then raise exception using errcode='22023',message='invalid account transition'; end if;
    if input_target_account_state=before_account or (input_target_account_state='active' and before_account not in('restricted','suspended')) or (input_target_account_state='restricted' and before_account not in('active','suspended')) or (input_target_account_state='suspended' and before_account not in('active','restricted')) then raise exception using errcode='P0001',message='invalid account transition'; end if;
    update public.profiles set account_status=input_target_account_state where id=r.reported_user_id;
    if input_target_account_state='suspended' then delete from auth.sessions where user_id=r.reported_user_id; end if;
    insert into public.moderation_audit_events(actor_id,report_id,target_user_id,event_type,metadata) values(actor,r.id,r.reported_user_id,case input_target_account_state when 'restricted' then 'account_restricted' when 'suspended' then 'account_suspended' else 'account_restored' end,jsonb_build_object('from',before_account,'to',input_target_account_state));
    perform private.enqueue_notification('moderation:'||r.id||':'||input_decision_code,input_decision_code,r.reported_user_id,'account',r.reported_user_id,jsonb_build_object('account_status',input_target_account_state,'report_id',r.id));
  elsif input_target_account_state is not null then raise exception using errcode='22023',message='unexpected account transition';
  end if;
  after_report:=case when input_decision_code='report_dismissed' then 'dismissed' when input_decision_code='escalation_required' then 'under_review' else 'resolved' end;
  update public.safety_reports set state=after_report where id=r.id;
  insert into public.moderation_decisions(report_id,actor_id,target_user_id,decision_code,reason_code,rationale,report_state_before,report_state_after,account_state_before,account_state_after)
  values(r.id,actor,r.reported_user_id,input_decision_code,input_reason_code,rationale,r.state,after_report,before_account,input_target_account_state);
  insert into public.safety_report_events(report_id,actor_id,event_type) values(r.id,actor,'state_changed');
  insert into public.moderation_audit_events(actor_id,report_id,target_user_id,event_type,metadata) values(actor,r.id,r.reported_user_id,'decision_recorded',jsonb_build_object('decision_code',input_decision_code,'report_state',after_report));
  return query select after_report,coalesce(input_target_account_state,before_account);
end;
$$;

create function public.grant_staff_role(input_user_id uuid,input_role_code text,input_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_staff(array['administrator'],true); assignment_id uuid; normalized text:=btrim(coalesce(input_reason,''));
begin
  if input_role_code not in('support','moderator','administrator') or char_length(normalized) not between 3 and 500 or not exists(select 1 from public.profiles where id=input_user_id and account_status='active') then raise exception using errcode='22023',message='invalid staff assignment'; end if;
  insert into private.staff_role_assignments(user_id,role_code,granted_by,reason) values(input_user_id,input_role_code,actor,normalized) returning id into assignment_id;
  insert into private.staff_role_events(assignment_id,actor_id,event_type,reason) values(assignment_id,actor,'granted',normalized);
  insert into public.moderation_audit_events(actor_id,target_user_id,event_type,metadata) values(actor,input_user_id,'staff_role_granted',jsonb_build_object('role',input_role_code,'assignment_id',assignment_id));
  perform private.enqueue_notification('staff:'||assignment_id||':granted','staff_role_granted',input_user_id,'staff_assignment',assignment_id,jsonb_build_object('role',input_role_code));
  return assignment_id;
end;
$$;

create function public.get_staff_assignments()
returns table(assignment_id uuid,user_id uuid,display_name text,role_code text,granted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_staff(array['administrator'],true);
  return query select a.id,a.user_id,p.display_name,a.role_code,a.granted_at
  from private.staff_role_assignments a join public.member_profiles p on p.id=a.user_id
  where a.revoked_at is null order by p.display_name,a.role_code,a.id;
end;
$$;

create function public.revoke_staff_role(input_assignment_id uuid,input_reason text)
returns void language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.assert_staff(array['administrator'],true); assignment private.staff_role_assignments%rowtype; normalized text:=btrim(coalesce(input_reason,''));
begin
  if char_length(normalized) not between 3 and 500 then raise exception using errcode='22023',message='invalid revocation reason'; end if;
  select * into assignment from private.staff_role_assignments where id=input_assignment_id and revoked_at is null for update;
  if not found then raise exception using errcode='42501',message='staff assignment unavailable'; end if;
  update private.staff_role_assignments set revoked_at=now(),revoked_by=actor,revoke_reason=normalized where id=assignment.id;
  insert into private.staff_role_events(assignment_id,actor_id,event_type,reason) values(assignment.id,actor,'revoked',normalized);
  insert into public.moderation_audit_events(actor_id,target_user_id,event_type,metadata) values(actor,assignment.user_id,'staff_role_revoked',jsonb_build_object('role',assignment.role_code,'assignment_id',assignment.id));
  perform private.enqueue_notification('staff:'||assignment.id||':revoked','staff_role_revoked',assignment.user_id,'staff_assignment',assignment.id,jsonb_build_object('role',assignment.role_code));
end;
$$;

create function private.bootstrap_first_administrator(input_user_id uuid,input_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare assignment_id uuid; normalized text:=btrim(coalesce(input_reason,''));
begin
  if current_user not in('postgres','supabase_admin') or exists(select 1 from private.staff_role_assignments where revoked_at is null) or char_length(normalized) not between 3 and 500 or not exists(select 1 from public.profiles where id=input_user_id and account_status='active') then raise exception using errcode='42501',message='staff bootstrap unavailable'; end if;
  insert into private.staff_role_assignments(user_id,role_code,reason) values(input_user_id,'administrator',normalized) returning id into assignment_id;
  insert into private.staff_role_events(assignment_id,event_type,reason) values(assignment_id,'bootstrapped',normalized);
  insert into public.moderation_audit_events(target_user_id,event_type,metadata) values(input_user_id,'staff_role_granted',jsonb_build_object('role','administrator','assignment_id',assignment_id,'bootstrap',true));
  return assignment_id;
end;
$$;
revoke all on function private.bootstrap_first_administrator(uuid,text) from public,anon,authenticated;

create function public.claim_notification_outbox(input_worker_id text,input_limit integer default 25)
returns table(event_id uuid,event_type text,recipient_id uuid,resource_type text,resource_id uuid,payload_version smallint,payload jsonb,attempt_count integer)
language plpgsql security definer set search_path='' as $$
begin
  if current_setting('role',true)<>'service_role' or input_worker_id is null or char_length(input_worker_id) not between 3 and 100 or input_limit not between 1 and 100 then raise exception using errcode='42501',message='outbox worker access denied'; end if;
  return query with claimed as (
    select o.id from public.notification_outbox o where o.state in('pending','failed') and o.available_at<=now() order by o.available_at,o.created_at,o.id for update skip locked limit input_limit
  ), updated as (
    update public.notification_outbox o set state='processing',claimed_at=now(),claimed_by=input_worker_id,attempt_count=o.attempt_count+1,last_error_code=null from claimed c where o.id=c.id
    returning o.*
  ) select u.id,u.event_type,u.recipient_id,u.resource_type,u.resource_id,u.payload_version,u.payload,u.attempt_count from updated u;
end;
$$;

create function public.complete_notification_outbox(input_event_id uuid,input_worker_id text,input_success boolean,input_error_code text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_setting('role',true)<>'service_role' then raise exception using errcode='42501',message='outbox worker access denied'; end if;
  update public.notification_outbox set state=case when input_success then 'delivered' else 'failed' end,delivered_at=case when input_success then now() else null end,claimed_at=null,claimed_by=null,last_error_code=case when input_success then null else left(coalesce(input_error_code,'delivery_failed'),100) end,available_at=case when input_success then available_at else now()+least(attempt_count,10)*interval '1 minute' end
  where id=input_event_id and state='processing' and claimed_by=input_worker_id;
  if not found then raise exception using errcode='P0001',message='outbox claim unavailable'; end if;
end;
$$;

do $$ declare signature regprocedure; begin
  for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('get_my_staff_access','get_moderation_report_queue','get_moderation_report','open_moderation_report','get_moderation_evidence','add_moderation_note','get_moderation_case_history','record_moderation_decision','grant_staff_role','get_staff_assignments','revoke_staff_role') loop
    execute format('revoke all on function %s from public,anon',signature); execute format('grant execute on function %s to authenticated',signature);
  end loop;
  for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in('claim_notification_outbox','complete_notification_outbox') loop
    execute format('revoke all on function %s from public,anon,authenticated',signature); execute format('grant execute on function %s to service_role',signature);
  end loop;
end $$;

comment on table private.staff_role_assignments is 'Live, database-authoritative staff roles. Revocation is checked on every staff RPC.';
comment on table public.evidence_access_events is 'Append-only metadata proving scoped staff evidence access; never stores evidence content.';
comment on table public.notification_outbox is 'Privacy-minimized at-least-once notification events claimed by an idempotent privileged worker.';

create or replace function public.get_conversation(input_conversation_id uuid)
returns table(conversation_id uuid,booking_id uuid,booking_status text,counterparty_id uuid,counterparty_display_name text,origin_name text,destination_name text,item_title text,category_code text,can_send boolean)
language sql stable security definer set search_path='' as $$
  select c.id,c.booking_id,b.status,case when c.sender_id=auth.uid() then c.traveler_id else c.sender_id end,cp.display_name,
    ol.canonical_name,dl.canonical_name,i.title,i.category_code,b.status in('proposed','accepted') and exists(select 1 from public.profiles own where own.id=auth.uid() and own.account_status='active')
  from public.conversations c join public.bookings b on b.id=c.booking_id
  join public.profiles cp on cp.id=case when c.sender_id=auth.uid() then c.traveler_id else c.sender_id end
  join public.trips t on t.id=b.trip_id join public.locations ol on ol.id=t.origin_location_id join public.locations dl on dl.id=t.destination_location_id
  join public.declared_items i on i.delivery_request_id=b.delivery_request_id
  where c.id=input_conversation_id and auth.uid() in(c.sender_id,c.traveler_id)
$$;
