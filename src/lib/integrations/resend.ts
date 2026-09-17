import 'server-only';
import { Resend } from 'resend';
import { getServerEnv } from '@/lib/env/server';

export function createResendClient() {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL)
    throw new Error('Resend is not configured.');
  return new Resend(env.RESEND_API_KEY);
}
