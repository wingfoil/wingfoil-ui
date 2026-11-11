/**
 * The tie of a per-state read to its state check (bug-034, task-075 D75-4, D75-5) — stub of the red
 * step.
 */
import type { ObjectFormat } from '../references/cache.js';

/** A file a read consumed: its project-relative path and the text read (`undefined`: absent). */
export interface ReadReport {
  path: string;
  text: string | undefined;
}

/** What a state check saw, kept with the state. */
export interface StateMarks {
  /** The fingerprint's mark of each status entry under the project, by project-relative path. */
  files: ReadonlyMap<string, string>;
  /** The mark of `.wingfoil/ui.yaml`. */
  ui: string;
  /** The check's sequence number (counted at its start). */
  seq: number;
  /** The watcher's event count read at the check's start. */
  events: number;
}

/** A read whose bytes are not those its state stands for. */
export interface Mismatch {
  path: string;
  observed: string;
  expected: string;
}

/** The mismatches of `reports` and `uiMarks` against `marks` and the HEAD `blobs`. */
export function mismatches(
  _reports: readonly ReadReport[],
  _uiMarks: readonly string[],
  _marks: StateMarks,
  _blobs: ReadonlyMap<string, string> | undefined,
  _format: ObjectFormat,
): Mismatch[] {
  throw new Error('not implemented');
}

/** The mismatches a later check confirmed. */
export class Suspects {
  get size(): number {
    throw new Error('not implemented');
  }

  accepts(_mismatch: Mismatch, _stateSeq: number): boolean {
    throw new Error('not implemented');
  }

  record(_mismatch: Mismatch, _seq: number): void {
    throw new Error('not implemented');
  }
}
