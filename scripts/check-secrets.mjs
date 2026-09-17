import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const patterns = [
  /(?:sk|rk)_live_[A-Za-z0-9]{16,}/,
  /sb_secret_[A-Za-z0-9_-]{16,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /whsec_[A-Za-z0-9]{20,}/,
];
const failures = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) {
    failures.push(file);
    continue;
  }
  if (!statSync(file).isFile() || statSync(file).size > 2_000_000) continue;
  const content = readFileSync(file, 'utf8');
  if (patterns.some((pattern) => pattern.test(content))) failures.push(file);
}
if (failures.length) {
  console.error(`Potential secrets in: ${[...new Set(failures)].join(', ')}`);
  process.exitCode = 1;
} else console.log('No known credential patterns or tracked env files found.');
