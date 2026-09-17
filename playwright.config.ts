import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const target = new URL(baseURL);
// A URL supplied by a workflow operator is not proof of deployment ownership.
// Keep this smoke runner credential-free until Phase 0B verifies project + SHA.
if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
  throw new Error(
    'Credentialed preview tests require the Phase 0B deployment verifier.',
  );
}
if (
  process.env.E2E_BASE_URL &&
  (target.protocol !== 'https:' ||
    !target.hostname.endsWith('.vercel.app') ||
    target.username ||
    target.password ||
    target.port ||
    target.search ||
    target.hash ||
    target.pathname !== '/')
) {
  throw new Error(
    'Remote foundation E2E requires an explicit Vercel preview URL.',
  );
}
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'pnpm start --hostname 127.0.0.1',
          url: baseURL,
          reuseExistingServer: false,
          timeout: 60_000,
        },
      }),
});
