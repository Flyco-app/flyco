import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const status = z
  .object({
    API_URL: z.literal('http://127.0.0.1:55321'),
    DB_URL: z.literal(
      'postgresql://postgres:postgres@127.0.0.1:55322/postgres',
    ),
    PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
    SECRET_KEY: z.string().startsWith('sb_secret_'),
  })
  .parse(
    JSON.parse(
      execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ),
  );

const admin = createClient(status.API_URL, status.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const member = () =>
  createClient(status.API_URL, status.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const traveler = member();
const sender = member();
const other = member();
const anonymous = member();
const password = `P4ssword-${randomUUID()}`;
const users = [];
let tripId;
let requestId;

const origin = '20000000-0000-4000-8000-000000000001';
const destination = '20000000-0000-4000-8000-000000000004';
const departure = new Date(Date.now() + 10 * 86_400_000);
const arrival = new Date(departure.getTime() + 4 * 3_600_000);

try {
  for (const [client, label] of [
    [traveler, 'traveler'],
    [sender, 'sender'],
    [other, 'other'],
  ]) {
    const created = await admin.auth.admin.createUser({
      email: `match-api-${label}-${randomUUID()}@example.invalid`,
      password,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    assert.ok(created.data.user);
    users.push(created.data.user);
    const signed = await client.auth.signInWithPassword({
      email: created.data.user.email,
      password,
    });
    assert.equal(signed.error, null);
    const profile = await client.from('profiles').insert({
      id: created.data.user.id,
      display_name: `Match ${label}`,
      locale: 'en',
    });
    assert.equal(profile.error, null);
  }

  const trip = await traveler.rpc('create_trip_draft', {
    input_origin: origin,
    input_destination: destination,
    input_departure: departure.toISOString(),
    input_arrival: arrival.toISOString(),
    input_capacity_grams: 2000,
    input_category_codes: ['documents'],
  });
  assert.equal(trip.error, null);
  tripId = trip.data;
  assert.ok(tripId);
  assert.equal(
    (
      await traveler.rpc('publish_trip', {
        input_trip_id: tripId,
        input_expected_version: 1,
      })
    ).error,
    null,
  );

  const request = await sender.rpc('create_delivery_request_draft', {
    input_origin: origin,
    input_destination: destination,
    input_earliest_departure: departure.toISOString(),
    input_latest_delivery: arrival.toISOString(),
    input_category_code: 'documents',
    input_title: 'Signed contracts',
    input_description: 'A sealed envelope containing signed contracts.',
    input_declared_contents: 'Two signed paper contracts',
    input_weight_grams: 2000,
    input_length_mm: null,
    input_width_mm: null,
    input_height_mm: null,
    input_quantity: 1,
    input_fragile: false,
    input_handling_notes: null,
  });
  assert.equal(request.error, null);
  requestId = request.data;
  assert.ok(requestId);
  assert.equal(
    (
      await sender.rpc('publish_delivery_request', {
        input_request_id: requestId,
        input_expected_version: 1,
        input_policy_acknowledged: true,
      })
    ).error,
    null,
  );

  const travelerMatches = await traveler.rpc('get_trip_matches', {
    input_trip_id: tripId,
    input_limit: 25,
    input_offset: 0,
  });
  assert.equal(travelerMatches.error, null);
  assert.equal(travelerMatches.data.length, 1);
  assert.equal(travelerMatches.data[0].delivery_request_id, requestId);
  assert.equal(travelerMatches.data[0].algorithm_version, 'v1');
  assert.equal(travelerMatches.data[0].capacity_slack_grams, 0);
  assert.deepEqual(travelerMatches.data[0].reason_codes, [
    'exact_route',
    'date_window_fit',
    'category_accepted',
    'capacity_sufficient',
  ]);
  assert.ok(!('declared_contents' in travelerMatches.data[0]));
  assert.ok(!('sender_phone' in travelerMatches.data[0]));
  assert.ok(!('storage_path' in travelerMatches.data[0]));

  const senderMatches = await sender.rpc('get_delivery_request_matches', {
    input_request_id: requestId,
    input_limit: 25,
    input_offset: 0,
  });
  assert.equal(senderMatches.error, null);
  assert.equal(senderMatches.data.length, 1);
  assert.equal(senderMatches.data[0].trip_id, tripId);

  assert.equal(
    (
      await other.rpc('get_trip_matches', {
        input_trip_id: tripId,
        input_limit: 25,
        input_offset: 0,
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (
      await anonymous.rpc('get_trip_matches', {
        input_trip_id: tripId,
        input_limit: 25,
        input_offset: 0,
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (await traveler.from('matches').select('*')).error?.code,
    '42501',
  );
  assert.equal(
    (
      await traveler.from('matches').insert({
        trip_id: tripId,
        delivery_request_id: requestId,
        algorithm_version: 'v99',
        trip_version: 1,
        request_version: 1,
        date_slack_minutes: 0,
        capacity_slack_grams: 0,
        score: 999999999,
        reason_codes: [
          'exact_route',
          'date_window_fit',
          'category_accepted',
          'capacity_sufficient',
        ],
      })
    ).error?.code,
    '42501',
  );

  const cancelled = await traveler.rpc('cancel_trip', {
    input_trip_id: tripId,
    input_expected_version: 2,
    input_reason: 'Synthetic matching invalidation check',
  });
  assert.equal(cancelled.error, null);
  assert.equal(
    (
      await sender.rpc('get_delivery_request_matches', {
        input_request_id: requestId,
        input_limit: 25,
        input_offset: 0,
      })
    ).data.length,
    0,
  );

  console.log(
    'PASS: matching Data API ownership, projection privacy, forgery denial and invalidation checks.',
  );
} finally {
  if (tripId || requestId) {
    execFileSync(
      'psql',
      [
        status.DB_URL,
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        `trip_id=${tripId ?? '00000000-0000-0000-0000-000000000000'}`,
        '-v',
        `request_id=${requestId ?? '00000000-0000-0000-0000-000000000000'}`,
      ],
      {
        input:
          "delete from public.policy_acknowledgements where delivery_request_id=:'request_id'::uuid; delete from public.matches where trip_id=:'trip_id'::uuid or delivery_request_id=:'request_id'::uuid; delete from public.trip_events where trip_id=:'trip_id'::uuid; delete from public.trip_cancellations where trip_id=:'trip_id'::uuid; delete from public.trip_categories where trip_id=:'trip_id'::uuid; delete from public.trips where id=:'trip_id'::uuid; delete from public.delivery_request_events where delivery_request_id=:'request_id'::uuid; delete from public.delivery_request_cancellations where delivery_request_id=:'request_id'::uuid; delete from public.declared_items where delivery_request_id=:'request_id'::uuid; delete from public.delivery_requests where id=:'request_id'::uuid;",
        stdio: ['pipe', 'ignore', 'ignore'],
      },
    );
  }
  for (const user of users) {
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) throw new Error('Local matching test cleanup failed.');
  }
}
