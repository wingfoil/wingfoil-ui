/**
 * The owner check of a local remote (task-033 D33-1, bug-010): a clone, fetch, update or push whose
 * remote is a repository on this machine (a `file://` URL or a path) is refused when that
 * repository is not owned by the server's user — the class of CVE-2024-32004 (a local repository
 * owned by another user can run code in the user's git), checked whatever the git version.
 * POSIX only: on Windows there is no owner id to compare (documented).
 */
import { lstat, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_FORM = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(.*)$/s;
/** git's scp-like syntax: `[user@]host:path` with no `/` before the first `:` (a drive letter is a path). */
const SCP_FORM = /^(?:[^@/:]+@)?[^/:]{2,}:/s;

/**
 * The folder of `url` when it names a local repository — a `file://` URL (host empty or
 * `localhost`) or a path, a relative one resolved against `base` (the folder git runs in) —
 * else `undefined` (any other transport).
 */
export function localRemotePath(url: string, base: string): string | undefined {
  const trimmed = url.trim();
  const form = URL_FORM.exec(trimmed);
  if (form) {
    if (form[1]!.toLowerCase() !== 'file') return undefined;
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname !== '' && parsed.hostname !== 'localhost') return undefined;
      return fileURLToPath(new URL(`file://${parsed.pathname}`));
    } catch {
      return undefined;
    }
  }
  if (trimmed === '' || (SCP_FORM.test(trimmed) && !/^[A-Za-z]:[\\/]/.test(trimmed))) return undefined;
  return path.resolve(base, trimmed);
}

/** The owner id of `file`, links followed; `undefined` when it cannot be read. */
async function ownerOf(file: string, follow: boolean): Promise<number | undefined> {
  try {
    return (await (follow ? stat(file) : lstat(file))).uid;
  } catch {
    return undefined;
  }
}

/**
 * Whether the local repository at `folder` is owned by another user than `uid` (default: the
 * server's): the folder (its real path) or its `.git` entry, when there is one. A folder that cannot
 * be read is left to git (it fails with its own message). Always `false` without an owner id (Windows).
 */
export async function ownedByAnother(
  folder: string,
  uid: number | null = process.getuid?.() ?? null,
): Promise<boolean> {
  if (uid === null) return false;
  const real = await realpath(folder).catch(() => folder);
  const owner = await ownerOf(real, true);
  if (owner !== undefined && owner !== uid) return true;
  const dotGit = await ownerOf(path.join(real, '.git'), false);
  return dotGit !== undefined && dotGit !== uid;
}
