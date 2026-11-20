#!/usr/bin/env node
// The runner's common files, the same in every project (directive runner): MANIFEST.sha256 lists
// each with its hash. `--check` is the bound check `runner-manifest`; `--write` is for the runner's
// own source only. A project's own settings live in config/runner.yaml, which is not listed.
// Usage: node scripts/runner/manifest.mjs --check | --write
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionLine } from '../lib/version.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const COMMON = [
  'scripts/runner/VERSION', 'scripts/runner/lib.mjs', 'scripts/runner/run.mjs', 'scripts/runner/gate.mjs', 'scripts/runner/manifest.mjs',
  'scripts/runner/runner.test.mjs', 'scripts/runner/install-schedule.sh',
  'scripts/runner/systemd/runner@.service', 'scripts/runner/systemd/runner@.timer',
  'scripts/checks/tests.mjs', 'scripts/checks/red-tests-untouched.mjs', 'scripts/checks/commit-trailers.mjs',
  'scripts/checks/ids-unique.mjs', 'scripts/checks/governance-valid.mjs', 'scripts/lib/memory.mjs', 'scripts/lib/version.mjs',
  'scripts/setup/codex-apparmor.sh',
];
/**
 * The machine files: they set up this computer (the schedule, Codex's AppArmor profile), not the
 * project. A project may leave them out of its repository; when present they must match. The
 * runner then finds codex-apparmor.sh through config paths.setup (config/runner.local.yaml).
 */
export const MACHINE = [
  'scripts/runner/install-schedule.sh', 'scripts/runner/systemd/runner@.service', 'scripts/runner/systemd/runner@.timer',
  'scripts/setup/codex-apparmor.sh',
];
console.log(versionLine(REPO));
const file = join(REPO, 'scripts/runner/MANIFEST.sha256');
const hash = (path) => createHash('sha256').update(readFileSync(join(REPO, path))).digest('hex');
if (process.argv.includes('--write')) {
  writeFileSync(file, COMMON.map((path) => `${hash(path)}  ${path}${MACHINE.includes(path) ? '  machine' : ''}`).join('\n') + '\n');
  console.log(`${COMMON.length} files in ${file}`);
} else {
  const left = [];
  const problems = readFileSync(file, 'utf8').trim().split('\n').flatMap((row) => {
    const [sum, path, kind] = row.split(/\s+/);
    if (!existsSync(join(REPO, path))) {
      if (kind === 'machine') { left.push(path); return []; }
      return [`${path} is missing`];
    }
    return hash(path) === sum ? [] : [`${path} differs from the common runner`];
  });
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  const out = left.length ? `, ${left.length} machine file(s) left out: ${left.join(', ')}` : '';
  console.log(`ok: runner ${readFileSync(join(REPO, 'scripts/runner/VERSION'), 'utf8').trim()}, the ${COMMON.length - left.length} common files match the manifest${out}`);
}
