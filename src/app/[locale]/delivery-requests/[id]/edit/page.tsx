import Link from 'next/link';
import { notFound } from 'next/navigation';
import { safeLocale } from '@/lib/auth/validation';
import { updateDeliveryRequest } from '@/modules/delivery-requests/actions';
import { requestCopy } from '@/modules/delivery-requests/copy';
import { loadDeliveryRequestEditor } from '@/modules/delivery-requests/queries';
import { DeliveryRequestForm } from '@/modules/delivery-requests/request-form';
import { utcToLocalDateTime } from '@/modules/trips/timezone';
import { deliveryRequestIdSchema } from '@/modules/delivery-requests/validation';

export default async function EditDeliveryRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const input = await params;
  const locale = safeLocale(input.locale);
  if (!deliveryRequestIdSchema.safeParse(input.id).success) notFound();
  const { request, references } = await loadDeliveryRequestEditor(
    locale,
    input.id,
  );
  if (!request || !['draft', 'published'].includes(request.status)) notFound();
  const d = requestCopy[locale];
  const error = (await searchParams).error;
  const mm = (value: number | null) =>
    value === null ? '' : String(value / 10);
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-semibold">{d.editRequest}</h1>
      {error && (
        <p role="alert" className="rounded-xl border p-3">
          {error === 'conflict' ? d.conflict : d.invalid}
        </p>
      )}
      <DeliveryRequestForm
        locale={locale}
        references={references}
        action={updateDeliveryRequest}
        defaults={{
          requestId: request.id,
          version: request.version,
          originLocationId: request.origin_location_id,
          destinationLocationId: request.destination_location_id,
          earliestDepartureLocal: utcToLocalDateTime(
            request.earliest_departure_at,
            request.origin.timezone,
          ),
          latestDeliveryLocal: utcToLocalDateTime(
            request.latest_delivery_at,
            request.destination.timezone,
          ),
          categoryCode: request.item.category_code,
          title: request.item.title,
          description: request.item.description,
          declaredContents: request.item.declared_contents,
          weightKg: String(request.item.weight_grams / 1000),
          lengthCm: mm(request.item.length_mm),
          widthCm: mm(request.item.width_mm),
          heightCm: mm(request.item.height_mm),
          quantity: request.item.quantity,
          fragile: request.item.fragile,
          handlingNotes: request.item.handling_notes ?? '',
          lockRoute: request.status === 'published',
        }}
      />
      <Link href={`/${locale}/delivery-requests/${request.id}`}>
        {d.requestDetail}
      </Link>
    </section>
  );
}
