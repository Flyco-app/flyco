import { execFileSync, spawnSync } from 'node:child_process';
import { z } from 'zod';
const statusSchema = z.object({
  API_URL: z.literal('http://127.0.0.1:55321'),
  MAILPIT_URL: z.literal('http://127.0.0.1:55324'),
  PUBLISHABLE_KEY: z.string().startsWith('sb_publishable_'),
  SECRET_KEY: z.string().startsWith('sb_secret_'),
});
const status = statusSchema.parse(
  JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }),
  ),
);
const env = {
  ...process.env,
  APP_ENV: 'local',
  APP_URL: 'http://127.0.0.1:3000',
  SUPABASE_URL: status.API_URL,
  SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  E2E_AUTH_LOCAL: '1',
  E2E_MAILPIT_URL: status.MAILPIT_URL,
  E2E_LOCAL_SECRET_KEY: status.SECRET_KEY,
};
const first = process.argv.includes('--check') ? 'check' : 'build';
for (const args of [[first], ['test:e2e']]) {
  const result = spawnSync('pnpm', args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
