import { RouteDisplay } from '@/components/ui/patterns';
import { TrustPanel } from '@/components/ui/trust-panel';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import { categoryLabel, tripCopy } from '@/modules/trips/copy';
import { formatTripDate } from '@/modules/trips/presentation';
import { loadPublicTrip } from '@/modules/trips/queries';
import { formatCapacity, tripIdSchema } from '@/modules/trips/validation';

export default async function PublicTripPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!tripIdSchema.safeParse(input.id).success) notFound();
  const result = await loadPublicTrip(input.id);
  if (!result) notFound();
  const { trip, profile, trust } = result;
  const d = tripCopy[locale];
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.publicTrip}</h1>
      <div className="rounded-xl border p-4">
        <strong>
          <RouteDisplay
            origin={trip.origin.canonical_name}
            destination={trip.destination.canonical_name}
          />
        </strong>
        <p>
          {formatTripDate(trip.departure_at, trip.origin.timezone, locale)}
          {' – '}
          {formatTripDate(trip.arrival_at, trip.destination.timezone, locale)}
        </p>
        <p>{formatCapacity(trip.capacity_grams, locale)}</p>
        <p>
          {trip.trip_categories
            .map(({ category }) => categoryLabel(locale, category.code))
            .join(' · ')}
        </p>
      </div>
      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{d.traveler}</h2>
        <Link href={`/${locale}/members/${profile.id}`}>
          {profile.display_name}
        </Link>
        <TrustPanel
          locale={locale}
          email={trust.email_verified}
          identity={trust.identity_verified}
          completed={trust.completed_traveler_jobs}
          reviews={trust.review_count}
        />
      </section>
    </section>
  );
}
