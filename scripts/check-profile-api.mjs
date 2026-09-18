import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const status = z
  .object({
    API_URL: z.literal('http://127.0.0.1:55321'),
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
const a = member(),
  b = member(),
  anon = member();
const password = `P4ssword-${randomUUID()}`;
const ids = [];
try {
  for (const [client, name] of [
    [a, 'a'],
    [b, 'b'],
  ]) {
    const created = await admin.auth.admin.createUser({
      email: `rls-${name}-${randomUUID()}@example.invalid`,
      password,
      email_confirm: true,
    });
    assert.equal(created.error, null);
    assert.ok(created.data.user);
    ids.push(created.data.user.id);
    const signed = await client.auth.signInWithPassword({
      email: created.data.user.email,
      password,
    });
    assert.equal(signed.error, null);
  }
  const first = await a
    .from('profiles')
    .insert({ id: ids[0], display_name: 'Owner', locale: 'fr' })
    .select()
    .single();
  assert.equal(first.error, null);
  assert.equal(
    (await b.from('profiles').select().eq('id', ids[0])).data?.length,
    0,
  );
  assert.equal((await anon.from('profiles').select()).error?.code, '42501');
  assert.ok(
    (await b.from('profiles').insert({ id: ids[0], display_name: 'Attacker' }))
      .error,
  );
  assert.ok(
    (
      await b
        .from('profiles')
        .update({ display_name: 'Attacker' })
        .eq('id', ids[0])
    ).error === null,
  );
  assert.equal(
    (await a.from('profiles').select('display_name').eq('id', ids[0]).single())
      .data?.display_name,
    'Owner',
  );
  assert.equal(
    (
      await a
        .from('profiles')
        .update({ account_status: 'active' })
        .eq('id', ids[0])
    ).error?.code,
    '42501',
  );
  assert.equal(
    (await a.from('profiles').update({ id: ids[1] }).eq('id', ids[0])).error
      ?.code,
    '42501',
  );
  const own = await a
    .from('profiles')
    .update({ display_name: 'Owner Updated' })
    .eq('id', ids[0])
    .select()
    .single();
  assert.equal(own.error, null);
  assert.equal(own.data?.display_name, 'Owner Updated');
  console.log(
    'PASS: local Data API owner/other/anon profile reads, writes and column privilege checks.',
  );
} finally {
  for (const id of ids) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Local profile test cleanup failed.');
  }
}
