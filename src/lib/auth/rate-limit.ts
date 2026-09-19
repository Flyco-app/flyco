import 'server-only';
import { authFingerprint, trustedClientIp } from './rate-limit-core';
import { headers } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type AuthRateLimitOperation =
  'signup' | 'login' | 'recovery' | 'email_change' | 'confirmation';

export async function enforceAuthRateLimit(
  operation: AuthRateLimitOperation,
  accountOrToken?: { kind: 'account' | 'token'; value: string },
) {
  const env = getServerEnv();
  if (!env.AUTH_RATE_LIMIT_HMAC_SECRET) {
    if (env.APP_ENV === 'local') return;
    throw new Error('Hosted authentication rate limiting is not configured.');
  }
  const requestHeaders = await headers();
  const ip = trustedClientIp({
    appEnv: env.APP_ENV,
    forwardedFor: requestHeaders.get('x-forwarded-for'),
    localTestIp: requestHeaders.get('x-flyco-test-ip'),
  });
  if (!ip) throw new Error('Trusted client IP is unavailable.');
  const keys = [authFingerprint(env.AUTH_RATE_LIMIT_HMAC_SECRET, 'ip', ip)];
  if (accountOrToken)
    keys.push(
      authFingerprint(
        env.AUTH_RATE_LIMIT_HMAC_SECRET,
        accountOrToken.kind,
        accountOrToken.value,
      ),
    );
  const client = await createSupabaseServerClient();
  for (const keyHash of keys) {
    const { data, error } = await client.rpc('consume_auth_rate_limit', {
      operation,
      key_hash: keyHash,
    });
    if (error) throw new Error('Authentication rate limiter unavailable.');
    if (data !== true) throw new AuthRateLimitExceeded();
  }
}

export class AuthRateLimitExceeded extends Error {
  constructor() {
    super('Authentication request rate limited.');
    this.name = 'AuthRateLimitExceeded';
  }
}
