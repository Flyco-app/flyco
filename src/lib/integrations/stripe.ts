import 'server-only';
import Stripe from 'stripe';
import { getServerEnv } from '@/lib/env/server';

export function createStripeClient() {
  const env = getServerEnv();
  if (!env.STRIPE_SECRET_KEY) throw new Error('Stripe is not configured.');
  // SDK pins its matching API version; upgrade SDK and webhook version together.
  return new Stripe(env.STRIPE_SECRET_KEY, {
    maxNetworkRetries: 2,
    timeout: 10_000,
    typescript: true,
  });
}
