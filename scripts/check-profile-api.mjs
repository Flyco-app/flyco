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
  const publicCard = await a
    .from('member_profiles')
    .select('id,display_name,bio,residence_location_id')
    .eq('id', ids[0])
    .single();
  assert.equal(publicCard.error, null);
  assert.equal(publicCard.data?.display_name, 'Owner');
  const avatarPath = `${ids[0]}/${randomUUID()}.png`;
  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
  ]);
  const ownAvatar = await a.storage.from('avatars').upload(avatarPath, png, {
    contentType: 'image/png',
    upsert: false,
  });
  assert.equal(ownAvatar.error, null);
  assert.ok(
    (
      await b.storage
        .from('avatars')
        .upload(`${ids[0]}/${randomUUID()}.png`, png, {
          contentType: 'image/png',
        })
    ).error,
  );
  const publicAvatar = a.storage.from('avatars').getPublicUrl(avatarPath);
  assert.equal((await fetch(publicAvatar.data.publicUrl)).status, 200);
  assert.equal(
    (await b.from('profiles').select().eq('id', ids[0])).data?.length,
    0,
  );
  assert.equal(
    (await b.from('member_profiles').select('display_name').eq('id', ids[0]))
      .data?.[0]?.display_name,
    'Owner',
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
  assert.equal(
    (
      await a
        .from('profiles')
        .update({ phone_verified_at: new Date().toISOString() })
        .eq('id', ids[0])
    ).error?.code,
    '42501',
  );
  assert.equal(
    (
      await a
        .from('profile_trust')
        .update({ identity_verified: true })
        .eq('profile_id', ids[0])
    ).error?.code,
    '42501',
  );
  const crossPublicWrite = await b
    .from('member_profiles')
    .update({ display_name: 'Attacker' })
    .eq('id', ids[0]);
  assert.equal(crossPublicWrite.error, null);
  assert.equal(
    (
      await a
        .from('member_profiles')
        .select('display_name')
        .eq('id', ids[0])
        .single()
    ).data?.display_name,
    'Owner',
  );
  assert.equal(
    (await anon.from('member_profiles').select('display_name')).data?.length,
    1,
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
    'PASS: local Data API profile/privacy/trust checks and real Storage owner/public-read checks.',
  );
  assert.equal(
    (await a.storage.from('avatars').remove([avatarPath])).error,
    null,
  );
} finally {
  for (const id of ids) {
    const result = await admin.auth.admin.deleteUser(id);
    if (result.error) throw new Error('Local profile test cleanup failed.');
  }
}
