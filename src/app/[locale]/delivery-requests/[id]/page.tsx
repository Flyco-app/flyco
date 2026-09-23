import { uiCopy } from '@/lib/ui/copy';
import { DestructiveSection } from '@/components/ui/patterns';
import { StatusBadge } from '@/components/ui/patterns';
import { SubmitButton } from '@/components/ui/submit-button';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import {
  cancelDeliveryRequest,
  publishDeliveryRequest,
  removeItemPhoto,
  uploadItemPhoto,
} from '@/modules/delivery-requests/actions';
import {
  requestCategoryLabel,
  requestCopy,
} from '@/modules/delivery-requests/copy';
import { formatRequestDate } from '@/modules/delivery-requests/presentation';
import { loadOwnDeliveryRequest } from '@/modules/delivery-requests/queries';
import {
  deliveryRequestIdSchema,
  formatDimension,
  formatWeight,
} from '@/modules/delivery-requests/validation';
import { matchingCopy } from '@/modules/matching/copy';
import { policyCopy } from '@/modules/policy/config';

export default async function DeliveryRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!deliveryRequestIdSchema.safeParse(input.id).success) notFound();
  const request = await loadOwnDeliveryRequest(locale, input.id);
  if (!request) notFound();
  const d = requestCopy[locale];
  const policy = policyCopy[locale];
  const editable = ['draft', 'published'].includes(request.status);
  const { error } = await searchParams;
  const dimensions =
    request.item.length_mm && request.item.width_mm && request.item.height_mm
      ? `${formatDimension(request.item.length_mm, locale)} × ${formatDimension(request.item.width_mm, locale)} × ${formatDimension(request.item.height_mm, locale)}`
      : '—';
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{d.requestDetail}</h1>
        <StatusBadge status={request.status}>{d[request.status]}</StatusBadge>
      </div>
      {error && (
        <p role="alert" className="rounded-xl border p-3">
          {error === 'conflict'
            ? d.conflict
            : error === 'invalid-photo'
              ? d.invalidPhoto
              : d.failed}
        </p>
      )}
      {request.status === 'draft' && (
        <p className="section-hint">{uiCopy[locale].reviewHint}</p>
      )}
      <dl className="grid gap-3 rounded-xl border p-4">
        <div>
          <dt className="font-medium">{d.origin}</dt>
          <dd>{request.origin.canonical_name}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.destination}</dt>
          <dd>{request.destination.canonical_name}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.earliestDeparture}</dt>
          <dd>
            {formatRequestDate(
              request.earliest_departure_at,
              request.origin.timezone,
              locale,
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium">{d.latestDelivery}</dt>
          <dd>
            {formatRequestDate(
              request.latest_delivery_at,
              request.destination.timezone,
              locale,
            )}
          </dd>
        </div>
        <div>
          <dt className="font-medium">{d.category}</dt>
          <dd>{requestCategoryLabel(locale, request.item.category_code)}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.title}</dt>
          <dd>{request.item.title}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.description}</dt>
          <dd>{request.item.description}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.declaredContents}</dt>
          <dd>{request.item.declared_contents}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.weight}</dt>
          <dd>{formatWeight(request.item.weight_grams, locale)}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.dimensions}</dt>
          <dd>{dimensions}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.quantity}</dt>
          <dd>{request.item.quantity}</dd>
        </div>
        <div>
          <dt className="font-medium">{d.fragile}</dt>
          <dd>{request.item.fragile ? d.yes : d.no}</dd>
        </div>
        {request.item.handling_notes && (
          <div>
            <dt className="font-medium">{d.handlingNotes}</dt>
            <dd>{request.item.handling_notes}</dd>
          </div>
        )}
      </dl>
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="font-semibold">{d.photos}</h2>
        <p className="text-sm text-muted-foreground">{d.photoPrivacy}</p>
        <ul className="grid grid-cols-2 gap-3">
          {request.item.item_photos.map((photo) => (
            <li key={photo.id} className="space-y-2">
              <Image
                src={photo.signedUrl}
                alt=""
                width={320}
                height={240}
                unoptimized
                className="h-32 w-full rounded-lg object-cover"
              />
              {editable && (
                <form action={removeItemPhoto}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="requestId" value={request.id} />
                  <input type="hidden" name="photoId" value={photo.id} />
                  <input
                    type="hidden"
                    name="expectedVersion"
                    value={request.version}
                  />
                  <SubmitButton locale={locale} type="submit">
                    {d.removePhoto}
                  </SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
        {editable && request.item.item_photos.length < 5 && (
          <form
            action={uploadItemPhoto}
            encType="multipart/form-data"
            className="grid gap-3"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="requestId" value={request.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={request.version}
            />
            <label>
              {d.photoFile}
              <input
                className="field"
                name="photo"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
            </label>
            <SubmitButton locale={locale} className="button" type="submit">
              {d.uploadPhoto}
            </SubmitButton>
          </form>
        )}
      </section>
      {editable && (
        <Link href={`/${locale}/delivery-requests/${request.id}/edit`}>
          {d.editRequest}
        </Link>
      )}
      {request.status === 'draft' && (
        <form
          action={publishDeliveryRequest}
          className="space-y-3 rounded-xl border p-4"
        >
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="expectedVersion" value={request.version} />
          <p className="font-semibold">{policy.publicationRequired}</p>
          {[
            ['contentsAccurate', policy.senderAccurate],
            ['notProhibited', policy.senderAllowed],
            ['packagingAppropriate', policy.senderPacked],
            ['customsUnderstood', policy.senderCustoms],
          ].map(([name, label]) => (
            <label key={name} className="flex items-start gap-2">
              <input name={name} type="checkbox" required className="mt-1" />
              <span>{label}</span>
            </label>
          ))}
          <Link href={`/${locale}/safety`} className="text-sm">
            {policy.safety}
          </Link>
          <SubmitButton locale={locale} className="button" type="submit">
            {d.publish}
          </SubmitButton>
        </form>
      )}
      {editable && (
        <DestructiveSection locale={locale} label={d.cancel} listing>
          <form
            action={cancelDeliveryRequest}
            className="grid gap-3 rounded-xl border p-4"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="requestId" value={request.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={request.version}
            />
            <label>
              {d.cancellationReason}
              <textarea
                className="field"
                name="reason"
                required
                minLength={3}
                maxLength={500}
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
      {request.status === 'published' && (
        <div className="flex flex-wrap gap-4">
          <Link href={`/${locale}/delivery-requests/${request.id}/matches`}>
            {matchingCopy[locale].requestMatches}
          </Link>
          <Link href={`/${locale}/delivery-requests/public/${request.id}`}>
            {d.viewPublic}
          </Link>
        </div>
      )}
      <Link href={`/${locale}/delivery-requests`}>{d.back}</Link>
    </section>
  );
}
