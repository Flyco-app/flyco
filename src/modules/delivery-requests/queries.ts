import 'server-only';
import { requireActiveAccount } from '@/lib/auth/session';
import type { Locale } from '@/lib/auth/validation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const requestSelection = `
  id, owner_id, origin_location_id, destination_location_id,
  earliest_departure_at, latest_delivery_at, status, version,
  published_at, cancelled_at, expired_at, created_at, updated_at,
  origin:locations!delivery_requests_origin_location_id_fkey(id, canonical_name, timezone),
  destination:locations!delivery_requests_destination_location_id_fkey(id, canonical_name, timezone),
  item:declared_items(id, category_code, title, description, declared_contents,
    weight_grams, length_mm, width_mm, height_mm, quantity, fragile, handling_notes,
    item_photos(id, storage_path, mime_type, size_bytes, status, created_at))
`;

export type DeliveryRequestStatus =
  'draft' | 'published' | 'cancelled' | 'expired';
export type RequestLocation = {
  id: string;
  canonical_name: string;
  timezone: string;
};
export type ItemPhotoRecord = {
  id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  status: 'pending' | 'ready' | 'deleted';
  created_at: string;
};
export type DeclaredItemRecord = {
  id: string;
  category_code: string;
  title: string;
  description: string;
  declared_contents: string;
  weight_grams: number;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  quantity: number;
  fragile: boolean;
  handling_notes: string | null;
  item_photos: ItemPhotoRecord[];
};
export type DeliveryRequestRecord = {
  id: string;
  owner_id: string;
  origin_location_id: string;
  destination_location_id: string;
  earliest_departure_at: string;
  latest_delivery_at: string;
  status: DeliveryRequestStatus;
  version: number;
  published_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  created_at: string;
  updated_at: string;
  origin: RequestLocation;
  destination: RequestLocation;
  item: DeclaredItemRecord;
};

type PublicRequestRow = {
  id: string;
  owner_id: string;
  origin_location_id: string;
  destination_location_id: string;
  earliest_departure_at: string;
  latest_delivery_at: string;
  status: 'published';
  category_code: string;
  title: string;
  weight_grams: number;
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  quantity: number;
  fragile: boolean;
};

export async function loadRequestReferenceData(locale: Locale) {
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
    throw new Error('Unable to load delivery request reference data.');
  return { locations: locations.data, categories: categories.data };
}

export async function loadOwnDeliveryRequests(
  locale: Locale,
): Promise<DeliveryRequestRecord[]> {
  const { client, user } = await requireActiveAccount(locale);
  const expiration = await client.rpc('expire_own_delivery_requests');
  if (expiration.error)
    throw new Error('Unable to refresh delivery request states.');
  const result = await client
    .from('delivery_requests')
    .select(requestSelection)
    .eq('owner_id', user.id)
    .order('earliest_departure_at');
  if (result.error) throw new Error('Unable to load delivery requests.');
  return result.data as unknown as DeliveryRequestRecord[];
}

export async function loadOwnDeliveryRequest(
  locale: Locale,
  requestId: string,
) {
  const { client, user } = await requireActiveAccount(locale);
  const expiration = await client.rpc('expire_own_delivery_requests');
  if (expiration.error)
    throw new Error('Unable to refresh delivery request states.');
  const result = await client
    .from('delivery_requests')
    .select(requestSelection)
    .eq('id', requestId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (result.error) throw new Error('Unable to load delivery request.');
  const request = result.data as unknown as DeliveryRequestRecord | null;
  if (!request) return null;
  const readyPhotos = request.item.item_photos.filter(
    (photo) => photo.status === 'ready',
  );
  const signedPhotos = await Promise.all(
    readyPhotos.map(async (photo) => {
      const signed = await client.storage
        .from('item-photos')
        .createSignedUrl(photo.storage_path, 300);
      if (signed.error) throw new Error('Unable to authorize item photo.');
      return { ...photo, signedUrl: signed.data.signedUrl };
    }),
  );
  return { ...request, item: { ...request.item, item_photos: signedPhotos } };
}

export async function loadDeliveryRequestEditor(
  locale: Locale,
  requestId: string,
) {
  const [request, references] = await Promise.all([
    loadOwnDeliveryRequest(locale, requestId),
    loadRequestReferenceData(locale),
  ]);
  return { request, references };
}

export async function loadPublicDeliveryRequest(requestId: string) {
  const client = await createSupabaseServerClient();
  const projection = await client.rpc('get_public_delivery_request', {
    input_request_id: requestId,
  });
  if (projection.error || projection.data?.length !== 1) return null;
  const row = projection.data[0] as unknown as PublicRequestRow;
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
        'email_verified, phone_verified, identity_verified, completed_sender_jobs, review_count, rating_sum',
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
  return {
    request: { ...row, origin, destination },
    profile: profile.data,
    trust: trust.data,
  };
}
