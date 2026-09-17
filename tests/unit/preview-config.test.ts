import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('refuses to send bypass credentials even to a plausible Vercel hostname', async () => {
  vi.stubEnv('E2E_BASE_URL', 'https://untrusted.vercel.app');
  vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'fixture-secret');
  await expect(import('../../playwright.config')).rejects.toThrow(
    'deployment verifier',
  );
});
it.each([
  'https://example.invalid',
  'https://user:secret@preview.vercel.app',
  'https://preview.vercel.app/?token=fixture',
])('rejects unsafe smoke target %s', async (target) => {
  vi.stubEnv('E2E_BASE_URL', target);
  vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', undefined);
  await expect(import('../../playwright.config')).rejects.toThrow(
    'explicit Vercel preview URL',
  );
});
it('allows credential-free preview smoke checks without secret headers', async () => {
  vi.stubEnv('E2E_BASE_URL', 'https://preview.vercel.app');
  vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', undefined);
  const { default: config } = await import('../../playwright.config');
  expect(config.use?.extraHTTPHeaders).toBeUndefined();
  expect(config.webServer).toBeUndefined();
});
