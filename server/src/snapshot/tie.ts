/**
 * The tie of a per-state read to its state check (bug-034, task-075 D75-4, D75-5; spec-012 §8 and
 * spec-004 §5 amended 2026-11-11). A state's key is computed from git's status, the content marks of
 * the status entries and the mark of `.wingfoil/ui.yaml`; a read made later under that key reads the
 * files again. A file edited, read and reverted before the next check gives the same key back, so a
 * read is kept for its state only when the bytes it consumed are those the state stands for:
 *
 * - a status entry with a `sha:` mark: the SHA-256 of the bytes read (`missing`: still absent);
 * - a file not in the status: its blob at HEAD (`git ls-tree`, the index's listing), compared with the
 *   blob id of the bytes read;
 * - `ui.yaml`: its mark, taken by the same steps as the check's.
 *
 * No comparable mark — a status entry marked by its `lstat` (`stat:`, `link:`, `other:`, `via:`), a
 * file outside the HEAD listing (ignored, resolved through a link), an unreadable HEAD tree — keeps
 * the read as before (declared residual, Q1 (a)). A mismatch that a later check confirms — git's view
 * of the file did not move while its bytes differ from HEAD (`core.autocrlf`, a clean filter,
 * `assume-unchanged`, `skip-worktree`, invalid UTF-8 the read decodes) — is accepted ({@link Suspects}).
 */
import { createHash } from 'node:crypto';
import { gitBlobId, type ObjectFormat } from '../references/cache.js';
import { UI_YAML } from '../reads/ui-yaml.js';

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

const ABSENT = 'absent';
const MISSING = 'missing';

/** The `sha:` mark of `text` as the fingerprint takes it (SHA-256 of its UTF-8 bytes). */
function shaMark(text: string): string {
  return `sha:${createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')}`;
}

/** The mismatch of one report, or `undefined` (tied, or no comparable mark). */
function compare(
  report: ReadReport,
  marks: StateMarks,
  blobs: ReadonlyMap<string, string> | undefined,
  format: ObjectFormat,
): Mismatch | undefined {
  const { path, text } = report;
  const mark = marks.files.get(path);
  if (mark !== undefined) {
    if (mark.startsWith('sha:')) {
      const observed = text === undefined ? ABSENT : shaMark(text);
      return observed === mark ? undefined : { path, observed, expected: mark };
    }
    if (mark === MISSING) return text === undefined ? undefined : { path, observed: 'present', expected: mark };
    return undefined;
  }
  const blob = blobs?.get(path);
  if (blob === undefined) return undefined;
  const observed = text === undefined ? ABSENT : `blob:${gitBlobId(text, format)}`;
  const expected = `blob:${blob}`;
  return observed === expected ? undefined : { path, observed, expected };
}

/**
 * The mismatches of `reports` (direct reads) and `uiMarks` (the marks of the `ui.yaml` reads) against
 * the state's `marks` and its HEAD `blobs` (`undefined`: not readable for this HEAD).
 */
export function mismatches(
  reports: readonly ReadReport[],
  uiMarks: readonly string[],
  marks: StateMarks,
  blobs: ReadonlyMap<string, string> | undefined,
  format: ObjectFormat,
): Mismatch[] {
  const found: Mismatch[] = [];
  for (const report of reports) {
    const mismatch = compare(report, marks, blobs, format);
    if (mismatch) found.push(mismatch);
  }
  for (const observed of uiMarks) {
    if (observed !== marks.ui) found.push({ path: UI_YAML, observed, expected: marks.ui });
  }
  return found;
}

/**
 * The mismatches seen, one per path, with the sequence number of the checks started when each was
 * seen: a later read with the same observed and expected values, under a state whose check started
 * after that, is accepted — that check saw the file as git sees it and found the same state. No fixed
 * cap (task-075 review round 1 F-3: a cap below the files read evicts and re-mismatches them at every
 * build); the snapshot prunes them to the paths of the newest state ({@link Suspects.prune}), so they
 * stay bounded by the files under `.wingfoil/`, the Memory folders and the status entries.
 */
export class Suspects {
  private readonly entries = new Map<string, { observed: string; expected: string; seq: number }>();

  /** Suspects kept. */
  get size(): number {
    return this.entries.size;
  }

  /** Whether `mismatch` was seen before a check that started before the state of `stateSeq`. */
  accepts(mismatch: Mismatch, stateSeq: number): boolean {
    const known = this.entries.get(mismatch.path);
    return (
      known !== undefined &&
      known.observed === mismatch.observed &&
      known.expected === mismatch.expected &&
      stateSeq > known.seq
    );
  }

  /** Keep only the suspects of the paths `keep` accepts (the files the newest state still lists). */
  prune(keep: (path: string) => boolean): void {
    for (const path of [...this.entries.keys()]) if (!keep(path)) this.entries.delete(path);
  }

  /** Record `mismatch`, seen when `seq` checks had started (an earlier one for its path is replaced). */
  record(mismatch: Mismatch, seq: number): void {
    this.entries.delete(mismatch.path);
    this.entries.set(mismatch.path, { observed: mismatch.observed, expected: mismatch.expected, seq });
  }
}
