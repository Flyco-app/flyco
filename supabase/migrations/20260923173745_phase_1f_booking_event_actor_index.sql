-- Cover actor FK maintenance without duplicating indexes already led by match/booking IDs.
create index booking_events_actor_fk_idx on public.booking_events (actor_id)
where actor_id is not null;
