import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Infrastructure smoke only. No app Auth implementation and no remote target.
const statusSchema = z.object({
  API_URL: z.literal('http://127.0.0.1:55321'),
  MAILPIT_URL: z.literal('http://127.0.0.1:55324'),
  PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  SECRET_KEY: z.string().startsWith('sb_secret_'),
});
const messageList = z.object({
  messages: z.array(
    z.object({
      ID: z.string().min(1),
      To: z.array(z.object({ Address: z.string() })),
    }),
  ),
});
const messageBody = z.object({ HTML: z.string(), Text: z.string() });
let status;
try {
  const raw = execFileSync(
    'pnpm',
    ['exec', 'supabase', 'status', '-o', 'json'],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    },
  );
  status = statusSchema.parse(JSON.parse(raw));
} catch {
  throw new Error(
    'Expected Flyco local Auth/email services and modern local keys. Run pnpm db:start:auth.',
  );
}
const localFetch = (input, init) => {
  const target = new URL(
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  assert.equal(
    target.origin,
    status.API_URL,
    'Auth smoke cannot contact remote services',
  );
  return fetch(input, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
};
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: { fetch: localFetch },
};
const user = createClient(status.API_URL, status.PUBLISHABLE_KEY, options);
// This local-only admin client exists solely to delete this script's synthetic fixture.
// It is never imported by src/ or used to perform a user operation.
const cleanup = createClient(status.API_URL, status.SECRET_KEY, options);
const email = `foundation-${randomUUID()}@example.invalid`;
const password = randomBytes(24).toString('base64url');
let fixtureId;
let step = 'signup';
try {
  const signup = await user.auth.signUp({ email, password });
  assert.equal(signup.error, null, 'Local signup failed');
  fixtureId = signup.data.user?.id;
  assert.ok(fixtureId, 'Missing fixture ID');
  assert.equal(
    signup.data.session,
    null,
    'Signup must require email confirmation',
  );
  step = 'unverified login denial';
  const denied = await user.auth.signInWithPassword({ email, password });
  assert.equal(
    denied.error?.code,
    'email_not_confirmed',
    'Unverified login must be denied',
  );
  step = 'local verification email';
  let id;
  for (let attempt = 0; attempt < 20 && !id; attempt++) {
    const response = await fetch(
      `${status.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      { redirect: 'error', signal: AbortSignal.timeout(5000) },
    );
    assert.equal(response.status, 200, 'Local inbox search failed');
    const list = messageList.parse(await response.json());
    id = list.messages.find((mail) =>
      mail.To.some((to) => to.Address === email),
    )?.ID;
    if (!id) await delay(500);
  }
  assert.ok(id, 'Confirmation email not received by local inbox');
  const response = await fetch(
    `${status.MAILPIT_URL}/api/v1/message/${encodeURIComponent(id)}`,
    { redirect: 'error', signal: AbortSignal.timeout(5000) },
  );
  assert.equal(response.status, 200, 'Local email fetch failed');
  const mail = messageBody.parse(await response.json());
  const links =
    `${mail.HTML}\n${mail.Text}`.match(/https?:\/\/[^\s<>"']+/g) ?? [];
  const confirmation = links
    .map((link) => new URL(link.replaceAll('&amp;', '&')))
    .find(
      (link) =>
        link.origin === 'http://127.0.0.1:3000' &&
        link.pathname === '/auth/confirm' &&
        link.searchParams.get('type') === 'signup',
    );
  assert.ok(confirmation, 'Expected local confirmation URL');
  const token = confirmation.searchParams.get('token_hash');
  assert.ok(token, 'Missing confirmation token');
  step = 'email verification';
  const verified = await user.auth.verifyOtp({
    token_hash: token,
    type: 'signup',
  });
  assert.equal(verified.error, null, 'Email verification failed');
  assert.equal(verified.data.user?.id, fixtureId, 'Wrong verified identity');
  step = 'verified login and logout';
  const login = await user.auth.signInWithPassword({ email, password });
  assert.equal(login.error, null, 'Verified login failed');
  assert.ok(login.data.session, 'Verified login has no session');
  const identity = await user.auth.getUser();
  assert.equal(identity.data.user?.id, fixtureId, 'Server identity mismatch');
  assert.equal((await user.auth.signOut()).error, null, 'Logout failed');
  console.log(
    'PASS: local signup, confirmation-required denial, Mailpit email, verification, login, identity and logout.',
  );
} catch {
  // Never print provider objects, email body, passwords, tokens or raw Zod errors.
  process.exitCode = 1;
  console.error(`FAIL: local Auth infrastructure smoke at ${step}.`);
} finally {
  if (fixtureId) {
    const result = await cleanup.auth.admin.deleteUser(fixtureId);
    if (result.error) {
      process.exitCode = 1;
      console.error('FAIL: local synthetic Auth fixture cleanup.');
    } else console.log('PASS: local synthetic Auth fixture removed.');
  }
}
