import { describe, expect, it } from 'vitest';
import { authFingerprint, trustedClientIp } from '@/lib/auth/rate-limit-core';
import {
  confirmationDestination,
  confirmationSchema,
} from '@/lib/auth/confirmation';

describe('hosted auth hardening', () => {
  it('accepts only explicit confirmation types and token hashes', () => {
    expect(
      confirmationSchema.safeParse({
        token_hash: 'a'.repeat(64),
        type: 'signup',
        next: '/en/profile',
      }).success,
    ).toBe(true);
    expect(
      confirmationSchema.safeParse({
        token_hash: 'a'.repeat(64),
        type: 'invite',
        next: '/en/profile',
      }).success,
    ).toBe(false);
  });
  it('rejects arbitrary, protocol-relative and encoded-backslash destinations', () => {
    for (const next of ['https://evil.test', '//evil.test', '/%5c%5cevil.test'])
      expect(confirmationDestination('signup', next).path).toBe('/fr/profile');
    expect(
      confirmationDestination('signup', '/en/profile?next=//evil.test').path,
    ).toBe('/en/profile');
    expect(confirmationDestination('recovery', '/ar/new-password')).toEqual({
      locale: 'ar',
      path: '/ar/new-password',
    });
  });
  it('trusts only one valid Vercel-overwritten IP and rejects forwarded chains', () => {
    expect(
      trustedClientIp({ appEnv: 'staging', forwardedFor: '203.0.113.10' }),
    ).toBe('203.0.113.10');
    expect(
      trustedClientIp({
        appEnv: 'staging',
        forwardedFor: '203.0.113.10, 10.0.0.1',
      }),
    ).toBeNull();
    expect(
      trustedClientIp({ appEnv: 'staging', forwardedFor: 'not-an-ip' }),
    ).toBeNull();
  });
  it('uses domain-separated non-reversible fingerprints', () => {
    const secret = 'x'.repeat(32);
    expect(authFingerprint(secret, 'ip', 'same')).toMatch(/^[a-f0-9]{64}$/);
    expect(authFingerprint(secret, 'ip', 'same')).not.toBe(
      authFingerprint(secret, 'account', 'same'),
    );
  });
});
