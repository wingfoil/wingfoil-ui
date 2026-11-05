/**
 * File-system helpers shared by the writers of the state directory (`state.json`, spec-006 §4;
 * the console address files, adr-003 D2).
 */
import { rename } from 'node:fs/promises';

/** Transient errors Windows raises while another process holds or scans a file. */
const WIN32_BUSY = new Set(['EPERM', 'EACCES', 'EBUSY']);
/** Tries of a rename that Windows refuses for a moment. */
const RENAME_TRIES = 5;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Whether `error` is a transient refusal on Windows (another process holds or scans the file). */
export function windowsBusy(error: unknown, platform: NodeJS.Platform): boolean {
  return platform === 'win32' && WIN32_BUSY.has((error as NodeJS.ErrnoException).code ?? '');
}

/** `rename`, retried a few times when Windows refuses it for a moment (antivirus, indexer). */
export async function renameRetrying(from: string, to: string, platform: NodeJS.Platform): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      if (!windowsBusy(error, platform) || attempt >= RENAME_TRIES) throw error;
      await delay(20 * attempt);
    }
  }
}
