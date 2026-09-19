import { timingSafeEqual } from 'node:crypto';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/env/server';

function matches(value: string | null, expected: string): boolean {
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const env = getServerEnv();
  if (
    !['preview', 'staging'].includes(env.APP_ENV) ||
    !env.OBSERVABILITY_PROBE_SECRET
  )
    return new NextResponse(null, { status: 404 });
  if (
    !matches(
      request.headers.get('x-flyco-observability-probe'),
      env.OBSERVABILITY_PROBE_SECRET,
    )
  )
    return new NextResponse(null, { status: 404 });
  const eventId = Sentry.captureException(
    new Error('Flyco safe staging observability probe'),
  );
  await Sentry.flush(2_000);
  return NextResponse.json({ captured: Boolean(eventId) });
}
