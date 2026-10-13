/**
 * Playwright global teardown (bug-004): no console started by the run may survive it. Every
 * console still recorded in the run's directory is killed, and the run fails, naming them. Then
 * the run's temporary root is removed — only when this process owns it (task-026).
 */
import { removeTempRoot, TEMP_ROOT_ENV } from '../../harness/temp-root.js';
import { reapRun, RUN_DIR_ENV } from './reaper.js';

export default function globalTeardown(): void {
  try {
    reapConsoles();
  } finally {
    const root = process.env[TEMP_ROOT_ENV];
    if (root) removeTempRoot(root);
  }
}

function reapConsoles(): void {
  const dir = process.env[RUN_DIR_ENV];
  if (!dir) return;
  const { killed: survivors, unverified } = reapRun(dir);
  if (unverified.length > 0) {
    console.warn(
      `e2e teardown: recorded pid(s) still running but not verifiable, left alone: ${unverified.join(', ')}`,
    );
  }
  if (survivors.length > 0) {
    throw new Error(
      `${survivors.length} console(s) survived the e2e run and were killed: ${survivors
        .map((s) => `${s.pid} ${s.command}`)
        .join('; ')}`,
    );
  }
}
