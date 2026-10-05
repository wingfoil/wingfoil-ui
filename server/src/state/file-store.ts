/**
 * The file adapter of the local-state store (spec-006 §1, §4): `state.json` in the state
 * directory (mode 0700, file 0600 on POSIX), atomic writes through `state.json.tmp-<pid>-<n>` +
 * fsync + rename, an unparsable or schema-invalid file kept as `state.json.corrupt-<UTC>` (never
 * deleted), a file from a newer build read for the known fields and never written back. Every
 * re-read → write runs under the advisory lock `state.json.lock`, so two consoles never lose each
 * other's changes.
 */
import { randomUUID } from 'node:crypto';
import { access, mkdir, open, readdir, readFile, rename, rm, stat, utimes } from 'node:fs/promises';
import { hostname } from 'node:os';
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
  /** Age after which a lock not refreshed by its holder is stale (default {@link LOCK_STALE_MS}). */
  lockStaleMs?: number;
  /** Platform whose file-system rules apply (default: the process's; injected by tests). */
  platform?: NodeJS.Platform;
}

const POSIX = process.platform !== 'win32';

/** Name of the advisory lock file next to `state.json`. */
export const LOCK_FILE = `${STATE_FILE}.lock`;
/**
 * A lock not refreshed for this long is stale whatever its pid (a crash followed by pid reuse, or
 * a holder on another host). Its holder refreshes it every quarter of this age (heartbeat).
 */
export const LOCK_STALE_MS = 10_000;
/** Transient errors Windows raises while another process holds or scans a file. */
const WIN32_BUSY = new Set(['EPERM', 'EACCES', 'EBUSY']);
/** Tries of a rename that Windows refuses for a moment. */
const RENAME_TRIES = 5;
/** Longest wait for the lock before a mutation fails. */
const LOCK_TIMEOUT_MS = 15_000;
const TMP_PATTERN = /^state\.json\.tmp-(\d+)(?:-\d+)?$/;

/** Counter of the temporary files of this process: two stores in one process never share one. */
let tmpCounter = 0;

/** Whether process `pid` is running (EPERM: running under another user). */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function code(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}

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
  readonly #lockFile: string;
  readonly #now: () => Date;
  readonly #staleMs: number;
  readonly #platform: NodeJS.Platform;

  constructor(dir: string, now: () => Date, staleMs: number, platform: NodeJS.Platform) {
    this.location = dir;
    this.#file = path.join(dir, STATE_FILE);
    this.#lockFile = path.join(dir, LOCK_FILE);
    this.#now = now;
    this.#staleMs = staleMs;
    this.#platform = platform;
  }

  /** Whether the state directory does not exist yet (nothing to lock, nothing written so far). */
  async pristine(): Promise<boolean> {
    return !(await exists(this.location));
  }

  /** Remove the temporary files left by processes that no longer run (killed during a write). */
  async sweep(): Promise<void> {
    const names = await readdir(this.location).catch(() => [] as string[]);
    for (const name of names) {
      const match = TMP_PATTERN.exec(name);
      if (match && !alive(Number(match[1]))) await rm(path.join(this.location, name), { force: true });
    }
  }

  async read(): Promise<ReadOutcome> {
    let text: string;
    try {
      text = await readFile(this.#file, 'utf8');
    } catch (error) {
      if (code(error) === 'ENOENT') return { state: emptyState(), readOnly: false };
      throw new Error(`Cannot read the WingFoil UI state file ${this.#file}: ${(error as Error).message}`, {
        cause: error,
      });
    }
    let data: unknown;
    try {
      // A byte-order mark (an editor's) is not part of the JSON text.
      data = JSON.parse(text.replace(/^\uFEFF/, ''));
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
      if (code(error) === 'ENOENT') return this.read();
      throw error;
    }
    return { state: emptyState(), readOnly: false, warning: { key: 'state.corruptKept', args: { file: kept } } };
  }

  async write(state: StateFile): Promise<void> {
    await mkdir(this.location, { recursive: true, mode: 0o700 });
    const tmp = path.join(this.location, `${STATE_FILE}.tmp-${process.pid}-${tmpCounter++}`);
    try {
      // A file left under this name must not lend its mode: start from a new one (0600).
      await rm(tmp, { force: true });
      const handle = await open(tmp, 'wx', 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await this.#rename(tmp, this.#file);
    } catch (error) {
      await rm(tmp, { force: true });
      throw error;
    }
    if (POSIX) await this.#syncDirectory();
  }

  /** `rename`, retried a few times when Windows refuses it for a moment (antivirus, indexer). */
  async #rename(from: string, to: string): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await rename(from, to);
        return;
      } catch (error) {
        if (!this.#busy(error) || attempt >= RENAME_TRIES) throw error;
        await delay(20 * attempt);
      }
    }
  }

  /** A transient refusal on Windows (another process holds or scans the file). */
  #busy(error: unknown): boolean {
    return this.#platform === 'win32' && WIN32_BUSY.has(code(error) ?? '');
  }

  async lock<T>(fn: () => Promise<T>): Promise<T> {
    await mkdir(this.location, { recursive: true, mode: 0o700 });
    const token = `${hostname()} ${process.pid} ${randomUUID()}`;
    await this.#acquire(token);
    // Heartbeat: a slow holder keeps its lock fresh, so it is never judged stale while alive.
    const heartbeat = setInterval(() => {
      const now = new Date();
      void utimes(this.#lockFile, now, now).catch(() => undefined);
    }, this.#staleMs / 4);
    heartbeat.unref();
    try {
      return await fn();
    } finally {
      clearInterval(heartbeat);
      await this.#release(token);
    }
  }

  async #acquire(token: string): Promise<void> {
    const started = Date.now();
    for (let wait = 5; ; wait = Math.min(wait * 2, 100)) {
      try {
        const handle = await open(this.#lockFile, 'wx', 0o600);
        try {
          await handle.writeFile(token, 'utf8');
        } finally {
          await handle.close();
        }
        return;
      } catch (error) {
        if (this.#busy(error)) {
          // Windows: the lock is being created or removed by another process right now.
          if (Date.now() - started > LOCK_TIMEOUT_MS) throw error;
          await delay(wait);
          continue;
        }
        if (code(error) !== 'EEXIST') throw error;
      }
      if (await this.#breakIfStale()) continue;
      if (Date.now() - started > LOCK_TIMEOUT_MS) {
        throw new Error(`The WingFoil UI state lock ${this.#lockFile} is held by another process`);
      }
      await delay(wait + Math.floor(Math.random() * wait));
    }
  }

  /** Remove the lock when its holder (on this host) is dead or it was not refreshed for the stale age. */
  async #breakIfStale(): Promise<boolean> {
    let holder: string;
    let age: number;
    try {
      holder = await readFile(this.#lockFile, 'utf8');
      age = Date.now() - (await stat(this.#lockFile)).mtimeMs;
    } catch (error) {
      if (code(error) === 'ENOENT') return true; // released meanwhile: try again at once
      if (this.#busy(error)) return true; // win32: being deleted by its holder: try again
      throw error;
    }
    // `<hostname> <pid> <nonce>`: the pid is judged only on this host; elsewhere only the age
    // since the holder's last heartbeat counts. An empty file is a lock being written right now.
    const [host, pidText] = holder.split(' ');
    const pid = Number(pidText);
    const dead = host === hostname() && Number.isInteger(pid) && pid > 0 && !alive(pid);
    if (!dead && age <= this.#staleMs) return false;
    // Remove it only if it is still the lock judged stale (a narrow race is left: see the notes).
    if ((await readFile(this.#lockFile, 'utf8').catch(() => undefined)) === holder) {
      await rm(this.#lockFile, { force: true });
    }
    return true;
  }

  async #release(token: string): Promise<void> {
    if ((await readFile(this.#lockFile, 'utf8').catch(() => undefined)) === token) {
      await rm(this.#lockFile, { force: true });
    }
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
export async function openFileStateStore(options: FileStoreOptions): Promise<StateStore> {
  const { dir, lockStaleMs, platform, ...rest } = options;
  const backend = new FileBackend(
    dir,
    rest.now ?? (() => new Date()),
    lockStaleMs ?? LOCK_STALE_MS,
    platform ?? process.platform,
  );
  await backend.sweep();
  return openStore(backend, rest);
}
