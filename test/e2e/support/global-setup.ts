/**
 * Playwright global setup: the e2e suites start the real bin, which serves `server/dist` and
 * `web/dist` — both are built once per run here (Vitest's global setup does not cover Playwright):
 * `tsc -b` (contracts, server; web type-checked), then the Vite build and the key-rendering build
 * (`web/dist-keys`, spec-008 §6, served to a page by `openConsole(…, { build: 'keys' })`).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { REPO_ROOT } from '../../harness/cli.js';
import { RUN_DIR_ENV } from './reaper.js';

function node(args: string[], cwd = REPO_ROOT): void {
  execFileSync(process.execPath, args, { cwd, stdio: 'inherit', timeout: 300_000 });
}

export default function globalSetup(): void {
  // The run's record of started consoles, checked by the global teardown (bug-004); the workers
  // inherit the variable.
  process.env[RUN_DIR_ENV] = mkdtempSync(path.join(tmpdir(), 'wfui-e2e-run-'));
  node([path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc'), '-b']);
  const vite = path.join(REPO_ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const web = path.join(REPO_ROOT, 'web');
  node([vite, 'build', '--logLevel', 'warn'], web);
  node([vite, 'build', '--mode', 'keys', '--logLevel', 'warn'], web);
}
