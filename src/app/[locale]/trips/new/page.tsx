import Link from 'next/link';
import { safeLocale } from '@/lib/auth/validation';
import { createTrip } from '@/modules/trips/actions';
import { tripCopy } from '@/modules/trips/copy';
import { loadTripReferenceData } from '@/modules/trips/queries';
import { TripForm } from '@/modules/trips/trip-form';

export default async function NewTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = tripCopy[locale];
  const references = await loadTripReferenceData(locale);
  const error = (await searchParams).error;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.createTrip}</h1>
      {error && (
        <p role="alert" className="rounded-xl border p-3">
          {d.invalid}
        </p>
      )}
      <TripForm locale={locale} references={references} action={createTrip} />
      <Link href={`/${locale}/trips`}>{d.back}</Link>
    </section>
  );
}
