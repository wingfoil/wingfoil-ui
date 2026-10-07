/**
 * Playwright global teardown (bug-004): no console started by the run may survive it. Every
 * console still recorded in the run's directory is killed, and the run fails, naming them.
 */
import { reapRun, RUN_DIR_ENV } from './reaper.js';

export default function globalTeardown(): void {
  const dir = process.env[RUN_DIR_ENV];
  if (!dir) return;
  const survivors = reapRun(dir);
  if (survivors.length > 0) {
    throw new Error(
      `${survivors.length} console(s) survived the e2e run and were killed: ${survivors
        .map((s) => `${s.pid} ${s.command}`)
        .join('; ')}`,
    );
  }
}
