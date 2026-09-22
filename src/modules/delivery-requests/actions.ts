'use server';

import { redirect } from 'next/navigation';
import { assertTrustedServerActionOrigin } from '@/lib/auth/origin';
import { requireActiveAccount } from '@/lib/auth/session';
import { safeLocale } from '@/lib/auth/validation';
import { localDateTimeToUtc } from '@/modules/trips/timezone';
import { validateItemPhoto } from './photo-validation';
import {
  deliveryRequestCancellationSchema,
  deliveryRequestFormSchema,
  deliveryRequestIdSchema,
  deliveryRequestTransitionSchema,
  deliveryRequestVersionSchema,
  formDimensionToMillimeters,
  itemPhotoMutationSchema,
} from './validation';

function requestFields(form: FormData) {
  return {
    originLocationId: form.get('originLocationId'),
    destinationLocationId: form.get('destinationLocationId'),
    earliestDepartureLocal: form.get('earliestDepartureLocal'),
    latestDeliveryLocal: form.get('latestDeliveryLocal'),
    categoryCode: form.get('categoryCode'),
    title: form.get('title'),
    description: form.get('description'),
    declaredContents: form.get('declaredContents'),
    weightKg: form.get('weightKg'),
    lengthCm: form.get('lengthCm'),
    widthCm: form.get('widthCm'),
    heightCm: form.get('heightCm'),
    quantity: form.get('quantity'),
    fragile: form.get('fragile') === 'on',
    handlingNotes: form.get('handlingNotes'),
  };
}

async function commandInput(
  form: FormData,
  locale: ReturnType<typeof safeLocale>,
  errorPath: string,
) {
  const parsed = deliveryRequestFormSchema.safeParse(requestFields(form));
  if (!parsed.success) redirect(`${errorPath}?error=invalid`);
  const { client } = await requireActiveAccount(locale);
  const locations = await client
    .from('locations')
    .select('id, timezone')
    .in('id', [parsed.data.originLocationId, parsed.data.destinationLocationId])
    .eq('active', true);
  if (locations.error || locations.data.length !== 2)
    redirect(`${errorPath}?error=invalid`);
  const byId = new Map(
    locations.data.map((location) => [location.id, location]),
  );
  const origin = byId.get(parsed.data.originLocationId);
  const destination = byId.get(parsed.data.destinationLocationId);
  if (!origin || !destination) redirect(`${errorPath}?error=invalid`);
  let earliestDeparture: string;
  let latestDelivery: string;
  try {
    earliestDeparture = localDateTimeToUtc(
      parsed.data.earliestDepartureLocal,
      origin.timezone,
    );
    latestDelivery = localDateTimeToUtc(
      parsed.data.latestDeliveryLocal,
      destination.timezone,
    );
  } catch {
    redirect(`${errorPath}?error=invalid-time`);
  }
  const earliest = new Date(earliestDeparture).getTime();
  const latest = new Date(latestDelivery).getTime();
  if (latest <= earliest || latest - earliest > 90 * 86_400_000)
    redirect(`${errorPath}?error=invalid-time`);
  return {
    client,
    rpc: {
      input_origin: parsed.data.originLocationId,
      input_destination: parsed.data.destinationLocationId,
      input_earliest_departure: earliestDeparture,
      input_latest_delivery: latestDelivery,
      input_category_code: parsed.data.categoryCode,
      input_title: parsed.data.title,
      input_description: parsed.data.description,
      input_declared_contents: parsed.data.declaredContents,
      input_weight_grams: parsed.data.weightKg,
      input_length_mm: formDimensionToMillimeters(parsed.data.lengthCm),
      input_width_mm: formDimensionToMillimeters(parsed.data.widthCm),
      input_height_mm: formDimensionToMillimeters(parsed.data.heightCm),
      input_quantity: parsed.data.quantity,
      input_fragile: parsed.data.fragile,
      input_handling_notes: parsed.data.handlingNotes || null,
    },
  };
}

function commandError(
  locale: ReturnType<typeof safeLocale>,
  code?: string,
  suffix = '',
): never {
  redirect(
    `/${locale}/delivery-requests${suffix}?error=${code === '40001' ? 'conflict' : 'failed'}`,
  );
}

export async function createDeliveryRequest(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const { client, rpc } = await commandInput(
    form,
    locale,
    `/${locale}/delivery-requests/new`,
  );
  const result = await client.rpc('create_delivery_request_draft', rpc);
  if (result.error || !result.data) commandError(locale, result.error?.code);
  redirect(`/${locale}/delivery-requests/${result.data}?notice=created`);
}

export async function updateDeliveryRequest(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const requestId = deliveryRequestIdSchema.safeParse(form.get('requestId'));
  const version = deliveryRequestVersionSchema.safeParse(
    form.get('expectedVersion'),
  );
  if (!requestId.success || !version.success) commandError(locale);
  const errorPath = `/${locale}/delivery-requests/${requestId.data}/edit`;
  const { client, rpc } = await commandInput(form, locale, errorPath);
  const result = await client.rpc('update_delivery_request', {
    ...rpc,
    input_request_id: requestId.data,
    input_expected_version: version.data,
  });
  if (result.error) commandError(locale, result.error.code);
  redirect(`/${locale}/delivery-requests/${requestId.data}?notice=updated`);
}

export async function publishDeliveryRequest(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = deliveryRequestTransitionSchema.safeParse({
    requestId: form.get('requestId'),
    expectedVersion: form.get('expectedVersion'),
  });
  if (!parsed.success) commandError(locale);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('publish_delivery_request', {
    input_request_id: parsed.data.requestId,
    input_expected_version: parsed.data.expectedVersion,
  });
  if (result.error) commandError(locale, result.error.code);
  redirect(
    `/${locale}/delivery-requests/${parsed.data.requestId}?notice=published`,
  );
}

export async function cancelDeliveryRequest(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = deliveryRequestCancellationSchema.safeParse({
    requestId: form.get('requestId'),
    expectedVersion: form.get('expectedVersion'),
    reason: form.get('reason'),
  });
  if (!parsed.success) commandError(locale);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('cancel_delivery_request', {
    input_request_id: parsed.data.requestId,
    input_expected_version: parsed.data.expectedVersion,
    input_reason: parsed.data.reason,
  });
  if (result.error) commandError(locale, result.error.code);
  redirect(
    `/${locale}/delivery-requests/${parsed.data.requestId}?notice=cancelled`,
  );
}

export async function uploadItemPhoto(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const requestId = deliveryRequestIdSchema.safeParse(form.get('requestId'));
  const version = deliveryRequestVersionSchema.safeParse(
    form.get('expectedVersion'),
  );
  const file = form.get('photo');
  if (
    !requestId.success ||
    !version.success ||
    !(file instanceof File) ||
    !(await validateItemPhoto(file))
  )
    redirect(
      `/${locale}/delivery-requests/${requestId.success ? requestId.data : ''}?error=invalid-photo`,
    );
  const { client } = await requireActiveAccount(locale);
  const begun = await client.rpc('begin_item_photo_upload', {
    input_request_id: requestId.data,
    input_expected_version: version.data,
    input_mime_type: file.type,
    input_size_bytes: file.size,
  });
  const reservation = begun.data?.[0];
  if (begun.error || !reservation) commandError(locale, begun.error?.code);
  const uploaded = await client.storage
    .from('item-photos')
    .upload(reservation.storage_path, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });
  if (uploaded.error) {
    await client.rpc('remove_item_photo', {
      input_photo_id: reservation.photo_id,
      input_expected_version: reservation.request_version,
    });
    commandError(locale);
  }
  const finalized = await client.rpc('finalize_item_photo_upload', {
    input_photo_id: reservation.photo_id,
    input_expected_version: reservation.request_version,
  });
  if (finalized.error) commandError(locale, finalized.error.code);
  redirect(`/${locale}/delivery-requests/${requestId.data}?notice=photo-added`);
}

export async function removeItemPhoto(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = itemPhotoMutationSchema.safeParse({
    requestId: form.get('requestId'),
    expectedVersion: form.get('expectedVersion'),
    photoId: form.get('photoId'),
  });
  if (!parsed.success) commandError(locale);
  const { client } = await requireActiveAccount(locale);
  const removed = await client.rpc('remove_item_photo', {
    input_photo_id: parsed.data.photoId,
    input_expected_version: parsed.data.expectedVersion,
  });
  const row = removed.data?.[0];
  if (removed.error || !row) commandError(locale, removed.error?.code);
  const objectRemoval = await client.storage
    .from('item-photos')
    .remove([row.storage_path]);
  if (objectRemoval.error) commandError(locale);
  redirect(
    `/${locale}/delivery-requests/${parsed.data.requestId}?notice=photo-removed`,
  );
}
