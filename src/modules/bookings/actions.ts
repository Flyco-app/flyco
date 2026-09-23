'use server';

import { redirect } from 'next/navigation';
import { assertTrustedServerActionOrigin } from '@/lib/auth/origin';
import { requireActiveAccount } from '@/lib/auth/session';
import { safeLocale } from '@/lib/auth/validation';
import {
  bookingCancellationSchema,
  bookingCommandSchema,
  proposalSchema,
} from './validation';

function fail(locale: ReturnType<typeof safeLocale>, code?: string): never {
  const error =
    code === '40001' ? 'conflict' : code === '42501' ? 'forbidden' : 'failed';
  redirect(`/${locale}/bookings?error=${error}`);
}

export async function proposeBooking(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = proposalSchema.safeParse({
    matchId: form.get('matchId'),
    idempotencyKey: form.get('idempotencyKey'),
  });
  if (!parsed.success) fail(locale);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('propose_booking', {
    input_match_id: parsed.data.matchId,
    input_idempotency_key: parsed.data.idempotencyKey,
  });
  const booking = result.data?.[0];
  if (result.error || !booking) fail(locale, result.error?.code);
  redirect(`/${locale}/bookings/${booking.booking_id}?notice=proposed`);
}

async function transition(form: FormData, command: 'accept' | 'reject') {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = bookingCommandSchema.safeParse({
    bookingId: form.get('bookingId'),
    expectedVersion: form.get('expectedVersion'),
    idempotencyKey: form.get('idempotencyKey'),
  });
  if (!parsed.success) fail(locale);
  const { client } = await requireActiveAccount(locale);
  const rpc = command === 'accept' ? 'accept_booking' : 'reject_booking';
  const result = await client.rpc(rpc, {
    input_booking_id: parsed.data.bookingId,
    input_expected_version: parsed.data.expectedVersion,
    input_idempotency_key: parsed.data.idempotencyKey,
  });
  if (result.error) fail(locale, result.error.code);
  redirect(`/${locale}/bookings/${parsed.data.bookingId}?notice=${command}ed`);
}

export async function acceptBooking(form: FormData) {
  return transition(form, 'accept');
}
export async function rejectBooking(form: FormData) {
  return transition(form, 'reject');
}

export async function cancelBooking(form: FormData) {
  await assertTrustedServerActionOrigin();
  const locale = safeLocale(String(form.get('locale') ?? 'fr'));
  const parsed = bookingCancellationSchema.safeParse({
    bookingId: form.get('bookingId'),
    expectedVersion: form.get('expectedVersion'),
    idempotencyKey: form.get('idempotencyKey'),
    reason: form.get('reason'),
  });
  if (!parsed.success) fail(locale);
  const { client } = await requireActiveAccount(locale);
  const result = await client.rpc('cancel_booking', {
    input_booking_id: parsed.data.bookingId,
    input_expected_version: parsed.data.expectedVersion,
    input_idempotency_key: parsed.data.idempotencyKey,
    input_reason: parsed.data.reason,
  });
  if (result.error) fail(locale, result.error.code);
  redirect(`/${locale}/bookings/${parsed.data.bookingId}?notice=cancelled`);
}
