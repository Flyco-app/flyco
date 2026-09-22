import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireActiveAccount } from '@/lib/auth/session';
import type { Locale } from '@/lib/auth/validation';

const tripSelection = `
  id, owner_id, origin_location_id, destination_location_id,
  departure_at, arrival_at, capacity_grams, status, version,
  published_at, cancelled_at, expired_at, completed_at, created_at, updated_at,
  origin:locations!trips_origin_location_id_fkey(id, canonical_name, timezone),
  destination:locations!trips_destination_location_id_fkey(id, canonical_name, timezone),
  trip_categories(category:item_categories(code, sort_order))
`;

export type TripStatus =
  'draft' | 'published' | 'cancelled' | 'expired' | 'completed';

export type TripLocation = {
  id: string;
  canonical_name: string;
  timezone: string;
};

export type TripRecord = {
  id: string;
  owner_id: string;
  origin_location_id: string;
  destination_location_id: string;
  departure_at: string;
  arrival_at: string;
  capacity_grams: number;
  status: TripStatus;
  version: number;
  published_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  origin: TripLocation;
  destination: TripLocation;
  trip_categories: { category: { code: string; sort_order: number } }[];
};

type PublicTripRow = {
  id: string;
  owner_id: string;
  origin_location_id: string;
  destination_location_id: string;
  departure_at: string;
  arrival_at: string;
  capacity_grams: number;
  status: 'published';
  category_codes: string[];
};

export type PublicTripRecord = PublicTripRow & {
  origin: TripLocation;
  destination: TripLocation;
  trip_categories: { category: { code: string } }[];
};

export async function loadTripReferenceData(locale: Locale) {
  const { client } = await requireActiveAccount(locale);
  const [locations, categories] = await Promise.all([
    client
      .from('locations')
      .select('id, canonical_name, country_code, timezone')
      .eq('active', true)
      .order('country_code')
      .order('canonical_name'),
    client
      .from('item_categories')
      .select('code, sort_order')
      .eq('active', true)
      .order('sort_order'),
  ]);
  if (locations.error || categories.error)
    throw new Error('Unable to load trip reference data.');
  return { locations: locations.data, categories: categories.data };
}

export async function loadOwnTrips(locale: Locale): Promise<TripRecord[]> {
  const { client, user } = await requireActiveAccount(locale);
  const expiration = await client.rpc('expire_own_departed_trips');
  if (expiration.error) throw new Error('Unable to refresh trip states.');
  const result = await client
    .from('trips')
    .select(tripSelection)
    .eq('owner_id', user.id)
    .order('departure_at', { ascending: true });
  if (result.error) throw new Error('Unable to load trips.');
  return result.data as unknown as TripRecord[];
}

export async function loadOwnTrip(
  locale: Locale,
  tripId: string,
): Promise<TripRecord | null> {
  const { client, user } = await requireActiveAccount(locale);
  const expiration = await client.rpc('expire_own_departed_trips');
  if (expiration.error) throw new Error('Unable to refresh trip states.');
  const result = await client
    .from('trips')
    .select(tripSelection)
    .eq('id', tripId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load trip.');
  return result.data as unknown as TripRecord | null;
}

export async function loadTripEditorData(locale: Locale, tripId: string) {
  const { client, user } = await requireActiveAccount(locale);
  const expiration = await client.rpc('expire_own_departed_trips');
  if (expiration.error) throw new Error('Unable to refresh trip states.');
  const [trip, locations, categories] = await Promise.all([
    client
      .from('trips')
      .select(tripSelection)
      .eq('id', tripId)
      .eq('owner_id', user.id)
      .maybeSingle(),
    client
      .from('locations')
      .select('id, canonical_name, country_code, timezone')
      .eq('active', true)
      .order('country_code')
      .order('canonical_name'),
    client
      .from('item_categories')
      .select('code, sort_order')
      .eq('active', true)
      .order('sort_order'),
  ]);
  if (trip.error || locations.error || categories.error)
    throw new Error('Unable to load trip editor.');
  return {
    trip: trip.data as unknown as TripRecord | null,
    references: { locations: locations.data, categories: categories.data },
  };
}

export async function loadPublicTrip(tripId: string) {
  const client = await createSupabaseServerClient();
  const projection = await client.rpc('get_public_trip', {
    input_trip_id: tripId,
  });
  if (projection.error || projection.data?.length !== 1) return null;
  const row = projection.data[0] as unknown as PublicTripRow;
  const [locations, profile, trust] = await Promise.all([
    client
      .from('locations')
      .select('id, canonical_name, timezone')
      .in('id', [row.origin_location_id, row.destination_location_id]),
    client
      .from('member_profiles')
      .select('id, display_name, avatar_path')
      .eq('id', row.owner_id)
      .single(),
    client
      .from('profile_trust')
      .select(
        'email_verified, phone_verified, identity_verified, completed_traveler_jobs, review_count, rating_sum',
      )
      .eq('profile_id', row.owner_id)
      .single(),
  ]);
  if (locations.error || profile.error || trust.error) return null;
  const byId = new Map(
    locations.data.map((location) => [location.id, location]),
  );
  const origin = byId.get(row.origin_location_id);
  const destination = byId.get(row.destination_location_id);
  if (!origin || !destination) return null;
  const trip: PublicTripRecord = {
    ...row,
    origin,
    destination,
    trip_categories: row.category_codes.map((code) => ({ category: { code } })),
  };
  return { trip, profile: profile.data, trust: trust.data };
}
