/**
 * Fingerprint of the working-tree content of the status entries (review F1 of task-010): the
 * porcelain status of a file that is already modified, or untracked, does not change when the
 * file is edited again, so the state key would not move and the view would stay stale. The
 * fingerprint hashes, for every entry, the SHA-256 of its content (regular files up to
 * {@link MAX_FINGERPRINT_FILE_BYTES}), its size and modification time beyond that or beyond
 * {@link MAX_FINGERPRINT_FILES} entries, the target of a symbolic link (never followed), or
 * `missing`. No git command; nothing is kept or exposed but the hash.
 */
import { createHash } from 'node:crypto';
import { lstat, readFile, readlink } from 'node:fs/promises';
import path from 'node:path';
import type { StatusEntry } from '../git/git.js';

/** Entries whose content is hashed; the next ones are fingerprinted by size and time only. */
export const MAX_FINGERPRINT_FILES = 1_000;

/** Largest file whose content is hashed; a bigger one is fingerprinted by size and time. */
export const MAX_FINGERPRINT_FILE_BYTES = 1024 * 1024;

/** Files read at once. */
export const FINGERPRINT_CONCURRENCY = 16;

/** The fingerprint (hex SHA-256) of the entries' content under the repository's `topLevel`. */
export async function contentFingerprint(topLevel: string, entries: readonly StatusEntry[]): Promise<string> {
  const parts = new Array<string>(entries.length);
  let next = 0;
  // A bounded number of files open at once (no EMFILE on a large status).
  const worker = async (): Promise<void> => {
    while (next < entries.length) {
      const index = next++;
      const entry = entries[index]!;
      parts[index] = `${entry.path}\0${await fileMark(path.join(topLevel, entry.path), index)}`;
    }
  };
  await Promise.all(Array.from({ length: Math.min(FINGERPRINT_CONCURRENCY, entries.length) }, worker));
  return createHash('sha256').update(parts.join('\0')).digest('hex');
}

async function fileMark(file: string, index: number): Promise<string> {
  try {
    const info = await lstat(file, { bigint: true });
    if (info.isSymbolicLink()) return `link:${await readlink(file)}`;
    if (!info.isFile()) return `other:${info.mtimeNs}`;
    if (index >= MAX_FINGERPRINT_FILES || info.size > BigInt(MAX_FINGERPRINT_FILE_BYTES)) {
      return `stat:${info.size}:${info.mtimeNs}`;
    }
    return `sha:${createHash('sha256')
      .update(await readFile(file))
      .digest('hex')}`;
  } catch {
    return 'missing';
  }
}

/** The status hash combined with the content fingerprint: 16 hex digits, as the status hash. */
export function combinedHash(statusHash: string, fingerprint: string): string {
  return createHash('sha256').update(`${statusHash}\0${fingerprint}`).digest('hex').slice(0, 16);
}
