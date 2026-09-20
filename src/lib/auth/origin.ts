import 'server-only';
import { headers } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';
import { isTrustedActionRequest } from './origin-core';

export async function assertTrustedServerActionOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const env = getServerEnv();
  if (!env.APP_URL) throw new Error('Invalid request origin.');
  const host =
    process.env.VERCEL === '1'
      ? requestHeaders.get('x-forwarded-host')
      : requestHeaders.get('host');
  if (
    !isTrustedActionRequest({
      expectedOrigin: env.APP_URL,
      host,
      origin: requestHeaders.get('origin'),
    })
  )
    throw new Error('Invalid request origin.');
}
