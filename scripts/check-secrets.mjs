import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';

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
  // `git ls-files --cached` includes paths deleted in the working tree until
  // the deletion is staged. Secret scanning must still work before commit.
  if (!existsSync(file)) continue;
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.env.example')) {
    failures.push(file);
    continue;
  }
  if (!statSync(file).isFile() || statSync(file).size > 2_000_000) continue;
  const content = readFileSync(file, 'utf8');
  if (patterns.some((pattern) => pattern.test(content))) failures.push(file);
}

const historicalObjects = execFileSync(
  'git',
  ['rev-list', '--objects', '--all'],
  { encoding: 'utf8' },
)
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const separator = line.indexOf(' ');
    return {
      id: separator === -1 ? line : line.slice(0, separator),
      path: separator === -1 ? '' : line.slice(separator + 1),
    };
  });
const objectPath = new Map(
  historicalObjects
    .filter(({ path }) => path)
    .map(({ id, path }) => [id, path]),
);
for (const { path } of historicalObjects) {
  if (
    path &&
    /(^|\/)\.env(?:\.|$)/.test(path) &&
    !path.endsWith('.env.example')
  )
    failures.push(`history:${path}`);
}
const uniqueIds = [...new Set(historicalObjects.map(({ id }) => id))];
const batch = spawnSync(
  'git',
  ['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'],
  { encoding: 'utf8', input: `${uniqueIds.join('\n')}\n` },
);
if (batch.status !== 0) throw new Error('Unable to inspect Git history.');
for (const line of batch.stdout.trim().split('\n')) {
  const [id, type, sizeText] = line.split(' ');
  if (!id || type !== 'blob' || Number(sizeText) > 2_000_000) continue;
  const content = execFileSync('git', ['cat-file', 'blob', id], {
    encoding: 'utf8',
    maxBuffer: 2_100_000,
  });
  if (patterns.some((pattern) => pattern.test(content)))
    failures.push(`history:${objectPath.get(id) ?? 'unresolved-blob'}`);
}
if (failures.length) {
  console.error(`Potential secrets in: ${[...new Set(failures)].join(', ')}`);
  process.exitCode = 1;
} else
  console.log(
    'No known credential patterns or tracked env files found in the working tree or reachable Git history.',
  );
