-- Phase 1I follow-up: covering indexes for participant and audit foreign keys.
create index messages_sender_fk_idx on public.messages(sender_id);
create index conversation_events_actor_fk_idx on public.conversation_events(actor_id) where actor_id is not null;
create index safety_reports_reporter_fk_idx on public.safety_reports(reporter_id);
create index safety_report_events_actor_fk_idx on public.safety_report_events(actor_id) where actor_id is not null;
