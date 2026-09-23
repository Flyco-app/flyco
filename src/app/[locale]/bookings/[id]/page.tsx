import { uiCopy } from '@/lib/ui/copy';
import { RouteDisplay } from '@/components/ui/patterns';
import { DestructiveSection } from '@/components/ui/patterns';
import { StatusBadge } from '@/components/ui/patterns';
import { SubmitButton } from '@/components/ui/submit-button';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import {
  acceptBooking,
  cancelBooking,
  rejectBooking,
} from '@/modules/bookings/actions';
import { bookingCopy, bookingStatusLabel } from '@/modules/bookings/copy';
import { loadBooking } from '@/modules/bookings/queries';
import { bookingIdSchema } from '@/modules/bookings/validation';
import { formatWeight } from '@/modules/delivery-requests/validation';
import { policyCopy } from '@/modules/policy/config';

function CommandFields({
  locale,
  bookingId,
  version,
}: {
  locale: string;
  bookingId: string;
  version: number;
}) {
  return (
    <>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="expectedVersion" value={version} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
    </>
  );
}

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!bookingIdSchema.safeParse(input.id).success) notFound();
  const booking = await loadBooking(locale, input.id);
  if (!booking) notFound();
  const d = bookingCopy[locale];
  const proposed = booking.status === 'proposed';
  const cancellable = proposed || booking.status === 'accepted';
  const u = uiCopy[locale];
  const policy = policyCopy[locale];
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(new Date(value));
  const events = [
    { label: u.proposedAt, at: booking.proposed_at },
    ...(booking.accepted_at
      ? [{ label: u.acceptedAt, at: booking.accepted_at }]
      : []),
    ...[booking.cancelled_at, booking.rejected_at, booking.expired_at]
      .filter((at): at is string => Boolean(at))
      .map((at) => ({ label: u.closedAt, at })),
  ];
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{d.booking}</h1>
        <StatusBadge status={booking.status}>
          {bookingStatusLabel(locale, booking.status)}
        </StatusBadge>
      </div>
      <p role="status">
        {proposed
          ? u.waiting
          : booking.status === 'accepted'
            ? u.acceptedHint
            : u.terminalHint}
      </p>
      <div className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{booking.item_title}</h2>
        <p>
          <RouteDisplay
            origin={booking.origin_name}
            destination={booking.destination_name}
          />
        </p>
        <p>
          {booking.role === 'sender' ? d.outgoing : d.incoming} ·{' '}
          <Link href={`/${locale}/members/${booking.counterparty_id}`}>
            {booking.counterparty_display_name}
          </Link>
        </p>
        <div className="capacity-panel">
          <div>
            <span>{u.weight}</span>
            <strong>
              {formatWeight(booking.reserved_capacity_grams, locale)}
            </strong>
          </div>
          <div>
            <span>{u.offered}</span>
            <strong>
              {formatWeight(booking.offered_capacity_grams, locale)}
            </strong>
          </div>
          <div>
            <span>{u.capacity}</span>
            <strong>
              {formatWeight(booking.available_capacity_grams, locale)}
            </strong>
          </div>
        </div>
        <meter
          className="capacity-meter"
          min={0}
          max={booking.offered_capacity_grams}
          value={booking.available_capacity_grams}
          aria-label={u.capacity}
        />
        {proposed && (
          <p>
            {d.expires}: {formatDate(booking.expires_at)} · UTC
          </p>
        )}
        <p className="text-sm">{d.capacityNotice}</p>
      </div>
      <section
        className="space-y-3 rounded-xl border p-4"
        aria-labelledby="item-details-title"
      >
        <div>
          <h2 id="item-details-title" className="font-semibold">
            {policy.description}
          </h2>
          <p className="text-sm text-muted-foreground">
            {policy.participantInfo}
          </p>
        </div>
        <p>{booking.item_description}</p>
        <div>
          <strong>{policy.declaredContents}</strong>
          <p>{booking.declared_contents}</p>
        </div>
        {booking.handling_notes && (
          <div>
            <strong>{policy.handling}</strong>
            <p>{booking.handling_notes}</p>
          </div>
        )}
        {booking.itemPhotos.length > 0 && (
          <div>
            <strong>{policy.photos}</strong>
            <ul className="grid grid-cols-2 gap-3 pt-2">
              {booking.itemPhotos.map((photo) => (
                <li key={photo.id}>
                  <Image
                    src={photo.signedUrl}
                    alt=""
                    width={320}
                    height={240}
                    unoptimized
                    className="h-32 w-full rounded-lg object-cover"
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <section className="space-y-4 rounded-xl border p-4">
        <h2 className="font-semibold">{u.timeline}</h2>
        <ol className="timeline">
          {events.map((event) => (
            <li key={event.label}>
              <span>{event.label}</span>
              <time dateTime={event.at}>{formatDate(event.at)}</time>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">{u.utc}</p>
      </section>
      {proposed && booking.role === 'traveler' && (
        <div className="grid gap-3">
          <form
            action={acceptBooking}
            className="space-y-3 rounded-xl border p-4"
          >
            <CommandFields
              locale={locale}
              bookingId={booking.bookingId}
              version={booking.version}
            />
            <p className="text-sm">{policy.travelerContext}</p>
            <label className="flex items-start gap-2">
              <input
                name="safetyAcknowledged"
                type="checkbox"
                required
                className="mt-1"
              />
              <span>{policy.travelerConfirm}</span>
            </label>
            <Link href={`/${locale}/safety`} className="text-sm">
              {policy.safety}
            </Link>
            <SubmitButton locale={locale} className="button" type="submit">
              {d.accept}
            </SubmitButton>
          </form>
          <details className="destructive-section">
            <summary>{d.reject}</summary>
            <p>{u.confirm}</p>
            <form action={rejectBooking}>
              <CommandFields
                locale={locale}
                bookingId={booking.bookingId}
                version={booking.version}
              />
              <SubmitButton
                locale={locale}
                className="button button-secondary"
                type="submit"
              >
                {d.reject}
              </SubmitButton>
            </form>
          </details>
        </div>
      )}
      {cancellable && (
        <DestructiveSection locale={locale} label={d.cancel}>
          <form
            action={cancelBooking}
            className="space-y-2 rounded-xl border p-4"
          >
            <CommandFields
              locale={locale}
              bookingId={booking.bookingId}
              version={booking.version}
            />
            <p className="text-sm text-muted-foreground">
              {policy.cancellation}
            </p>
            <label className="grid gap-1">
              <span>{d.reason}</span>
              <input
                className="field"
                name="reason"
                minLength={3}
                maxLength={240}
                required
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
      <Link href={`/${locale}/bookings`}>{d.back}</Link>
    </section>
  );
}
