// The versions every runner script prints first. No dependency: manifest.mjs runs before npm ci.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository these scripts belong to (two folders above scripts/lib). */
const SCRIPTS_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The line every runner script prints first: the runner's version (scripts/runner/VERSION) and the
 * WingFoil package it finds from its repository (`wingfoil`, else the pinned alias `wingfoil-released`).
 */
export function versionLine(repo = SCRIPTS_REPO) {
  let runner = 'unknown';
  try { runner = readFileSync(join(repo, 'scripts/runner/VERSION'), 'utf8').trim(); } catch { /* not a runner checkout */ }
  const require = createRequire(join(repo, 'package.json'));
  for (const name of ['wingfoil', 'wingfoil-released']) {
    try {
      const pkg = JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8'));
      return `runner ${runner} · wingfoil ${pkg.version}${name === 'wingfoil' ? '' : ` (${name})`}`;
    } catch { /* try the next name */ }
  }
  return `runner ${runner} · wingfoil not found`;
}

/** Whether a line is the one versionLine prints, so that a check's reason skips it. */
export const VERSION_LINE = /^runner \S+ · wingfoil /;
