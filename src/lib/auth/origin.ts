import 'server-only';
import { headers } from 'next/headers';
import { getServerEnv } from '@/lib/env/server';
import { isTrustedActionRequest, vercelPreviewOrigin } from './origin-core';

export async function assertTrustedServerActionOrigin(): Promise<void> {
  const requestHeaders = await headers();
  const env = getServerEnv();
  if (!env.APP_URL) throw new Error('Invalid request origin.');
  const host =
    process.env.VERCEL === '1'
      ? requestHeaders.get('x-forwarded-host')
      : requestHeaders.get('host');
  const previewOrigin = vercelPreviewOrigin({
    vercel: process.env.VERCEL,
    environment: process.env.VERCEL_ENV,
    url: process.env.VERCEL_URL,
  });
  const trustedOrigins = previewOrigin
    ? [env.APP_URL, previewOrigin]
    : [env.APP_URL];
  const origin = requestHeaders.get('origin');
  if (
    !trustedOrigins.some((expectedOrigin) =>
      isTrustedActionRequest({ expectedOrigin, host, origin }),
    )
  )
    throw new Error('Invalid request origin.');
}
