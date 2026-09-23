import { RouteDisplay } from '@/components/ui/patterns';
import { TrustPanel } from '@/components/ui/trust-panel';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import {
  requestCategoryLabel,
  requestCopy,
} from '@/modules/delivery-requests/copy';
import { formatRequestDate } from '@/modules/delivery-requests/presentation';
import { loadPublicDeliveryRequest } from '@/modules/delivery-requests/queries';
import {
  deliveryRequestIdSchema,
  formatDimension,
  formatWeight,
} from '@/modules/delivery-requests/validation';

export default async function PublicDeliveryRequestPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!deliveryRequestIdSchema.safeParse(input.id).success) notFound();
  const result = await loadPublicDeliveryRequest(input.id);
  if (!result) notFound();
  const { request, profile, trust } = result;
  const d = requestCopy[locale];
  const dimensions =
    request.length_mm && request.width_mm && request.height_mm
      ? `${formatDimension(request.length_mm, locale)} × ${formatDimension(request.width_mm, locale)} × ${formatDimension(request.height_mm, locale)}`
      : null;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.publicRequest}</h1>
      <div className="space-y-2 rounded-xl border p-4">
        <strong>
          <RouteDisplay
            origin={request.origin.canonical_name}
            destination={request.destination.canonical_name}
          />
        </strong>
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
        <p>{request.title}</p>
        <p>
          {requestCategoryLabel(locale, request.category_code)} ·{' '}
          {formatWeight(request.weight_grams, locale)}
        </p>
        {dimensions && <p>{dimensions}</p>}
        <p>
          {d.quantity}: {request.quantity}
        </p>
        <p>
          {d.fragile}: {request.fragile ? d.yes : d.no}
        </p>
      </div>
      <section className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{d.sender}</h2>
        <Link href={`/${locale}/members/${profile.id}`}>
          {profile.display_name}
        </Link>
        <TrustPanel
          locale={locale}
          email={trust.email_verified}
          identity={trust.identity_verified}
          completed={trust.completed_sender_jobs}
          reviews={trust.review_count}
        />
      </section>
    </section>
  );
}
