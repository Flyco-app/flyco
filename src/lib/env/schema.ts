import { z } from 'zod';

const optional = (schema: z.ZodType<string>) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
const url = optional(z.url());
const origin = optional(
  z.url().refine((value) => {
    const parsed = new URL(value);
    return (
      ['http:', 'https:'].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname === '/' &&
      !parsed.search &&
      !parsed.hash
    );
  }),
);
export const serverEnvSchema = z
  .object({
    APP_ENV: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.enum(['local', 'preview', 'staging', 'production']).default('local'),
    ),
    APP_URL: origin,
    SUPABASE_URL: origin,
    SUPABASE_PUBLISHABLE_KEY: optional(
      z.string().regex(/^sb_publishable_[A-Za-z0-9_-]+$/),
    ),
    STRIPE_SECRET_KEY: optional(
      z.string().regex(/^(sk|rk)_(test|live)_[A-Za-z0-9]+$/),
    ),
    STRIPE_WEBHOOK_SECRET: optional(z.string().startsWith('whsec_')),
    RESEND_API_KEY: optional(z.string().startsWith('re_')),
    RESEND_FROM_EMAIL: optional(z.email()),
    SENTRY_DSN: url,
    AUTH_RATE_LIMIT_HMAC_SECRET: optional(z.string().min(32).max(256)),
    OBSERVABILITY_PROBE_SECRET: optional(z.string().min(32).max(256)),
  })
  .superRefine((env, ctx) => {
    if (
      env.APP_ENV !== 'production' &&
      /^(sk|rk)_live_/.test(env.STRIPE_SECRET_KEY ?? '')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message: 'Live Stripe credentials require production.',
      });
    }
    if (
      env.APP_ENV === 'production' &&
      /^(sk|rk)_test_/.test(env.STRIPE_SECRET_KEY ?? '')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['STRIPE_SECRET_KEY'],
        message: 'Production cannot use test credentials.',
      });
    }
    if (env.SUPABASE_URL && env.APP_ENV !== 'local') {
      const host = new URL(env.SUPABASE_URL).hostname;
      const staging = 'xivkbucvwsioxevlijzj.supabase.co';
      const production = 'mcmeroatheonlgxvveyl.supabase.co';
      const invalid =
        new URL(env.SUPABASE_URL).protocol !== 'https:' ||
        (env.APP_ENV === 'staging' && host !== staging) ||
        (env.APP_ENV === 'production' && host !== production) ||
        (env.APP_ENV === 'preview' &&
          (host === production || !host.endsWith('.supabase.co')));
      if (invalid)
        ctx.addIssue({
          code: 'custom',
          path: ['SUPABASE_URL'],
          message: 'Database does not belong to this environment.',
        });
    }
    for (const [a, b] of [
      ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'],
      ['RESEND_API_KEY', 'RESEND_FROM_EMAIL'],
    ] as const) {
      if (Boolean(env[a]) !== Boolean(env[b]))
        ctx.addIssue({
          code: 'custom',
          path: [a],
          message: `Configure ${a} and ${b} together.`,
        });
    }
    if (
      env.APP_ENV !== 'local' &&
      (!env.APP_URL || new URL(env.APP_URL).protocol !== 'https:')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_URL'],
        message: 'Hosted environments require an HTTPS application URL.',
      });
    }
    if (
      env.APP_ENV === 'local' &&
      env.SUPABASE_URL &&
      !['localhost', '127.0.0.1', '[::1]'].includes(
        new URL(env.SUPABASE_URL).hostname,
      )
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_URL'],
        message: 'Local development must use local Supabase.',
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(
  input: Record<string, string | undefined>,
): ServerEnv {
  if (input.VERCEL === '1' && (!input.APP_ENV || input.APP_ENV === 'local'))
    throw new Error('Hosted runtime requires explicit APP_ENV.');
  if (
    input.VERCEL === '1' &&
    ((input.VERCEL_ENV === 'preview' && input.APP_ENV === 'production') ||
      (input.VERCEL_ENV === 'production' && input.APP_ENV !== 'production'))
  )
    throw new Error('APP_ENV conflicts with the Vercel deployment target.');
  const previewURL =
    input.APP_ENV === 'preview' &&
    /^[a-z0-9.-]+\.vercel\.app$/.test(input.VERCEL_URL ?? '')
      ? `https://${input.VERCEL_URL}`
      : undefined;
  const result = serverEnvSchema.safeParse({
    ...input,
    APP_URL: input.APP_URL || previewURL,
  });
  if (!result.success) {
    // Never expose Zod input values or credentials in configuration errors.
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
    ];
    throw new Error(`Invalid environment configuration: ${fields.join(', ')}`);
  }
  return result.data;
}
