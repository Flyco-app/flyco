'use server';

import { redirect } from 'next/navigation';
import { assertTrustedServerActionOrigin } from '@/lib/auth/origin';
import { requireActiveAccount } from '@/lib/auth/session';
import { safeLocale } from '@/lib/auth/validation';
import {
  cancellationSchema,
  transitionSchema,
  tripFormSchema,
  tripIdSchema,
  tripVersionSchema,
} from './validation';
import { localDateTimeToUtc } from './timezone';

function tripFields(form: FormData) {
  return {
    originLocationId: form.get('originLocationId'),
    destinationLocationId: form.get('destinationLocationId'),
    departureLocal: form.get('departureLocal'),
    arrivalLocal: form.get('arrivalLocal'),
    capacityKg: form.get('capacityKg'),
    categoryCodes: form.getAll('categoryCodes'),
  };
}

async function commandInput(
  form: FormData,
  locale: ReturnType<typeof safeLocale>,
  errorPath: string,
) {
  const parsed = tripFormSchema.safeParse(tripFields(form));
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
  let departureAt: string;
  let arrivalAt: string;
  try {
    departureAt = localDateTimeToUtc(
      parsed.data.departureLocal,
      origin.timezone,
    );
    arrivalAt = localDateTimeToUtc(
      parsed.data.arrivalLocal,
      destination.timezone,
    );
  } catch {
    redirect(`${errorPath}?error=invalid-time`);
  }
  if (new Date(arrivalAt).getTime() <= new Date(departureAt).getTime())
    redirect(`${errorPath}?error=invalid-time`);
  return {
    client,
    rpc: {
      input_origin: parsed.data.originLocationId,
      input_destination: parsed.data.destinationLocationId,
      input_departure: departureAt,
      input_arrival: arrivalAt,
      input_capacity_grams: parsed.data.capacityKg,
      input_category_codes: parsed.data.categoryCodes,
    },
  };
}

function commandError(locale: ReturnType<typeof safeLocale>, code?: string) {
  redirect(
    `/${locale}/trips?error=${code === '40001' ? 'conflict' : 'failed'}`,
  );
}

export async function createTrip(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const { client, rpc } = await commandInput(
    form,
    locale,
    `/${locale}/trips/new`,
  );
  const result = await client.rpc('create_trip_draft', rpc);
  if (result.error || !result.data) commandError(locale, result.error?.code);
  redirect(`/${locale}/trips/${result.data}?notice=created`);
}

export async function updateTrip(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const tripId = tripIdSchema.safeParse(form.get('tripId'));
  const version = tripVersionSchema.safeParse(form.get('expectedVersion'));
  if (!tripId.success || !version.success)
    redirect(`/${locale}/trips?error=invalid`);
  const { client, rpc } = await commandInput(
    form,
    locale,
    `/${locale}/trips/${tripId.data}/edit`,
  );
  const result = await client.rpc('update_trip', {
    ...rpc,
    input_trip_id: tripId.data,
    input_expected_version: version.data,
  });
  if (result.error) commandError(locale, result.error.code);
  redirect(`/${locale}/trips/${tripId.data}?notice=updated`);
}

export async function publishTrip(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = transitionSchema.safeParse({
    tripId: form.get('tripId'),
    expectedVersion: form.get('expectedVersion'),
  });
  if (!parsed.success) redirect(`/${locale}/trips?error=invalid`);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('publish_trip', {
    input_trip_id: parsed.data.tripId,
    input_expected_version: parsed.data.expectedVersion,
  });
  if (result.error) commandError(locale, result.error.code);
  redirect(`/${locale}/trips/${parsed.data.tripId}?notice=published`);
}

export async function cancelTrip(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = cancellationSchema.safeParse({
    tripId: form.get('tripId'),
    expectedVersion: form.get('expectedVersion'),
    reason: form.get('reason'),
  });
  if (!parsed.success) redirect(`/${locale}/trips?error=invalid`);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('cancel_trip', {
    input_trip_id: parsed.data.tripId,
    input_expected_version: parsed.data.expectedVersion,
    input_reason: parsed.data.reason,
  });
  if (result.error) commandError(locale, result.error.code);
  redirect(`/${locale}/trips/${parsed.data.tripId}?notice=cancelled`);
}
