import Link from 'next/link';
import { safeLocale } from '@/lib/auth/validation';
import {
  requestCategoryLabel,
  requestCopy,
} from '@/modules/delivery-requests/copy';
import { formatRequestDate } from '@/modules/delivery-requests/presentation';
import { loadOwnDeliveryRequests } from '@/modules/delivery-requests/queries';
import { formatWeight } from '@/modules/delivery-requests/validation';

export default async function DeliveryRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = requestCopy[locale];
  const requests = await loadOwnDeliveryRequests(locale);
  const error = (await searchParams).error;
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{d.myRequests}</h1>
        <Link
          className="button no-underline"
          href={`/${locale}/delivery-requests/new`}
        >
          {d.createRequest}
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
      {requests.length === 0 && <p>{d.noRequests}</p>}
      <ul className="grid gap-4">
        {requests.map((request) => (
          <li className="space-y-2 rounded-xl border p-4" key={request.id}>
            <div className="flex items-center justify-between gap-3">
              <strong>
                {request.origin.canonical_name} →{' '}
                {request.destination.canonical_name}
              </strong>
              <span className="rounded-full border px-2 py-1 text-sm">
                {d[request.status]}
              </span>
            </div>
            <p>
              {formatRequestDate(
                request.earliest_departure_at,
                request.origin.timezone,
                locale,
              )}{' '}
              –{' '}
              {formatRequestDate(
                request.latest_delivery_at,
                request.destination.timezone,
                locale,
              )}
            </p>
            <p>
              {request.item.title} ·{' '}
              {formatWeight(request.item.weight_grams, locale)}
            </p>
            <p className="text-sm text-muted-foreground">
              {requestCategoryLabel(locale, request.item.category_code)}
            </p>
            <Link href={`/${locale}/delivery-requests/${request.id}`}>
              {d.requestDetail}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
