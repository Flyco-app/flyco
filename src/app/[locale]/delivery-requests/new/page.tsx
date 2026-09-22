import Link from 'next/link';
import { safeLocale } from '@/lib/auth/validation';
import { createDeliveryRequest } from '@/modules/delivery-requests/actions';
import { requestCopy } from '@/modules/delivery-requests/copy';
import { loadRequestReferenceData } from '@/modules/delivery-requests/queries';
import { DeliveryRequestForm } from '@/modules/delivery-requests/request-form';

export default async function NewDeliveryRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const locale = safeLocale((await params).locale);
  const d = requestCopy[locale];
  const references = await loadRequestReferenceData(locale);
  const error = (await searchParams).error;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.createRequest}</h1>
      {error && (
        <p role="alert" className="rounded-xl border p-3">
          {d.invalid}
        </p>
      )}
      <DeliveryRequestForm
        locale={locale}
        references={references}
        action={createDeliveryRequest}
      />
      <Link href={`/${locale}/delivery-requests`}>{d.back}</Link>
    </section>
  );
}
