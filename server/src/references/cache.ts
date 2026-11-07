/**
 * The reuse of element values across repository states (spec-012 §8, a contract; task-055 D55-6):
 * the values of an element file kept per `(path, blob id)` by the project's snapshot. A file's
 * values are **reused** when it is not in the state's working-tree status and its blob at HEAD is
 * the kept one; they are **stored** only when the file is not in the status **and** the bytes read
 * hash to the blob at HEAD — so values read from a modified file (racy, `assume-unchanged`,
 * `skip-worktree`, a clean filter, a converted line end) serve their own state only, and a reverted
 * edit gives the committed values back. Without the HEAD listing nothing is reused or stored.
 */
import { createHash } from 'node:crypto';
import type { MemoryMatch } from '@wingfoil-ui/contracts';
import type { ValueSource } from './build.js';
import type { FileValues } from './index.js';

/** A git object format. */
export type ObjectFormat = 'sha1' | 'sha256';

/** What the index's read of one file gives: its text and its values. */
export interface IndexRead {
  text: string;
  values: FileValues;
}

/** The git blob id of `text` (its UTF-8 bytes), as `git hash-object` computes it. */
export function gitBlobId(text: string, format: ObjectFormat): string {
  const bytes = Buffer.from(text, 'utf8');
  return createHash(format).update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

interface Entry {
  blob: string;
  id: string;
  type: string;
  status: string;
  values: FileValues;
}

/** What a {@link ReferenceValueCache.source} needs of one state. */
export interface StateFiles {
  /** Path (relative to the project root) → blob at HEAD; `undefined`: not known (no reuse, no store). */
  blobs: ReadonlyMap<string, string> | undefined;
  /** The paths in the state's working-tree status. */
  changed: ReadonlySet<string>;
  format: ObjectFormat;
  /** The index's read of one file (rejects with a direct-read error). */
  read(match: MemoryMatch): Promise<IndexRead>;
}

/** The values kept across states, by path. */
export class ReferenceValueCache {
  private readonly entries = new Map<string, Entry>();

  /** Entries kept. */
  get size(): number {
    return this.entries.size;
  }

  /** Drop the entries of paths not in `listed`. */
  prune(listed: ReadonlySet<string>): void {
    for (const p of this.entries.keys()) if (!listed.has(p)) this.entries.delete(p);
  }

  /** The value source of one state. */
  source(state: StateFiles): ValueSource {
    return {
      values: async (match) => {
        const blob = state.blobs?.get(match.path);
        const clean = blob !== undefined && !state.changed.has(match.path);
        const kept = this.entries.get(match.path);
        if (
          clean &&
          kept?.blob === blob &&
          kept.id === match.id &&
          kept.type === match.type &&
          kept.status === match.status
        ) {
          return kept.values;
        }
        const read = await state.read(match);
        if (clean && gitBlobId(read.text, state.format) === blob) {
          this.entries.set(match.path, {
            blob,
            id: match.id,
            type: match.type,
            status: match.status,
            values: read.values,
          });
        }
        return read.values;
      },
    };
  }
}
