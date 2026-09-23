import Link from 'next/link';
import { safeLocale } from '@/lib/auth/validation';
import { bookingCopy, bookingStatusLabel } from '@/modules/bookings/copy';
import { loadBookings } from '@/modules/bookings/queries';
import { formatWeight } from '@/modules/delivery-requests/validation';

export default async function BookingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const bookings = await loadBookings(locale);
  const d = bookingCopy[locale];
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.bookings}</h1>
      {bookings.length === 0 ? (
        <p>{d.noBookings}</p>
      ) : (
        <ul className="grid gap-4">
          {bookings.map((booking) => (
            <li
              key={booking.bookingId}
              className="space-y-2 rounded-xl border p-4"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <strong>{booking.item_title}</strong>
                <span>{bookingStatusLabel(locale, booking.status)}</span>
              </div>
              <p>
                {booking.origin_name} → {booking.destination_name}
              </p>
              <p>
                {booking.role === 'sender' ? d.outgoing : d.incoming} ·{' '}
                {d.counterparty}: {booking.counterparty_display_name}
              </p>
              <p>
                {d.reserved}:{' '}
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
