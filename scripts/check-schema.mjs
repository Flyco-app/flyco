import {
  readFileSync,
  mkdirSync,
  mkdtempSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// The design is exercised inside a transaction and always rolled back.
// --local is explicit; there is no remote target option.
const reference = readFileSync('docs/schema.sql', 'utf8');
if (!/commit;\s*$/.test(reference))
  throw new Error(
    'Schema reference must end with a replaceable commit boundary.',
  );
const tests = readFileSync('tests/database/schema.test.sql', 'utf8');
mkdirSync('supabase/.temp', { recursive: true });
const dir = mkdtempSync(join('supabase/.temp', 'schema-check-'));
try {
  const file = join(dir, 'schema.test.sql');
  writeFileSync(
    file,
    reference.replace(/commit;\s*$/, () => `${tests}\nrollback;\n`),
  );
  const result = spawnSync(
    'pnpm',
    ['exec', 'supabase', 'test', 'db', '--local', file],
    { stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
