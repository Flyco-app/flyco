import Link from 'next/link';
import { safeLocale } from '@/lib/auth/validation';
import { categoryLabel, tripCopy } from '@/modules/trips/copy';
import { formatTripDate } from '@/modules/trips/presentation';
import { loadOwnTrips } from '@/modules/trips/queries';
import { formatCapacity } from '@/modules/trips/validation';

export default async function TripsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = tripCopy[locale];
  const trips = await loadOwnTrips(locale);
  const error = (await searchParams).error;
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{d.myTrips}</h1>
        <Link className="button no-underline" href={`/${locale}/trips/new`}>
          {d.createTrip}
        </Link>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border p-3">
          {error === 'conflict'
            ? d.conflict
            : error === 'invalid'
              ? d.invalid
              : d.failed}
        </p>
      )}
      {trips.length === 0 && <p>{d.noTrips}</p>}
      <ul className="grid gap-4">
        {trips.map((trip) => (
          <li className="space-y-2 rounded-xl border p-4" key={trip.id}>
            <div className="flex items-center justify-between gap-3">
              <strong>
                {trip.origin.canonical_name} → {trip.destination.canonical_name}
              </strong>
              <span className="rounded-full border px-2 py-1 text-sm">
                {d[trip.status]}
              </span>
            </div>
            <p>
              {formatTripDate(trip.departure_at, trip.origin.timezone, locale)}
            </p>
            <p>{formatCapacity(trip.capacity_grams, locale)}</p>
            <p className="text-sm text-muted-foreground">
              {trip.trip_categories
                .map(({ category }) => categoryLabel(locale, category.code))
                .join(' · ')}
            </p>
            <Link href={`/${locale}/trips/${trip.id}`}>{d.tripDetail}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
