import { describe, expect, it } from 'vitest';
import {
  isTrustedActionRequest,
  vercelPreviewOrigin,
} from '@/lib/auth/origin-core';

describe('Server Action origin checks', () => {
  const expectedOrigin = 'https://preview.flyco.site';

  it('accepts the exact application origin and host', () => {
    expect(
      isTrustedActionRequest({
        expectedOrigin,
        origin: expectedOrigin,
        host: 'preview.flyco.site',
      }),
    ).toBe(true);
  });

  it.each([
    ['https://evil.example', 'preview.flyco.site'],
    ['https://preview.flyco.site.evil.example', 'preview.flyco.site'],
    ['https://preview.flyco.site/path', 'preview.flyco.site'],
    ['https://preview.flyco.site', 'evil.example'],
    ['https://preview.flyco.site', 'preview.flyco.site, evil.example'],
    [null, 'preview.flyco.site'],
    ['https://preview.flyco.site', null],
  ])('rejects mismatched or malformed origin/host pairs', (origin, host) => {
    expect(isTrustedActionRequest({ expectedOrigin, origin, host })).toBe(
      false,
    );
  });
});

describe('Vercel preview origin derivation', () => {
  it('accepts only the exact platform-provided preview hostname', () => {
    expect(
      vercelPreviewOrigin({
        vercel: '1',
        environment: 'preview',
        url: 'flyco-git-example.vercel.app',
      }),
    ).toBe('https://flyco-git-example.vercel.app');
  });

  it.each([
    { vercel: undefined, environment: 'preview', url: 'flyco.vercel.app' },
    { vercel: '1', environment: 'production', url: 'flyco.vercel.app' },
    { vercel: '1', environment: 'preview', url: 'evil.example' },
    { vercel: '1', environment: 'preview', url: 'a..vercel.app' },
    { vercel: '1', environment: 'preview', url: 'FLYCO.vercel.app' },
    {
      vercel: '1',
      environment: 'preview',
      url: 'flyco.vercel.app.attacker.example',
    },
  ])('rejects an untrusted preview origin: %o', (input) => {
    expect(vercelPreviewOrigin(input)).toBeNull();
  });
});
