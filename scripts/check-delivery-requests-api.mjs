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
const restricted = member();
const anonymous = member();
const password = `P4ssword-${randomUUID()}`;
const userIds = [];
let requestId;
let restrictedRequestId;
const future = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const draftInput = {
  input_origin: '20000000-0000-4000-8000-000000000001',
  input_destination: '20000000-0000-4000-8000-000000000004',
  input_earliest_departure: future(10),
  input_latest_delivery: future(14),
  input_category_code: 'documents',
  input_title: 'Signed documents',
  input_description: 'A sealed envelope containing signed contracts.',
  input_declared_contents: 'Two signed paper contracts',
  input_weight_grams: 1250,
  input_length_mm: 255,
  input_width_mm: 180,
  input_height_mm: 25,
  input_quantity: 1,
  input_fragile: false,
  input_handling_notes: null,
};
try {
  for (const [client, label] of [
    [owner, 'owner'],
    [other, 'other'],
    [restricted, 'restricted'],
  ]) {
    const created = await admin.auth.admin.createUser({
      email: `request-api-${label}-${randomUUID()}@example.invalid`,
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
      display_name: `Request ${label}`,
      locale: 'en',
    });
    assert.equal(profile.error, null);
  }
  const created = await owner.rpc('create_delivery_request_draft', draftInput);
  assert.equal(created.error, null);
  assert.ok(created.data);
  requestId = created.data;
  assert.equal(
    (await owner.from('delivery_requests').select('id').eq('id', requestId))
      .data?.length,
    1,
  );
  assert.equal(
    (await other.from('delivery_requests').select('id').eq('id', requestId))
      .data?.length,
    0,
  );
  assert.equal(
    (await anonymous.from('delivery_requests').select('id')).error?.code,
    '42501',
  );
  assert.equal(
    (
      await owner
        .from('delivery_requests')
        .update({ status: 'published' })
        .eq('id', requestId)
    ).error?.code,
    '42501',
  );
  assert.ok(
    (
      await other.rpc('cancel_delivery_request', {
        input_request_id: requestId,
        input_expected_version: 1,
        input_reason: 'Not mine',
      })
    ).error,
  );
  const published = await owner.rpc('publish_delivery_request', {
    input_request_id: requestId,
    input_expected_version: 1,
    input_policy_acknowledged: true,
  });
  assert.equal(published.error, null);
  assert.equal(published.data, 2);
  const publicRequest = await anonymous.rpc('get_public_delivery_request', {
    input_request_id: requestId,
  });
  assert.equal(publicRequest.error, null);
  assert.equal(publicRequest.data.length, 1);
  assert.deepEqual(Object.keys(publicRequest.data[0]).sort(), [
    'category_code',
    'destination_location_id',
    'earliest_departure_at',
    'fragile',
    'height_mm',
    'id',
    'latest_delivery_at',
    'length_mm',
    'origin_location_id',
    'owner_id',
    'quantity',
    'status',
    'title',
    'weight_grams',
    'width_mm',
  ]);
  assert.ok(!('declared_contents' in publicRequest.data[0]));
  assert.ok(!('storage_path' in publicRequest.data[0]));
  assert.equal(
    (
      await owner.rpc('update_delivery_request', {
        ...draftInput,
        input_request_id: requestId,
        input_expected_version: 1,
      })
    ).error?.code,
    '40001',
  );

  const begun = await owner.rpc('begin_item_photo_upload', {
    input_request_id: requestId,
    input_expected_version: 2,
    input_mime_type: 'image/jpeg',
    input_size_bytes: 4,
  });
  assert.equal(begun.error, null);
  const reservation = begun.data[0];
  assert.ok(reservation.storage_path.startsWith(`${userIds[0]}/`));
  assert.ok(
    (
      await other.storage.from('item-photos').upload(
        reservation.storage_path,
        new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], {
          type: 'image/jpeg',
        }),
        { contentType: 'image/jpeg' },
      )
    ).error,
  );
  assert.ok(
    (
      await owner.storage.from('item-photos').upload(
        `${userIds[0]}/${randomUUID()}/${randomUUID()}.jpg`,
        new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], {
          type: 'image/jpeg',
        }),
        { contentType: 'image/jpeg' },
      )
    ).error,
  );
  const uploaded = await owner.storage.from('item-photos').upload(
    reservation.storage_path,
    new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])], {
      type: 'image/jpeg',
    }),
    { contentType: 'image/jpeg', upsert: false },
  );
  assert.equal(uploaded.error, null);
  const finalized = await owner.rpc('finalize_item_photo_upload', {
    input_photo_id: reservation.photo_id,
    input_expected_version: reservation.request_version,
  });
  assert.equal(finalized.error, null);
  assert.equal(finalized.data, 4);
  assert.ok(
    (
      await other.storage
        .from('item-photos')
        .createSignedUrl(reservation.storage_path, 60)
    ).error,
  );
  assert.equal((await other.from('item_photos').select('*')).data?.length, 0);
  const ownSigned = await owner.storage
    .from('item-photos')
    .createSignedUrl(reservation.storage_path, 60);
  assert.equal(ownSigned.error, null);
  const removed = await owner.rpc('remove_item_photo', {
    input_photo_id: reservation.photo_id,
    input_expected_version: 4,
  });
  assert.equal(removed.error, null);
  assert.equal(removed.data[0].request_version, 5);
  assert.equal(
    (await owner.storage.from('item-photos').remove([reservation.storage_path]))
      .error,
    null,
  );
  const cancelled = await owner.rpc('cancel_delivery_request', {
    input_request_id: requestId,
    input_expected_version: 5,
    input_reason: 'Synthetic API cleanup',
  });
  assert.equal(cancelled.error, null);
  assert.equal(
    (
      await anonymous.rpc('get_public_delivery_request', {
        input_request_id: requestId,
      })
    ).data?.length,
    0,
  );

  const restrictedDraft = await restricted.rpc(
    'create_delivery_request_draft',
    draftInput,
  );
  assert.equal(restrictedDraft.error, null);
  restrictedRequestId = restrictedDraft.data;
  execFileSync(
    'psql',
    [status.DB_URL, '-v', 'ON_ERROR_STOP=1', '-v', `user_id=${userIds[2]}`],
    {
      input:
        "update public.profiles set account_status='restricted' where id=:'user_id'::uuid;",
      stdio: ['pipe', 'ignore', 'ignore'],
    },
  );
  assert.equal(
    (
      await restricted.rpc('publish_delivery_request', {
        input_request_id: restrictedRequestId,
        input_expected_version: 1,
        input_policy_acknowledged: true,
      })
    ).error?.code,
    '42501',
  );
  console.log(
    'PASS: delivery request Data API, concurrency, public projection and private Storage authorization checks.',
  );
} finally {
  for (const id of [requestId, restrictedRequestId].filter(Boolean)) {
    execFileSync(
      'psql',
      [status.DB_URL, '-v', 'ON_ERROR_STOP=1', '-v', `request_id=${id}`],
      {
        input:
          "delete from public.policy_acknowledgements where delivery_request_id=:'request_id'::uuid; delete from public.delivery_request_events where delivery_request_id=:'request_id'::uuid; delete from public.delivery_request_cancellations where delivery_request_id=:'request_id'::uuid; delete from public.item_photos where item_id in (select id from public.declared_items where delivery_request_id=:'request_id'::uuid); delete from public.declared_items where delivery_request_id=:'request_id'::uuid; delete from public.delivery_requests where id=:'request_id'::uuid;",
        stdio: ['pipe', 'ignore', 'ignore'],
      },
    );
  }
  for (const id of userIds) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Local request test cleanup failed.');
  }
}
