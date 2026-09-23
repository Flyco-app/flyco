import 'server-only';
import { requireActiveAccount } from '@/lib/auth/session';
import type { Locale } from '@/lib/auth/validation';
import type { BookingStatus } from './copy';

type RawBooking = {
  booking_id: string;
  match_id: string;
  participant_role: string;
  status: string;
  version: number;
  reserved_capacity_grams: number;
  expires_at: string;
  proposed_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  trip_id: string;
  delivery_request_id: string;
  counterparty_id: string;
  counterparty_display_name: string;
  origin_name: string;
  destination_name: string;
  departure_at: string;
  arrival_at: string;
  item_title: string;
  category_code: string;
  offered_capacity_grams: number;
  reserved_trip_capacity_grams: number;
  available_capacity_grams: number;
  item_description: string;
  declared_contents: string;
  handling_notes: string | null;
  fragile: boolean;
  quantity: number;
};

export type Booking = Omit<
  RawBooking,
  'booking_id' | 'participant_role' | 'status'
> & {
  bookingId: string;
  role: 'sender' | 'traveler';
  status: BookingStatus;
  itemPhotos: { id: string; signedUrl: string }[];
};

function mapBooking(row: RawBooking): Booking {
  if (!['sender', 'traveler'].includes(row.participant_role))
    throw new Error('Invalid booking role.');
  if (
    !['proposed', 'accepted', 'rejected', 'cancelled', 'expired'].includes(
      row.status,
    )
  )
    throw new Error('Invalid booking status.');
  const { booking_id, participant_role, status, ...rest } = row;
  return {
    bookingId: booking_id,
    role: participant_role as Booking['role'],
    status: status as BookingStatus,
    itemPhotos: [],
    ...rest,
  };
}

export async function loadBookings(locale: Locale): Promise<Booking[]> {
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('get_my_bookings', {
    input_limit: 50,
    input_offset: 0,
  });
  if (result.error) throw new Error('Unable to load bookings.');
  return (result.data as RawBooking[]).map(mapBooking);
}

export async function loadBooking(
  locale: Locale,
  bookingId: string,
): Promise<Booking | null> {
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('get_booking', {
    input_booking_id: bookingId,
  });
  if (result.error) throw new Error('Unable to load booking.');
  const row = (result.data as RawBooking[])[0];
  if (!row) return null;
  const booking = mapBooking(row);
  const photos = await client.rpc('get_booking_item_photos', {
    input_booking_id: bookingId,
  });
  if (photos.error) throw new Error('Unable to load booking item photos.');
  const signed = await Promise.all(
    (photos.data as { photo_id: string; storage_path: string }[]).map(
      async (photo) => {
        const result = await client.storage
          .from('item-photos')
          .createSignedUrl(photo.storage_path, 300);
        if (result.error) throw new Error('Unable to load booking item photo.');
        return { id: photo.photo_id, signedUrl: result.data.signedUrl };
      },
    ),
  );
  return { ...booking, itemPhotos: signed };
}
