import { RouteDisplay } from '@/components/ui/patterns';
import { EmptyState } from '@/components/ui/patterns';
import { uiCopy } from '@/lib/ui/copy';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import { requestCategoryLabel } from '@/modules/delivery-requests/copy';
import { formatRequestDate } from '@/modules/delivery-requests/presentation';
import { formatWeight } from '@/modules/delivery-requests/validation';
import { matchingCopy, reasonLabel } from '@/modules/matching/copy';
import { matchPageSchema } from '@/modules/matching/model';
import { loadTripMatches, matchPageSize } from '@/modules/matching/queries';
import { tripIdSchema } from '@/modules/trips/validation';

export default async function TripMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!tripIdSchema.safeParse(input.id).success) notFound();
  const parsedPage = matchPageSchema.safeParse(
    (await searchParams).page ?? '1',
  );
  if (!parsedPage.success) notFound();
  const page = parsedPage.data;
  const matches = await loadTripMatches(locale, input.id, page);
  if (!matches) notFound();
  const d = matchingCopy[locale];

  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.tripMatches}</h1>
      <p className="rounded-xl border p-3 text-sm">{d.advisory}</p>
      {matches.length === 0 ? (
        <EmptyState
          title={d.noMatches}
          description={uiCopy[locale].emptyMatches}
          href={`/${locale}/trips/${input.id}`}
          action={d.backToTrip}
        />
      ) : (
        <ul className="grid gap-4">
          {matches.map((match) => (
            <li key={match.matchId} className="space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{match.itemTitle}</h2>
                <span>{requestCategoryLabel(locale, match.categoryCode)}</span>
              </div>
              <p>
                <RouteDisplay
                  origin={match.originName}
                  destination={match.destinationName}
                />
              </p>
              <p>
                {formatRequestDate(
                  match.earliestDepartureAt,
                  match.originTimezone,
                  locale,
                )}{' '}
                –{' '}
                {formatRequestDate(
                  match.latestDeliveryAt,
                  match.destinationTimezone,
                  locale,
                )}
              </p>
              <p>{formatWeight(match.weightGrams, locale)}</p>
              <p>
                {d.sender}: {match.displayName}
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
              <div className="match-explanation">
                <h3 className="font-medium">{d.explanation}</h3>
                <ul className="reason-list">
                  {match.reasonCodes.map((reason) => (
                    <li key={reason}>{reasonLabel(locale, reason)}</li>
                  ))}
                </ul>
              </div>
              <Link
                href={`/${locale}/delivery-requests/public/${match.deliveryRequestId}`}
              >
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
      <Link href={`/${locale}/trips/${input.id}`}>{d.backToTrip}</Link>
    </section>
  );
}
