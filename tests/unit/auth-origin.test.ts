import { describe, expect, it } from 'vitest';
import { isTrustedActionRequest } from '@/lib/auth/origin-core';

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
