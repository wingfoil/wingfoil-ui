/**
 * The console address file (adr-003 D1–D5, spec-006 §1, §4): each running console keeps
 * `consoles/<port>.json` in the state directory, so that scripts and agents find it without the
 * token. Written atomically after listening and before the URL line, refreshed by a heartbeat
 * every 10 s, removed at stop and at any process exit; stale files of dead consoles are removed at
 * start. Nothing is written or read through a symbolic link, no read blocks on a FIFO, and a
 * failure is a log warning (a reason and an error code, never a path), never a failed start.
 */
import { closeSync, constants, fstatSync, openSync, readSync, unlinkSync } from 'node:fs';
import { lstat, mkdir, open, readdir, rm, stat, unlink, type FileHandle } from 'node:fs/promises';
import { hostname } from 'node:os';
import path from 'node:path';
import type { ConsoleAddressFile } from '@wingfoil-ui/contracts';
import { renameRetrying } from './fs-atomic.js';

/** The folder of the address files in the state directory. */
export const CONSOLES_DIR = 'consoles';
/** Interval of the heartbeat that refreshes (or restores) a console's own file. */
export const ADDRESS_HEARTBEAT_MS = 10_000;
/** A file not refreshed for this long is stale (three missed heartbeats). */
export const ADDRESS_STALE_MS = 30_000;
/** Largest file read from `consoles/` (an address file is about 200 bytes). */
export const ADDRESS_MAX_BYTES = 4096;

/** Why no address file was written, refreshed or removed (the `reason` of the warning). */
export type AddressWarning =
  | 'state-dir-unsafe'
  | 'consoles-link'
  | 'consoles-not-directory'
  | 'consoles-not-owned'
  | 'housekeeping-failed'
  | 'write-failed'
  | 'heartbeat-failed'
  | 'remove-failed';

/** The log lines of the address file (a pino logger fits). */
export interface AddressLogger {
  info(fields: object, msg: string): void;
  warn(fields: object, msg: string): void;
}

/** Options of {@link publishConsoleAddress}. */
export interface ConsoleAddressOptions {
  /** The state directory (spec-006 §1). */
  stateDir: string;
  /** The port the console listens on. */
  port: number;
  /** Whether the port came from `--port`. */
  portFixed: boolean;
  /** The package version. */
  version: string;
  /** When the console started listening. */
  started: Date;
  logger: AddressLogger;
  /** Platform whose file-system rules apply (default: the process's). */
  platform?: NodeJS.Platform;
  /** Interval of the heartbeat (default {@link ADDRESS_HEARTBEAT_MS}; tests). */
  heartbeatMs?: number;
}

/** A published (or refused) address file. */
export interface ConsoleAddress {
  /** The file's path. */
  readonly file: string;
  /** Resolves once the start's housekeeping and first write are over: `true` when written. */
  readonly written: Promise<boolean>;
  /** Resolves once no heartbeat tick is running (tests). */
  settled(): Promise<void>;
  /** Stop the heartbeat and remove the file if it still is this console's; never rejects. */
  stop(): Promise<void>;
  /** The exit handler's removal: synchronous, best-effort, never throws. */
  removeSync(): void;
}

/** What a file of `consoles/` says about its writer, when readable. */
export interface AddressInfo {
  host?: unknown;
  pid?: unknown;
}

/** The stat fields the directory checks judge. */
export interface DirectoryStats {
  uid: number;
  mode: number;
}

const POSIX_FLAGS = {
  noFollow: constants.O_NOFOLLOW ?? 0,
  nonBlock: constants.O_NONBLOCK ?? 0,
  directory: constants.O_DIRECTORY ?? 0,
};
const ADDRESS_NAME = /^(\d+)\.json$/;
const TMP_NAME = /^\d+\.json\.tmp-(\d+)-\d+$/;
const WARNING = 'console address file';

/** Temporary files of this process: two publishers in one process never share one. */
let tmpCounter = 0;

/**
 * The `started` of the live publishers of this process, counted (two may share one): a file with
 * this process's pid and one of them is a live file of this process, never a dead earlier holder
 * of the pid (review round 2). Known exactly in process, with no clock or tolerance involved.
 */
const livePublishers = new Map<string, number>();

function holdStarted(started: string): () => void {
  livePublishers.set(started, (livePublishers.get(started) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (livePublishers.get(started) ?? 1) - 1;
    if (left > 0) livePublishers.set(started, left);
    else livePublishers.delete(started);
  };
}

function code(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException | undefined)?.code;
}

/** Whether process `pid` runs on this host: only `ESRCH` means dead (`EPERM`: another user's). */
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return code(error) !== 'ESRCH';
  }
}

function writer(info: AddressInfo | undefined): { host: string; pid: number } | undefined {
  if (!info || typeof info.host !== 'string' || typeof info.pid !== 'number') return undefined;
  if (!Number.isInteger(info.pid) || info.pid < 1) return undefined;
  return { host: info.host, pid: info.pid };
}

/**
 * The readers' rule (adr-003 D3, D4): stale when not refreshed for 30 s, when its writer is of
 * this host and not running, or when it says nothing readable about its writer.
 */
export function isStaleAddress(info: AddressInfo | undefined, ageMs: number, host: string): boolean {
  const w = writer(info);
  if (!w || ageMs > ADDRESS_STALE_MS) return true;
  return w.host === host && !running(w.pid);
}

/**
 * The start housekeeping's rule (adr-003 D3): a file of this host is removed only when its pid is
 * dead — never by age, a suspended console is alive —; another host's file, or one whose writer
 * cannot be read, only when older than 30 s.
 */
export function removableAtStart(
  info: (AddressInfo & { started?: unknown }) | undefined,
  ageMs: number,
  host: string,
  self?: { pid: number; live: Pick<ReadonlySet<string>, 'has'> },
): boolean {
  const w = writer(info);
  if (w && w.host === host) {
    // Its own pid with a start time no live publisher of this process holds: a dead console whose
    // pid this process now holds (pid reuse, e.g. in a container) — review rounds 1 (F5) and 2.
    if (self && w.pid === self.pid) return typeof info?.started !== 'string' || !self.live.has(info.started);
    return !running(w.pid);
  }
  return ageMs > ADDRESS_STALE_MS;
}

/** The state directory is unsafe when another user owns it or group or others may write in it (POSIX). */
export function stateDirProblem(
  stats: DirectoryStats,
  uid: number | undefined,
  platform: NodeJS.Platform,
): 'state-dir-unsafe' | undefined {
  if (platform === 'win32' || uid === undefined) return undefined;
  return stats.uid !== uid || (stats.mode & 0o022) !== 0 ? 'state-dir-unsafe' : undefined;
}

/** What to do with `consoles/`: use it, set it back to 0700, or not use it (adr-003 D1). */
export function consolesVerdict(
  stats: DirectoryStats & { directory: boolean },
  uid: number | undefined,
  platform: NodeJS.Platform,
): 'ok' | 'chmod' | 'consoles-not-directory' | 'consoles-not-owned' {
  if (!stats.directory) return 'consoles-not-directory';
  if (platform === 'win32' || uid === undefined) return 'ok';
  if (stats.uid !== uid) return 'consoles-not-owned';
  return (stats.mode & 0o077) !== 0 ? 'chmod' : 'ok';
}

/** A regular file of `consoles/`, read without following a link and without blocking. */
interface Entry {
  text: string | undefined;
  mtimeMs: number;
}

/**
 * Open `file` for reading without following a link or blocking; `fn` gets the handle, its text
 * (undefined above {@link ADDRESS_MAX_BYTES}) and its modification time. `undefined` when the file
 * is missing or is not a regular file (a link, a FIFO, a directory).
 */
async function withEntry<T>(
  file: string,
  fn: (handle: FileHandle, entry: Entry) => Promise<T>,
  access: number = constants.O_RDONLY,
): Promise<T | undefined> {
  let handle: FileHandle;
  try {
    handle = await open(file, access | POSIX_FLAGS.noFollow | POSIX_FLAGS.nonBlock);
  } catch (error) {
    if (['ENOENT', 'ELOOP', 'EISDIR', 'ENXIO', 'ENOTDIR'].includes(code(error) ?? '')) return undefined;
    throw error;
  }
  try {
    const info = await handle.stat();
    if (!info.isFile()) return undefined;
    let text: string | undefined;
    if (info.size <= ADDRESS_MAX_BYTES) {
      const buffer = Buffer.alloc(ADDRESS_MAX_BYTES + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      text = bytesRead <= ADDRESS_MAX_BYTES ? buffer.subarray(0, bytesRead).toString('utf8') : undefined;
    }
    return await fn(handle, { text, mtimeMs: info.mtimeMs });
  } finally {
    await handle.close();
  }
}

function parse(text: string | undefined): (AddressInfo & { started?: unknown }) | undefined {
  if (text === undefined) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as AddressInfo & { started?: unknown })
      : undefined;
  } catch {
    return undefined;
  }
}

/** The eight fields of the file (adr-003 D1), and nothing else (D5). */
function addressEntry(options: ConsoleAddressOptions): ConsoleAddressFile {
  return {
    format: 1,
    url: `http://127.0.0.1:${options.port}/`,
    port: options.port,
    portFixed: options.portFixed,
    pid: process.pid,
    host: hostname(),
    started: options.started.toISOString(),
    version: options.version,
  };
}

/**
 * Publish this console's address file: check the state directory and `consoles/`, remove the
 * stale files, write the file, start the heartbeat. Returns at once; `written` says when it is written.
 */
export function publishConsoleAddress(options: ConsoleAddressOptions): ConsoleAddress {
  const platform = options.platform ?? process.platform;
  const posix = platform !== 'win32';
  const uid = posix ? process.getuid?.() : undefined;
  const dir = path.join(options.stateDir, CONSOLES_DIR);
  const file = path.join(dir, `${options.port}.json`);
  const entry = addressEntry(options);
  const release = holdStarted(entry.started);
  const content = `${JSON.stringify(entry, null, 2)}\n`;
  const warned = new Set<AddressWarning>();
  let timer: NodeJS.Timeout | undefined;
  let tick: Promise<void> = Promise.resolve();
  let beating = false;
  let stopped = false;

  const warn = (reason: AddressWarning, error?: unknown): void => {
    const fields = error === undefined ? { reason } : { reason, code: code(error) ?? 'unknown' };
    options.logger.warn(fields, WARNING);
  };

  /** The directory checks of spec-006 §1; `false` when no address file may be written. */
  const prepare = async (): Promise<boolean> => {
    await mkdir(options.stateDir, { recursive: true, mode: 0o700 });
    const state = await stat(options.stateDir);
    if (stateDirProblem(state, uid, platform)) {
      warn('state-dir-unsafe');
      return false;
    }
    try {
      await mkdir(dir, { mode: 0o700 });
    } catch (error) {
      if (code(error) !== 'EEXIST') throw error;
    }
    if (!posix) {
      // Windows: the access list of the state directory applies (A6); only links are refused.
      const info = await lstat(dir);
      const refused = info.isSymbolicLink()
        ? 'consoles-link'
        : info.isDirectory()
          ? undefined
          : 'consoles-not-directory';
      if (refused) warn(refused);
      return refused === undefined;
    }
    let handle: FileHandle;
    try {
      handle = await open(dir, constants.O_RDONLY | POSIX_FLAGS.directory | POSIX_FLAGS.noFollow);
    } catch (error) {
      if (!['ENOTDIR', 'ELOOP'].includes(code(error) ?? '')) throw error;
      warn((await lstat(dir)).isSymbolicLink() ? 'consoles-link' : 'consoles-not-directory');
      return false;
    }
    try {
      const info = await handle.stat();
      const verdict = consolesVerdict({ uid: info.uid, mode: info.mode, directory: info.isDirectory() }, uid, platform);
      if (verdict === 'chmod') await handle.chmod(0o700);
      else if (verdict !== 'ok') {
        warn(verdict);
        return false;
      }
    } finally {
      await handle.close();
    }
    return true;
  };

  /** Start housekeeping (adr-003 D3): stale files of other consoles, dead writers' temporary files. */
  const housekeep = async (): Promise<void> => {
    const host = hostname();
    for (const name of await readdir(dir)) {
      const target = path.join(dir, name);
      try {
        const address = ADDRESS_NAME.exec(name);
        if (address) {
          if (Number(address[1]) === options.port) continue; // replaced by the rename
          await withEntry(target, async (_handle, found) => {
            if (
              !removableAtStart(parse(found.text), Date.now() - found.mtimeMs, host, {
                pid: entry.pid,
                live: livePublishers,
              })
            )
              return;
            // Removed only if it is still the file judged (the narrow race of state.json.lock).
            const again = await withEntry(
              target,
              async (_h, now) => now.text === found.text && now.mtimeMs === found.mtimeMs,
            );
            if (again) await unlink(target);
          });
          continue;
        }
        const tmp = TMP_NAME.exec(name);
        if (tmp && Number(tmp[1]) !== process.pid && !running(Number(tmp[1]))) {
          if ((await lstat(target)).isFile()) await unlink(target);
        }
      } catch (error) {
        if (code(error) === 'ENOENT') continue; // removed meanwhile
        if (!warned.has('housekeeping-failed')) warn('housekeeping-failed', error);
        warned.add('housekeeping-failed');
      }
    }
  };

  /** Write the file atomically: an exclusive temporary file (0600), fsync, rename (adr-003 D2). */
  const write = async (): Promise<void> => {
    const tmp = path.join(dir, `${options.port}.json.tmp-${process.pid}-${tmpCounter++}`);
    try {
      await rm(tmp, { force: true });
      const handle = await open(tmp, 'wx', 0o600);
      try {
        await handle.writeFile(content, 'utf8');
        await handle.sync();
      } finally {
        await handle.close();
      }
      await renameRetrying(tmp, file, platform);
    } catch (error) {
      await rm(tmp, { force: true }).catch(() => undefined);
      throw error;
    }
    if (posix) {
      try {
        const handle = await open(dir, 'r');
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
      } catch {
        // Some file systems refuse to sync a directory; the file itself is synced.
      }
    }
  };

  /**
   * One heartbeat: refresh the time of its own file, or rewrite a missing or foreign one. On
   * Windows the handle is opened read-write: libuv opens a read-only one without
   * `FILE_WRITE_ATTRIBUTES`, and setting the time through it would fail (review round 1 F1).
   */
  const beat = async (): Promise<void> => {
    try {
      const fresh = await withEntry(
        file,
        async (handle, found) => {
          if (found.text !== content) return false;
          const now = new Date();
          await handle.utimes(now, now);
          return true;
        },
        posix ? constants.O_RDONLY : constants.O_RDWR,
      );
      if (!fresh && !stopped) await write();
    } catch (error) {
      if (!warned.has('heartbeat-failed')) warn('heartbeat-failed', error);
      warned.add('heartbeat-failed');
    }
  };

  const written = (async (): Promise<boolean> => {
    try {
      if (!(await prepare())) return false;
      await housekeep();
      if (stopped) return false;
      await write();
    } catch (error) {
      warn('write-failed', error);
      return false;
    }
    options.logger.info({ port: options.port }, 'console address file written');
    if (!stopped) {
      timer = setInterval(() => {
        // A tick never overlaps the previous one: while one runs, the next ones are skipped, not
        // queued (review round 1 F2).
        if (beating || stopped) return;
        beating = true;
        tick = beat().finally(() => {
          beating = false;
        });
      }, options.heartbeatMs ?? ADDRESS_HEARTBEAT_MS);
      timer.unref();
    }
    return true;
  })();

  /** Whether `text` is a file this console wrote (its own `pid` and `started`). */
  const ours = (text: string | undefined): boolean => {
    const found = parse(text);
    return found?.pid === entry.pid && found.started === entry.started;
  };

  return {
    file,
    written,
    settled: async () => {
      await tick;
    },
    stop: async () => {
      stopped = true;
      release();
      if (timer) clearInterval(timer);
      const done = await written;
      await tick;
      if (!done) return;
      try {
        const mine = await withEntry(file, async (_handle, found) => ours(found.text));
        if (mine) await unlink(file);
      } catch (error) {
        if (code(error) !== 'ENOENT') warn('remove-failed', error);
      }
    },
    removeSync: () => {
      stopped = true;
      release();
      if (timer) clearInterval(timer);
      try {
        const fd = openSync(file, constants.O_RDONLY | POSIX_FLAGS.noFollow | POSIX_FLAGS.nonBlock);
        let mine = false;
        try {
          const info = fstatSync(fd);
          if (info.isFile() && info.size <= ADDRESS_MAX_BYTES) {
            const buffer = Buffer.alloc(ADDRESS_MAX_BYTES);
            const bytes = readSync(fd, buffer, 0, buffer.length, 0);
            mine = ours(buffer.subarray(0, bytes).toString('utf8'));
          }
        } finally {
          closeSync(fd);
        }
        if (mine) unlinkSync(file);
      } catch {
        // Best-effort at exit: the next start's housekeeping or the readers' 30 s rule take it.
      }
    },
  };
}
