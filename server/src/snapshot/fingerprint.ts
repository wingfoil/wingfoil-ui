/**
 * Fingerprint of the working-tree content of the status entries (review F1 of task-010): the
 * porcelain status of a file that is already modified, or untracked, does not change when the
 * file is edited again, so the state key would not move and the view would stay stale. The
 * fingerprint hashes, for every entry inside the project folder, the SHA-256 of its content, the
 * target of a symbolic link (never followed), or `missing`. No git command; nothing is kept or
 * exposed but the hashes.
 *
 * Bounded cost (review round 2, R2): a file's SHA is cached by path and re-read only when its
 * `lstat` (size, modification time in ns, inode) changes — an entry fingerprinted by its `lstat`
 * keeps that mark while it holds — unless the mark is racy ({@link RACY_WINDOW_MS}); a check reads at most
 * {@link MAX_FINGERPRINT_BYTES_PER_CHECK} bytes of new content and hashes at most
 * {@link MAX_FINGERPRINT_FILES} entries by content — beyond, and for files over
 * {@link MAX_FINGERPRINT_FILE_BYTES}, an entry is fingerprinted by its `lstat` alone.
 *
 * No read through a link (bug-033, task-068 AC-5): `lstat` and `readFile` follow every component
 * but the last, so a folder of the project replaced by a symbolic link — git then lists the tracked
 * files under it as deleted — would be read through. Each entry's folders inside the repository are
 * `lstat`ed first, each at most once per check: an entry under one that is not a real directory is
 * marked by that folder, with no read behind it. Declared residual (as `reads/ui-yaml.ts`): a local
 * process swapping a folder for a link between that `lstat` and the file's read is not caught.
 */
import { createHash } from 'node:crypto';
import { lstat, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';
import type { StatusEntry } from '../git/git.js';

/** Entries whose content is hashed; the next ones are fingerprinted by size and time only. */
export const MAX_FINGERPRINT_FILES = 1_000;

/** Largest file whose content is hashed; a bigger one is fingerprinted by size and time. */
export const MAX_FINGERPRINT_FILE_BYTES = 1024 * 1024;

/** New content read by one check, at most; beyond, entries are fingerprinted by size and time. */
export const MAX_FINGERPRINT_BYTES_PER_CHECK = 8 * 1024 * 1024;

/**
 * git's "racy git" rule (review round 3, N1): a mark taken less than this after the file's
 * modification time is not trusted — a same-size rewrite within one mtime tick (FAT 2 s, HFS+ 1 s,
 * network mounts, `touch -r`, `cp -p`) leaves the `lstat` unchanged. Such an entry is read again at
 * each check until a mark is taken past the window.
 */
export const RACY_WINDOW_MS = 3_000;

/** Options of {@link Fingerprinter}. */
export interface FingerprinterOptions {
  /** Clock of the racy rule, in ms (default `Date.now`). */
  now?: () => number;
}

/** Files read at once. */
export const FINGERPRINT_CONCURRENCY = 16;

interface Cached {
  stat: string;
  /** The mark may not be trusted on the next check: taken within {@link RACY_WINDOW_MS} of the file's mtime. */
  racy: boolean;
  /** `sha:<hex>`, or `stat:<stat>` when it was over a limit: kept while the stat holds, so an unchanged file never changes its mark (no spurious `repo` event). */
  mark: string;
}

/** The fingerprints of one project, with the SHA cache. */
export class Fingerprinter {
  private cache = new Map<string, Cached>();

  /**
   * @param topLevel the repository's top level (the status paths are relative to it)
   * @param prefix the project folder relative to it (`GitLayout.prefix`): only entries under it count
   */
  constructor(
    private readonly topLevel: string,
    private readonly prefix = '',
    private readonly options: FingerprinterOptions = {},
  ) {}

  /** Files read by the last {@link fingerprint} call (not taken from the cache). */
  lastReads = 0;

  /** Folders `lstat`ed by the last {@link fingerprint} call, each once (bug-033). */
  lastAncestorChecks = 0;

  /** The fingerprint (hex SHA-256) of the content of `entries` under the project folder. */
  async fingerprint(entries: readonly StatusEntry[]): Promise<string> {
    const listed = entries.filter((e) => e.path.startsWith(this.prefix));
    const parts = new Array<string>(listed.length);
    const next = new Map<string, Cached>();
    let budget = MAX_FINGERPRINT_BYTES_PER_CHECK;
    let reads = 0;
    let cursor = 0;
    // Folder (relative to the top level) → `undefined` when a real directory or missing, else its mark.
    const folders = new Map<string, Promise<string | undefined>>();
    const folderMark = (dir: string): Promise<string | undefined> => {
      let known = folders.get(dir);
      if (!known) {
        known = lstat(path.join(this.topLevel, dir), { bigint: true }).then(
          (info) => (info.isDirectory() ? undefined : `via:${dir}:${info.size}:${info.mtimeNs}:${info.ino}`),
          () => undefined,
        );
        folders.set(dir, known);
      }
      return known;
    };
    /** The mark of the first folder of `rel` that is not a real directory, outermost first. */
    const throughLink = async (rel: string): Promise<string | undefined> => {
      const parts = rel.split('/').slice(0, -1);
      for (let i = 1; i <= parts.length; i += 1) {
        const mark = await folderMark(parts.slice(0, i).join('/'));
        if (mark !== undefined) return mark;
      }
      return undefined;
    };
    const worker = async (): Promise<void> => {
      while (cursor < listed.length) {
        const index = cursor++;
        const entry = listed[index]!;
        const file = path.join(this.topLevel, entry.path);
        let mark: string;
        try {
          const via = await throughLink(entry.path);
          if (via !== undefined) {
            parts[index] = `${entry.path}\0${via}`;
            continue;
          }
          const info = await lstat(file, { bigint: true });
          const stat = `${info.size}:${info.mtimeNs}:${info.ino}`;
          if (info.isSymbolicLink()) mark = `link:${await readlink(file)}`;
          else if (!info.isFile()) mark = `other:${stat}`;
          else {
            const cached = this.cache.get(entry.path);
            const now = (this.options.now ?? Date.now)();
            const racy = now - Number(info.mtimeMs) < RACY_WINDOW_MS;
            if (cached?.stat === stat && !cached.racy) {
              mark = cached.mark;
            } else if (
              index >= MAX_FINGERPRINT_FILES ||
              info.size > BigInt(MAX_FINGERPRINT_FILE_BYTES) ||
              Number(info.size) > budget
            ) {
              mark = `stat:${stat}`;
            } else {
              budget -= Number(info.size);
              reads += 1;
              mark = `sha:${createHash('sha256')
                .update(await readFile(file))
                .digest('hex')}`;
            }
            next.set(entry.path, { stat, mark, racy });
          }
        } catch {
          mark = 'missing';
        }
        parts[index] = `${entry.path}\0${mark}`;
      }
    };
    await Promise.all(Array.from({ length: Math.min(FINGERPRINT_CONCURRENCY, listed.length) }, worker));
    // Only the entries still listed stay cached.
    this.cache = next;
    this.lastReads = reads;
    this.lastAncestorChecks = folders.size;
    return createHash('sha256').update(parts.join('\0')).digest('hex');
  }
}

/** One-off fingerprint of `entries` under `topLevel` (no cache). */
export function contentFingerprint(topLevel: string, entries: readonly StatusEntry[]): Promise<string> {
  return new Fingerprinter(topLevel).fingerprint(entries);
}

/**
 * The status hash combined with the content fingerprint and, from v0.3, the mark of
 * `.wingfoil/ui.yaml` (`reads/ui-yaml.ts` `uiYamlMark`, task-068): 16 hex digits, as the status hash.
 */
export function combinedHash(statusHash: string, fingerprint: string, uiYamlMark?: string): string {
  const input =
    uiYamlMark === undefined ? `${statusHash}\0${fingerprint}` : `${statusHash}\0${fingerprint}\0${uiYamlMark}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 16);
}
