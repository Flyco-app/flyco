import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import {
  deliveryRequestIdSchema,
  formatWeight,
} from '@/modules/delivery-requests/validation';
import { matchingCopy, reasonLabel } from '@/modules/matching/copy';
import { matchPageSchema } from '@/modules/matching/model';
import {
  loadDeliveryRequestMatches,
  matchPageSize,
} from '@/modules/matching/queries';
import { categoryLabel } from '@/modules/trips/copy';
import { formatTripDate } from '@/modules/trips/presentation';

export default async function DeliveryRequestMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!deliveryRequestIdSchema.safeParse(input.id).success) notFound();
  const parsedPage = matchPageSchema.safeParse(
    (await searchParams).page ?? '1',
  );
  if (!parsedPage.success) notFound();
  const page = parsedPage.data;
  const matches = await loadDeliveryRequestMatches(locale, input.id, page);
  const d = matchingCopy[locale];

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.requestMatches}</h1>
      <p className="rounded-xl border p-3 text-sm">{d.advisory}</p>
      {matches.length === 0 ? (
        <p>{d.noMatches}</p>
      ) : (
        <ul className="grid gap-4">
          {matches.map((match) => (
            <li key={match.matchId} className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {match.originName} → {match.destinationName}
                </h2>
                <span>{formatWeight(match.tripCapacityGrams, locale)}</span>
              </div>
              <p>
                {formatTripDate(
                  match.departureAt,
                  match.originTimezone,
                  locale,
                )}{' '}
                –{' '}
                {formatTripDate(
                  match.arrivalAt,
                  match.destinationTimezone,
                  locale,
                )}
              </p>
              <p>
                {match.categoryCodes
                  .map((code) => categoryLabel(locale, code))
                  .join(' · ')}
              </p>
              <p>
                {d.traveler}: {match.displayName}
              </p>
              <ul className="flex flex-wrap gap-2 text-sm">
                {match.emailVerified && <li>{d.emailVerified}</li>}
                {match.phoneVerified && <li>{d.phoneVerified}</li>}
                {match.identityVerified && <li>{d.identityVerified}</li>}
                <li>
                  {d.completedJobs}: {match.completedJobs}
                </li>
                <li>
                  {d.reviews}: {match.reviewCount}
                </li>
              </ul>
              <div>
                <h3 className="font-medium">{d.explanation}</h3>
                <ul className="list-inside list-disc text-sm">
                  {match.reasonCodes.map((reason) => (
                    <li key={reason}>{reasonLabel(locale, reason)}</li>
                  ))}
                </ul>
                <p className="text-sm">
                  {d.dateFit}: {match.dateSlackMinutes} {d.minutes} ·{' '}
                  {d.capacityFit}:{' '}
                  {formatWeight(match.capacitySlackGrams, locale)}
                </p>
                <p className="text-sm">
                  {d.algorithm}: {match.algorithmVersion}
                </p>
              </div>
              <Link href={`/${locale}/trips/public/${match.tripId}`}>
                {d.viewListing}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <nav aria-label={d.pagination} className="flex justify-between gap-4">
        {page > 1 ? (
          <Link href={`?page=${page - 1}`}>{d.previous}</Link>
        ) : (
          <span />
        )}
        {matches.length === matchPageSize && (
          <Link href={`?page=${page + 1}`}>{d.next}</Link>
        )}
      </nav>
      <Link href={`/${locale}/delivery-requests/${input.id}`}>
        {d.backToRequest}
      </Link>
    </section>
  );
}
