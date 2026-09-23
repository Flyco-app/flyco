import { DestructiveSection } from '@/components/ui/patterns';
import { StatusBadge } from '@/components/ui/patterns';
import { SubmitButton } from '@/components/ui/submit-button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import { cancelTrip, publishTrip } from '@/modules/trips/actions';
import { matchingCopy } from '@/modules/matching/copy';
import { categoryLabel, tripCopy } from '@/modules/trips/copy';
import { formatTripDate } from '@/modules/trips/presentation';
import { loadOwnTrip } from '@/modules/trips/queries';
import { formatCapacity, tripIdSchema } from '@/modules/trips/validation';

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!tripIdSchema.safeParse(input.id).success) notFound();
  const trip = await loadOwnTrip(locale, input.id);
  if (!trip) notFound();
  const d = tripCopy[locale];
  const editable = trip.status === 'draft' || trip.status === 'published';
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{d.tripDetail}</h1>
        <StatusBadge status={trip.status}>{d[trip.status]}</StatusBadge>
      </div>
      <dl className="grid gap-3 rounded-xl border p-4">
        <div>
          <dt className="font-medium">{d.origin}</dt>
          <dd>{trip.origin.canonical_name}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.destination}</dt>
          <dd>{trip.destination.canonical_name}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.departure}</dt>
          <dd>
            {formatTripDate(trip.departure_at, trip.origin.timezone, locale)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">{d.arrival}</dt>
          <dd>
            {formatTripDate(trip.arrival_at, trip.destination.timezone, locale)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">{d.capacity}</dt>
          <dd>{formatCapacity(trip.capacity_grams, locale)}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.categories}</dt>
          <dd>
            {trip.trip_categories
              .map(({ category }) => categoryLabel(locale, category.code))
              .join(' · ')}
          </dd>
        </div>
      </dl>
      {editable && (
        <Link href={`/${locale}/trips/${trip.id}/edit`}>{d.editTrip}</Link>
      )}
      {trip.status === 'draft' && (
        <form action={publishTrip}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="tripId" value={trip.id} />
          <input type="hidden" name="expectedVersion" value={trip.version} />
          <SubmitButton locale={locale} className="button" type="submit">
            {d.publish}
          </SubmitButton>
        </form>
      )}
      {editable && (
        <DestructiveSection locale={locale} label={d.cancel} listing>
          <form
            action={cancelTrip}
            className="grid gap-3 rounded-xl border p-4"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="tripId" value={trip.id} />
            <input type="hidden" name="expectedVersion" value={trip.version} />
            <label>
              {d.cancellationReason}
              <textarea
                className="field"
                name="reason"
                required
                minLength={3}
              />
            </label>
            <SubmitButton
              locale={locale}
              className="button button-danger"
              type="submit"
            >
              {d.cancel}
            </SubmitButton>
          </form>
        </DestructiveSection>
      )}
      {trip.status === 'published' && (
        <div className="flex flex-wrap gap-4">
          <Link href={`/${locale}/trips/${trip.id}/matches`}>
            {matchingCopy[locale].tripMatches}
          </Link>
          <Link href={`/${locale}/trips/public/${trip.id}`}>
            {d.viewPublic}
          </Link>
        </div>
      )}
      <Link href={`/${locale}/trips`}>{d.back}</Link>
    </section>
  );
}
