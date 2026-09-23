import Link from 'next/link';
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
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{d.booking}</h1>
        <strong>{bookingStatusLabel(locale, booking.status)}</strong>
      </div>
      <div className="space-y-2 rounded-xl border p-4">
        <h2 className="font-semibold">{booking.item_title}</h2>
        <p>
          {booking.origin_name} → {booking.destination_name}
        </p>
        <p>
          {d.counterparty}: {booking.counterparty_display_name}
        </p>
        <p>
          {d.reserved}: {formatWeight(booking.reserved_capacity_grams, locale)}
        </p>
        <p>
          {d.offered}: {formatWeight(booking.offered_capacity_grams, locale)} ·{' '}
          {d.available}:{' '}
          {formatWeight(booking.available_capacity_grams, locale)}
        </p>
        <p>
          {d.expires}:{' '}
          {new Intl.DateTimeFormat(locale, {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(booking.expires_at))}
        </p>
        <p className="text-sm">{d.capacityNotice}</p>
      </div>
      {proposed && booking.role === 'traveler' && (
        <div className="flex gap-3">
          <form action={acceptBooking}>
            <CommandFields
              locale={locale}
              bookingId={booking.bookingId}
              version={booking.version}
            />
            <button
              className="rounded-md bg-black px-4 py-2 text-white"
              type="submit"
            >
              {d.accept}
            </button>
          </form>
          <form action={rejectBooking}>
            <CommandFields
              locale={locale}
              bookingId={booking.bookingId}
              version={booking.version}
            />
            <button className="rounded-md border px-4 py-2" type="submit">
              {d.reject}
            </button>
          </form>
        </div>
      )}
      {cancellable && (
        <form
          action={cancelBooking}
          className="space-y-2 rounded-xl border p-4"
        >
          <CommandFields
            locale={locale}
            bookingId={booking.bookingId}
            version={booking.version}
          />
          <label className="grid gap-1">
            <span>{d.reason}</span>
            <input
              className="rounded-md border p-2"
              name="reason"
              minLength={3}
              maxLength={240}
              required
            />
          </label>
          <button className="rounded-md border px-4 py-2" type="submit">
            {d.cancel}
          </button>
        </form>
      )}
      <Link href={`/${locale}/bookings`}>{d.back}</Link>
    </section>
  );
}
