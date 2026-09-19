import { describe, expect, it } from 'vitest';
import { parseServerEnv } from '@/lib/env/schema';

describe('environment isolation', () => {
  it('boots the provider-free foundation without credentials', () => {
    expect(parseServerEnv({}).APP_ENV).toBe('local');
  });
  it('normalizes empty optional fields', () => {
    expect(parseServerEnv({ SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined();
  });
  it.each(['preview', 'staging', 'local'])(
    'rejects live Stripe keys in %s',
    (APP_ENV) => {
      expect(() =>
        parseServerEnv({
          APP_ENV,
          APP_URL: 'https://preview.example.invalid',
          STRIPE_SECRET_KEY: 'rk_live_fixture',
        }),
      ).toThrow('STRIPE_SECRET_KEY');
    },
  );
  it('rejects test Stripe in production', () => {
    expect(() =>
      parseServerEnv({
        APP_ENV: 'production',
        APP_URL: 'https://example.invalid',
        STRIPE_SECRET_KEY: 'rk_test_fixture',
      }),
    ).toThrow('STRIPE_SECRET_KEY');
  });
  it('accepts a production-shaped configuration without contacting providers', () => {
    expect(
      parseServerEnv({
        APP_ENV: 'production',
        APP_URL: 'https://example.invalid',
      }).APP_ENV,
    ).toBe('production');
  });
  it('requires HTTPS on hosted environments', () => {
    expect(() => parseServerEnv({ APP_ENV: 'preview' })).toThrow('APP_URL');
    expect(() =>
      parseServerEnv({ APP_ENV: 'preview', APP_URL: 'http://example.invalid' }),
    ).toThrow('APP_URL');
  });
  it('requires paired provider configuration', () => {
    expect(() =>
      parseServerEnv({ SUPABASE_URL: 'http://127.0.0.1:55321' }),
    ).toThrow('SUPABASE_URL');
    expect(() => parseServerEnv({ RESEND_API_KEY: 're_fixture' })).toThrow(
      'RESEND_API_KEY',
    );
  });
  it('rejects remote databases for local development', () => {
    expect(() =>
      parseServerEnv({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
      }),
    ).toThrow('SUPABASE_URL');
    expect(
      parseServerEnv({
        SUPABASE_URL: 'http://127.0.0.1:55321',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
      }).SUPABASE_URL,
    ).toBe('http://127.0.0.1:55321');
  });
  it('never includes rejected credential values in errors', () => {
    const credential = 'sensitive-invalid-value';
    try {
      parseServerEnv({ STRIPE_SECRET_KEY: credential });
      expect.fail('must reject invalid credentials');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(String(error)).not.toContain(credential);
    }
  });
});

it('handles the blank template and rejects implicit hosted local mode', () => {
  expect(parseServerEnv({ APP_ENV: '' }).APP_ENV).toBe('local');
  expect(() => parseServerEnv({ VERCEL: '1' })).toThrow('APP_ENV');
});
it.each([
  ['staging', 'mcmeroatheonlgxvveyl'],
  ['production', 'xivkbucvwsioxevlijzj'],
  ['preview', 'mcmeroatheonlgxvveyl'],
])('rejects the wrong project for %s', (APP_ENV, ref) => {
  expect(() =>
    parseServerEnv({
      APP_ENV,
      APP_URL: 'https://example.invalid',
      SUPABASE_URL: `https://${ref}.supabase.co`,
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    }),
  ).toThrow('SUPABASE_URL');
});
it.each([
  ['staging', 'xivkbucvwsioxevlijzj'],
  ['production', 'mcmeroatheonlgxvveyl'],
  ['preview', 'isolated-fixture-branch'],
  ['preview', 'xivkbucvwsioxevlijzj'],
])('accepts the designated %s project', (APP_ENV, ref) => {
  expect(
    parseServerEnv({
      APP_ENV,
      APP_URL: 'https://example.invalid',
      SUPABASE_URL: `https://${ref}.supabase.co`,
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    }).APP_ENV,
  ).toBe(APP_ENV);
});
it('can use the provider-generated preview hostname without inventing a URL', () => {
  expect(
    parseServerEnv({
      VERCEL: '1',
      APP_ENV: 'preview',
      VERCEL_URL: 'flyco-commit-team.vercel.app',
    }).APP_URL,
  ).toBe('https://flyco-commit-team.vercel.app');
  expect(() =>
    parseServerEnv({
      VERCEL: '1',
      APP_ENV: 'preview',
      VERCEL_URL: 'attacker.invalid/path',
    }),
  ).toThrow('APP_URL');
});

it.each(['sb_secret_fixture', 'legacy-jwt-fixture'])(
  'rejects privileged or legacy Supabase keys: %s',
  (key) => {
    expect(() =>
      parseServerEnv({
        SUPABASE_URL: 'http://127.0.0.1:55321',
        SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toThrow('SUPABASE_PUBLISHABLE_KEY');
  },
);

it.each([
  'ftp://127.0.0.1',
  'http://user:secret@127.0.0.1',
  'http://127.0.0.1/path',
  'http://127.0.0.1?token=secret',
])('rejects malformed service origins: %s', (SUPABASE_URL) => {
  expect(() =>
    parseServerEnv({
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    }),
  ).toThrow('SUPABASE_URL');
});
it.each([
  ['preview', 'production'],
  ['production', 'staging'],
])('rejects a %s deployment labeled %s', (VERCEL_ENV, APP_ENV) => {
  expect(() =>
    parseServerEnv({
      VERCEL: '1',
      VERCEL_ENV,
      APP_ENV,
      APP_URL: 'https://example.invalid',
    }),
  ).toThrow('deployment target');
});
