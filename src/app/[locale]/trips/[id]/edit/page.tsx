import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import { updateTrip } from '@/modules/trips/actions';
import { tripCopy } from '@/modules/trips/copy';
import { loadTripEditorData } from '@/modules/trips/queries';
import { TripForm } from '@/modules/trips/trip-form';
import { utcToLocalDateTime } from '@/modules/trips/timezone';
import { tripIdSchema } from '@/modules/trips/validation';

export default async function EditTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!tripIdSchema.safeParse(input.id).success) notFound();
  const { trip, references } = await loadTripEditorData(locale, input.id);
  if (!trip || !['draft', 'published'].includes(trip.status)) notFound();
  const d = tripCopy[locale];
  const error = (await searchParams).error;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.editTrip}</h1>
      {error && (
        <p role="alert" className="rounded-xl border p-3">
          {d.invalid}
        </p>
      )}
      <TripForm
        locale={locale}
        references={references}
        action={updateTrip}
        defaults={{
          tripId: trip.id,
          version: trip.version,
          originLocationId: trip.origin_location_id,
          destinationLocationId: trip.destination_location_id,
          departureLocal: utcToLocalDateTime(
            trip.departure_at,
            trip.origin.timezone,
          ),
          arrivalLocal: utcToLocalDateTime(
            trip.arrival_at,
            trip.destination.timezone,
          ),
          capacityKg: String(trip.capacity_grams / 1000),
          categoryCodes: trip.trip_categories.map(
            ({ category }) => category.code,
          ),
          lockRoute: trip.status === 'published',
        }}
      />
      <Link href={`/${locale}/trips/${trip.id}`}>{d.tripDetail}</Link>
    </section>
  );
}
