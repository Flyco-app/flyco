import { RouteDisplay } from '@/components/ui/patterns';
import { EmptyState } from '@/components/ui/patterns';
import { uiCopy } from '@/lib/ui/copy';
import { StatusBadge } from '@/components/ui/patterns';
import Link from 'next/link';
import { safeLocale } from '@/lib/auth/validation';
import { bookingCopy, bookingStatusLabel } from '@/modules/bookings/copy';
import { loadBookings } from '@/modules/bookings/queries';
import { formatWeight } from '@/modules/delivery-requests/validation';

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const bookings = await loadBookings(locale);
  const d = bookingCopy[locale];
  const { error } = await searchParams;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.bookings}</h1>
      {error && <p role="alert">{uiCopy[locale].errorBody}</p>}
      {bookings.length === 0 ? (
        <EmptyState
          title={d.noBookings}
          description={uiCopy[locale].emptyBookings}
          href={`/${locale}/delivery-requests`}
          action={uiCopy[locale].requests}
          icon="booking"
        />
      ) : (
        <ul className="grid gap-4">
          {bookings.map((booking) => (
            <li
              key={booking.bookingId}
              className="space-y-2 rounded-xl border p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{booking.item_title}</strong>
                <StatusBadge status={booking.status}>
                  {bookingStatusLabel(locale, booking.status)}
                </StatusBadge>
              </div>
              <p>
                <RouteDisplay
                  origin={booking.origin_name}
                  destination={booking.destination_name}
                />
              </p>
              <p>
                {booking.role === 'sender' ? d.outgoing : d.incoming} ·{' '}
                {d.counterparty}: {booking.counterparty_display_name}
              </p>
              <p>
                {uiCopy[locale].weight}:{' '}
                {formatWeight(booking.reserved_capacity_grams, locale)}
              </p>
              <Link href={`/${locale}/bookings/${booking.bookingId}`}>
                {d.view}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
