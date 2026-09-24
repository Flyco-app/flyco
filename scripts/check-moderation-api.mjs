import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const status = z
  .object({
    API_URL: z.literal('http://127.0.0.1:55321'),
    DB_URL: z.string(),
    PUBLISHABLE_KEY: z.string(),
    SECRET_KEY: z.string(),
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
const member = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const forged = createClient(status.API_URL, status.PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const password = `P4ssword-${randomUUID()}`;
const users = [];
const sql = (statement, variables = []) =>
  execFileSync(
    'psql',
    [
      status.DB_URL,
      '-X',
      '-t',
      '-A',
      '-v',
      'ON_ERROR_STOP=1',
      ...variables.flatMap(([key, value]) => ['-v', `${key}=${value}`]),
    ],
    { input: statement, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] },
  );

try {
  for (const [client, label, metadata] of [
    [member, 'staff', {}],
    [forged, 'forged', { role: 'administrator', is_admin: true }],
  ]) {
    const created = await admin.auth.admin.createUser({
      email: `moderation-${label}-${randomUUID()}@example.invalid`,
      password,
      email_confirm: true,
      user_metadata: metadata,
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
          display_name: `Moderation ${label}`,
          locale: 'en',
        })
      ).error,
      null,
    );
  }
  assert.equal(
    (
      await forged.rpc('get_moderation_report_queue', {
        input_limit: 25,
        input_before_created_at: null,
        input_before_id: null,
      })
    ).error?.code,
    '42501',
  );
  assert.equal(
    (await member.from('moderation_decisions').select('*')).error?.code,
    '42501',
  );
  assert.equal(
    (await member.from('notification_outbox').select('*')).error?.code,
    '42501',
  );

  sql(
    "select private.bootstrap_first_administrator(:'staff_id'::uuid,'Local authorization verification');",
    [['staff_id', users[0].id]],
  );
  assert.match(
    (
      await member.rpc('get_moderation_report_queue', {
        input_limit: 25,
        input_before_created_at: null,
        input_before_id: null,
      })
    ).error?.message ?? '',
    /multi-factor/,
  );
  const checked = sql(
    `begin;
    set local role authenticated;
    select set_config('request.jwt.claims',json_build_object('sub',:'staff_id','role','authenticated','aal','aal2')::text,true);
    do $body$ begin
      if not (select is_staff and aal2 from public.get_my_staff_access()) then raise exception 'AAL2 staff access missing'; end if;
      perform * from public.get_moderation_report_queue(25,null,null);
    end $body$;
    rollback; select 'aal2-live-role-ok';`,
    [['staff_id', users[0].id]],
  );
  assert.match(checked, /aal2-live-role-ok/);

  const assignment = sql(
    "select id from private.staff_role_assignments where user_id=:'staff_id'::uuid and revoked_at is null;",
    [['staff_id', users[0].id]],
  )
    .trim()
    .split('\n')
    .at(-1)
    ?.trim();
  assert.match(assignment ?? '', /^[0-9a-f-]{36}$/);
  sql(
    "update private.staff_role_assignments set revoked_at=now(),revoked_by=:'staff_id'::uuid,revoke_reason='Local revocation verification' where id=:'assignment_id'::uuid;",
    [
      ['staff_id', users[0].id],
      ['assignment_id', assignment],
    ],
  );
  const revoked = sql(
    `begin; set local role authenticated; select set_config('request.jwt.claims',json_build_object('sub',:'staff_id','role','authenticated','aal','aal2')::text,true); do $body$ begin perform * from public.get_moderation_report_queue(25,null,null); raise exception 'revoked role unexpectedly authorized'; exception when insufficient_privilege then null; end $body$; rollback; select 'revocation-ok';`,
    [['staff_id', users[0].id]],
  );
  assert.match(revoked, /revocation-ok/);

  const outboxId = randomUUID();
  sql(
    "insert into public.notification_outbox(id,deduplication_key,event_type,recipient_id,resource_type,resource_id,payload) values(:'event_id'::uuid,:'key','account_restricted',:'staff_id'::uuid,'account',:'staff_id'::uuid,'{}');",
    [
      ['event_id', outboxId],
      ['key', `moderation-check:${outboxId}`],
      ['staff_id', users[0].id],
    ],
  );
  const claimed = await admin.rpc('claim_notification_outbox', {
    input_worker_id: 'local-moderation-check',
    input_limit: 1,
  });
  assert.equal(claimed.error, null);
  assert.equal(claimed.data[0].event_id, outboxId);
  assert.equal(
    (
      await admin.rpc('complete_notification_outbox', {
        input_event_id: outboxId,
        input_worker_id: 'local-moderation-check',
        input_success: true,
        input_error_code: null,
      })
    ).error,
    null,
  );
  assert.equal(
    (
      await admin.rpc('claim_notification_outbox', {
        input_worker_id: 'local-moderation-check',
        input_limit: 1,
      })
    ).data.length,
    0,
  );
  console.log(
    'PASS: member isolation, forged metadata denial, MFA enforcement, live role revocation and idempotent outbox claiming.',
  );
} finally {
  if (users.length)
    sql(
      "delete from public.notification_outbox where recipient_id in (:'first'::uuid,:'second'::uuid); delete from public.moderation_audit_events where actor_id in(:'first'::uuid,:'second'::uuid) or target_user_id in(:'first'::uuid,:'second'::uuid); delete from private.staff_role_events where assignment_id in(select id from private.staff_role_assignments where user_id in(:'first'::uuid,:'second'::uuid)); delete from private.staff_role_assignments where user_id in(:'first'::uuid,:'second'::uuid);",
      [
        ['first', users[0]?.id ?? randomUUID()],
        ['second', users[1]?.id ?? randomUUID()],
      ],
    );
  for (const user of users) {
    const result = await admin.auth.admin.deleteUser(user.id);
    if (result.error)
      throw new Error('Local moderation fixture cleanup failed.');
  }
}
