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
const owner = member();
const other = member();
const anonymous = member();
const password = `P4ssword-${randomUUID()}`;
const userIds = [];
let tripId;
try {
  for (const [client, label] of [
    [owner, 'owner'],
    [other, 'other'],
  ]) {
    const created = await admin.auth.admin.createUser({
      email: `trip-api-${label}-${randomUUID()}@example.invalid`,
      password,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    assert.ok(created.data.user);
    userIds.push(created.data.user.id);
    const signed = await client.auth.signInWithPassword({
      email: created.data.user.email,
      password,
    });
    assert.equal(signed.error, null);
    const profile = await client.from('profiles').insert({
      id: created.data.user.id,
      display_name: `Trip ${label}`,
      locale: 'en',
    });
    assert.equal(profile.error, null);
  }
  const departure = new Date(Date.now() + 10 * 86_400_000).toISOString();
  const arrival = new Date(
    Date.now() + 10 * 86_400_000 + 14_400_000,
  ).toISOString();
  const created = await owner.rpc('create_trip_draft', {
    input_origin: '20000000-0000-4000-8000-000000000001',
    input_destination: '20000000-0000-4000-8000-000000000004',
    input_departure: departure,
    input_arrival: arrival,
    input_capacity_grams: 5000,
    input_category_codes: ['documents', 'clothing'],
  });
  assert.equal(created.error, null);
  assert.ok(created.data);
  tripId = created.data;
  assert.equal(
    (await owner.from('trips').select('id').eq('id', tripId)).data?.length,
    1,
  );
  assert.equal(
    (await other.from('trips').select('id').eq('id', tripId)).data?.length,
    0,
  );
  assert.equal(
    (await anonymous.from('trips').select('id').eq('id', tripId)).error?.code,
    '42501',
  );
  assert.ok(
    (
      await other.from('trips').insert({
        owner_id: userIds[0],
        origin_location_id: '20000000-0000-4000-8000-000000000001',
        destination_location_id: '20000000-0000-4000-8000-000000000004',
        departure_at: departure,
        arrival_at: arrival,
        capacity_grams: 1000,
      })
    ).error,
  );
  assert.equal(
    (await owner.from('trips').update({ status: 'published' }).eq('id', tripId))
      .error?.code,
    '42501',
  );
  assert.ok(
    (
      await other.rpc('cancel_trip', {
        input_trip_id: tripId,
        input_expected_version: 1,
        input_reason: 'Unauthorized cancellation',
      })
    ).error,
  );
  const published = await owner.rpc('publish_trip', {
    input_trip_id: tripId,
    input_expected_version: 1,
  });
  assert.equal(published.error, null);
  assert.equal(published.data, 2);
  const publicTrip = await anonymous.rpc('get_public_trip', {
    input_trip_id: tripId,
  });
  assert.equal(publicTrip.error, null);
  assert.equal(publicTrip.data.length, 1);
  assert.deepEqual(Object.keys(publicTrip.data[0]).sort(), [
    'arrival_at',
    'capacity_grams',
    'category_codes',
    'departure_at',
    'destination_location_id',
    'id',
    'origin_location_id',
    'owner_id',
    'status',
  ]);
  assert.ok((await anonymous.from('trip_cancellations').select('*')).error);
  assert.ok(
    (
      await owner.rpc('update_trip', {
        input_trip_id: tripId,
        input_expected_version: 1,
        input_origin: '20000000-0000-4000-8000-000000000001',
        input_destination: '20000000-0000-4000-8000-000000000004',
        input_departure: departure,
        input_arrival: arrival,
        input_capacity_grams: 6000,
        input_category_codes: ['documents'],
      })
    ).error?.code === '40001',
  );
  const updated = await owner.rpc('update_trip', {
    input_trip_id: tripId,
    input_expected_version: 2,
    input_origin: '20000000-0000-4000-8000-000000000001',
    input_destination: '20000000-0000-4000-8000-000000000004',
    input_departure: departure,
    input_arrival: arrival,
    input_capacity_grams: 6000,
    input_category_codes: ['documents'],
  });
  assert.equal(updated.error, null);
  assert.equal(updated.data, 3);
  const cancelled = await owner.rpc('cancel_trip', {
    input_trip_id: tripId,
    input_expected_version: 3,
    input_reason: 'Synthetic API test cleanup',
  });
  assert.equal(cancelled.error, null);
  assert.equal(
    (
      await anonymous.rpc('get_public_trip', {
        input_trip_id: tripId,
      })
    ).data?.length,
    0,
  );
  console.log(
    'PASS: direct Data API trip ownership, public projection, transition and concurrency checks.',
  );
} finally {
  if (tripId) {
    execFileSync(
      'psql',
      [status.DB_URL, '-v', 'ON_ERROR_STOP=1', '-v', `trip_id=${tripId}`],
      {
        input:
          "delete from public.trip_events where trip_id = :'trip_id'::uuid; delete from public.trip_cancellations where trip_id = :'trip_id'::uuid; delete from public.trip_categories where trip_id = :'trip_id'::uuid; delete from public.trips where id = :'trip_id'::uuid;",
        stdio: ['pipe', 'ignore', 'ignore'],
      },
    );
  }
  for (const id of userIds) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Local trip test cleanup failed.');
  }
}
