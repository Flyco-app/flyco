-- Cover Phase 1C foreign keys whose leading columns are not already indexed.
-- These keep reference checks and future maintenance bounded as trip history grows.

create index trips_destination_location_idx
  on public.trips (destination_location_id);

create index trip_cancellations_cancelled_by_idx
  on public.trip_cancellations (cancelled_by);

create index trip_events_actor_idx
  on public.trip_events (actor_id)
  where actor_id is not null;
