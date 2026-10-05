/**
 * The file adapter of the local-state store (spec-006 §1, §4): `state.json` in the state
 * directory (mode 0700, file 0600 on POSIX), atomic writes through `state.json.tmp-<pid>` + fsync +
 * rename, an unparsable or schema-invalid file kept as `state.json.corrupt-<UTC>` (never deleted),
 * a file from a newer build read for the known fields and never written back.
 */
import { access, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import type { StateFile } from '@wingfoil-ui/contracts';
import { asRecord, knownFields, newerVersion, stateProblem } from './schema.js';
import {
  emptyState,
  openStore,
  type ReadOutcome,
  type StateBackend,
  type StateStore,
  type StoreOptions,
} from './store.js';

/** Name of the state file in the state directory. */
export const STATE_FILE = 'state.json';

/** Options of {@link openFileStateStore}. */
export interface FileStoreOptions extends StoreOptions {
  /** The state directory (spec-006 §1, `resolveStateDir`). */
  dir: string;
}

const POSIX = process.platform !== 'win32';

/** `20261005T101530Z`: ISO 8601 basic, UTC, valid in a Windows file name. */
function stamp(date: Date): string {
  return date
    .toISOString()
    .replace(/\.\d+Z$/, 'Z')
    .replace(/[-:]/g, '');
}

async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}

class FileBackend implements StateBackend {
  readonly location: string;
  readonly #file: string;
  readonly #now: () => Date;

  constructor(dir: string, now: () => Date) {
    this.location = dir;
    this.#file = path.join(dir, STATE_FILE);
    this.#now = now;
  }

  async read(): Promise<ReadOutcome> {
    let text: string;
    try {
      text = await readFile(this.#file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: emptyState(), readOnly: false };
      throw error;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return this.#keepCorrupt();
    }
    const version = newerVersion(data);
    if (version !== undefined) {
      // A newer build's list is never moved aside, even when this build cannot read it.
      const state = knownFields(asRecord(data)!, version) ?? { ...emptyState(), version };
      return { state, readOnly: true, warning: { key: 'state.newerVersion', args: {} } };
    }
    if (stateProblem(data) !== undefined) return this.#keepCorrupt();
    return { state: data as StateFile, readOnly: false };
  }

  async #keepCorrupt(): Promise<ReadOutcome> {
    const base = `${this.#file}.corrupt-${stamp(this.#now())}`;
    let kept = base;
    for (let n = 1; await exists(kept); n++) kept = `${base}-${n}`;
    try {
      await rename(this.#file, kept);
    } catch (error) {
      // Another console moved it aside first: read what is there now.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.read();
      throw error;
    }
    return { state: emptyState(), readOnly: false, warning: { key: 'state.corruptKept', args: { file: kept } } };
  }

  async write(state: StateFile): Promise<void> {
    await mkdir(this.location, { recursive: true, mode: 0o700 });
    const tmp = path.join(this.location, `${STATE_FILE}.tmp-${process.pid}`);
    try {
      const handle = await open(tmp, 'w', 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await rename(tmp, this.#file);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
    if (POSIX) await this.#syncDirectory();
  }

  /** Make the rename durable (POSIX); a failure here does not undo the write. */
  async #syncDirectory(): Promise<void> {
    try {
      const handle = await open(this.location, 'r');
      try {
        await handle.sync();
      } finally {
        await handle.close();
      }
    } catch {
      // Some file systems refuse to sync a directory; the file itself is already synced.
    }
  }
}

/** Open the store of the state directory `dir`; the file is read once here. */
export function openFileStateStore(options: FileStoreOptions): Promise<StateStore> {
  const { dir, ...rest } = options;
  return openStore(new FileBackend(dir, rest.now ?? (() => new Date())), rest);
}
