import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const status = z
  .object({
    API_URL: z.literal('http://127.0.0.1:55321'),
    DB_URL: z.string(),
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
const traveler = member(),
  senderA = member(),
  senderB = member(),
  other = member(),
  anonymous = member();
const users = [],
  requestIds = [],
  bookingIds = [];
let tripId;
const password = `P4ssword-${randomUUID()}`;
const origin = '20000000-0000-4000-8000-000000000001',
  destination = '20000000-0000-4000-8000-000000000004';
const departure = new Date(Date.now() + 10 * 86_400_000),
  arrival = new Date(departure.getTime() + 4 * 3_600_000);

try {
  for (const [client, label] of [
    [traveler, 'traveler'],
    [senderA, 'sender-a'],
    [senderB, 'sender-b'],
    [other, 'other'],
  ]) {
    const created = await admin.auth.admin.createUser({
      email: `booking-api-${label}-${randomUUID()}@example.invalid`,
      password,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    users.push(created.data.user);
    assert.equal(
      (
        await client.auth.signInWithPassword({
          email: created.data.user.email,
          password,
        })
      ).error,
      null,
    );
    assert.equal(
      (
        await client.from('profiles').insert({
          id: created.data.user.id,
          display_name: `Booking ${label}`,
          locale: 'en',
        })
      ).error,
      null,
    );
  }
  const trip = await traveler.rpc('create_trip_draft', {
    input_origin: origin,
    input_destination: destination,
    input_departure: departure.toISOString(),
    input_arrival: arrival.toISOString(),
    input_capacity_grams: 5000,
    input_category_codes: ['documents'],
  });
  assert.equal(trip.error, null);
  tripId = trip.data;
  assert.equal(
    (
      await traveler.rpc('publish_trip', {
        input_trip_id: tripId,
        input_expected_version: 1,
      })
    ).error,
    null,
  );
  for (const [client, label] of [
    [senderA, 'A'],
    [senderB, 'B'],
  ]) {
    const request = await client.rpc('create_delivery_request_draft', {
      input_origin: origin,
      input_destination: destination,
      input_earliest_departure: departure.toISOString(),
      input_latest_delivery: arrival.toISOString(),
      input_category_code: 'documents',
      input_title: `Contracts ${label}`,
      input_description: 'A sealed envelope containing signed contracts.',
      input_declared_contents: 'Two signed paper contracts',
      input_weight_grams: 3000,
      input_length_mm: null,
      input_width_mm: null,
      input_height_mm: null,
      input_quantity: 1,
      input_fragile: false,
      input_handling_notes: null,
    });
    assert.equal(request.error, null);
    requestIds.push(request.data);
    assert.equal(
      (
        await client.rpc('publish_delivery_request', {
          input_request_id: request.data,
          input_expected_version: 1,
          input_policy_acknowledged: true,
        })
      ).error,
      null,
    );
    const matches = await client.rpc('get_delivery_request_matches', {
      input_request_id: request.data,
      input_limit: 25,
      input_offset: 0,
    });
    assert.equal(matches.error, null);
    assert.equal(matches.data.length, 1);
    const proposal = await client.rpc('propose_booking', {
      input_match_id: matches.data[0].match_id,
      input_idempotency_key: randomUUID(),
    });
    assert.equal(proposal.error, null);
    bookingIds.push(proposal.data[0].booking_id);
  }
  const conversation = await senderA.rpc('get_booking_conversation', {
    input_booking_id: bookingIds[0],
  });
  assert.equal(conversation.error, null);
  assert.match(conversation.data, /^[0-9a-f-]{36}$/);
  assert.equal(
    (
      await other.rpc('get_conversation', {
        input_conversation_id: conversation.data,
      })
    ).data.length,
    0,
  );
  const sent = await senderA.rpc('send_conversation_message', {
    input_conversation_id: conversation.data,
    input_body: '<script>alert(1)</script> Please confirm the sealed envelope.',
  });
  assert.equal(sent.error, null);
  const reply = await traveler.rpc('send_conversation_message', {
    input_conversation_id: conversation.data,
    input_body: 'I can review it before accepting.',
  });
  assert.equal(reply.error, null);
  const history = await senderA.rpc('get_conversation_messages', {
    input_conversation_id: conversation.data,
    input_limit: 50,
    input_before: null,
    input_before_id: null,
  });
  assert.equal(history.error, null);
  assert.equal(history.data.length, 2);
  assert.equal(
    history.data[1].body,
    '<script>alert(1)</script> Please confirm the sealed envelope.',
  );
  assert.equal((await other.from('messages').select('*')).error?.code, '42501');
  const report = await senderA.rpc('submit_safety_report', {
    input_booking_id: bookingIds[0],
    input_conversation_id: conversation.data,
    input_reported_user_id: users[0].id,
    input_reported_message_id: reply.data[0].message_id,
    input_reason_code: 'inappropriate_content',
    input_description:
      'This synthetic report verifies private evidence references.',
  });
  assert.equal(report.error, null);
  assert.equal(
    (await traveler.from('safety_reports').select('*')).error?.code,
    '42501',
  );
  for (let index = 0; index < 4; index += 1) {
    assert.equal(
      (
        await senderA.rpc('send_conversation_message', {
          input_conversation_id: conversation.data,
          input_body: `Synthetic burst message ${index + 1}`,
        })
      ).error,
      null,
    );
  }
  assert.match(
    (
      await senderA.rpc('send_conversation_message', {
        input_conversation_id: conversation.data,
        input_body: 'This sixth burst message must be throttled.',
      })
    ).error?.message,
    /rate limit/,
  );
  assert.equal(
    (
      await other.rpc('submit_safety_report', {
        input_booking_id: bookingIds[0],
        input_conversation_id: conversation.data,
        input_reported_user_id: users[0].id,
        input_reported_message_id: null,
        input_reason_code: 'other',
        input_description:
          'Unrelated users must not submit interaction reports.',
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (
      await anonymous.rpc('get_my_bookings', {
        input_limit: 25,
        input_offset: 0,
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (await other.rpc('get_booking', { input_booking_id: bookingIds[0] })).data
      .length,
    0,
  );
  assert.equal(
    (await senderA.from('bookings').select('*')).error?.code,
    '42501',
  );
  assert.equal(
    (
      await senderA.from('capacity_reservations').insert({
        booking_id: bookingIds[0],
        trip_id: tripId,
        capacity_grams: 1,
      })
    ).error?.code,
    '42501',
  );

  const [first, second] = await Promise.all([
    traveler.rpc('accept_booking', {
      input_booking_id: bookingIds[0],
      input_expected_version: 1,
      input_idempotency_key: randomUUID(),
      input_policy_acknowledged: true,
    }),
    traveler.rpc('accept_booking', {
      input_booking_id: bookingIds[1],
      input_expected_version: 1,
      input_idempotency_key: randomUUID(),
      input_policy_acknowledged: true,
    }),
  ]);
  const outcomes = [first, second];
  assert.equal(outcomes.filter((result) => result.error === null).length, 1);
  assert.equal(outcomes.filter((result) => result.error !== null).length, 1);
  assert.match(
    outcomes.find((result) => result.error)?.error.message,
    /capacity|opportunity/,
  );
  const winner = first.error === null ? 0 : 1,
    loser = winner === 0 ? 1 : 0;
  const winnerClient = winner === 0 ? senderA : senderB;
  const winnerDetail = await winnerClient.rpc('get_booking', {
    input_booking_id: bookingIds[winner],
  });
  assert.equal(winnerDetail.data[0].available_capacity_grams, 2000);
  const cancel = await winnerClient.rpc('cancel_booking', {
    input_booking_id: bookingIds[winner],
    input_expected_version: 2,
    input_idempotency_key: randomUUID(),
    input_reason: 'Synthetic release verification',
  });
  assert.equal(cancel.error, null);
  const winnerConversation = await winnerClient.rpc(
    'get_booking_conversation',
    {
      input_booking_id: bookingIds[winner],
    },
  );
  assert.equal(winnerConversation.error, null);
  assert.match(
    (
      await winnerClient.rpc('send_conversation_message', {
        input_conversation_id: winnerConversation.data,
        input_body: 'Terminal bookings must reject new messages.',
      })
    ).error?.message,
    /messaging is closed/,
  );
  assert.ok(
    (
      await winnerClient.rpc('get_conversation_messages', {
        input_conversation_id: winnerConversation.data,
        input_limit: 50,
        input_before: null,
        input_before_id: null,
      })
    ).data,
  );
  const loserClient = loser === 0 ? senderA : senderB;
  const rematch = await loserClient.rpc('get_delivery_request_matches', {
    input_request_id: requestIds[loser],
    input_limit: 25,
    input_offset: 0,
  });
  assert.equal(rematch.error, null);
  assert.equal(rematch.data.length, 1);
  console.log(
    'PASS: booking Data API isolation, atomic oversubscription denial, release and match reactivation checks.',
  );
} finally {
  if (tripId)
    execFileSync(
      'psql',
      [status.DB_URL, '-v', 'ON_ERROR_STOP=1', '-v', `trip_id=${tripId}`],
      {
        input:
          "delete from public.conversation_events where conversation_id in (select id from public.conversations where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid));",
        stdio: ['pipe', 'ignore', 'ignore'],
      },
    );
  if (tripId)
    execFileSync(
      'psql',
      [status.DB_URL, '-v', 'ON_ERROR_STOP=1', '-v', `trip_id=${tripId}`],
      {
        input:
          "delete from public.notification_outbox where recipient_id in(select id from public.profiles where display_name like 'Booking %') or resource_id in(select id from public.bookings where trip_id=:'trip_id'::uuid) or resource_id in(select id from public.conversations where booking_id in(select id from public.bookings where trip_id=:'trip_id'::uuid)); delete from public.safety_report_events where report_id in (select id from public.safety_reports where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid)); delete from public.safety_reports where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid); delete from private.message_rate_limits where key_id in (select id from public.conversations where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid)) or key_id in (select sender_id from public.conversations where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid)) or key_id in (select traveler_id from public.conversations where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid)); delete from public.messages where conversation_id in (select id from public.conversations where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid)); delete from public.conversation_participants where conversation_id in (select id from public.conversations where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid)); delete from public.conversations where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid); delete from public.policy_acknowledgements where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid) or delivery_request_id in (select id from public.delivery_requests where owner_id in (select id from public.profiles where display_name like 'Booking sender-%')); delete from public.booking_command_receipts where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid); delete from public.booking_events where booking_id in (select id from public.bookings where trip_id=:'trip_id'::uuid); delete from public.capacity_reservations where trip_id=:'trip_id'::uuid; delete from public.bookings where trip_id=:'trip_id'::uuid; delete from public.matches where trip_id=:'trip_id'::uuid; delete from public.delivery_request_events where delivery_request_id in (select id from public.delivery_requests where owner_id in (select id from public.profiles where display_name like 'Booking sender-%')); delete from public.declared_items where delivery_request_id in (select id from public.delivery_requests where owner_id in (select id from public.profiles where display_name like 'Booking sender-%')); delete from public.delivery_requests where owner_id in (select id from public.profiles where display_name like 'Booking sender-%'); delete from public.trip_events where trip_id=:'trip_id'::uuid; delete from public.trip_categories where trip_id=:'trip_id'::uuid; delete from public.trips where id=:'trip_id'::uuid;",
        stdio: ['pipe', 'ignore', 'ignore'],
      },
    );
  for (const user of users) {
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error) throw new Error('Local booking test cleanup failed.');
  }
}
