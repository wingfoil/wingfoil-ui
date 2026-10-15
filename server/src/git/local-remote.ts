/**
 * The owner check of a local remote (task-033 D33-1, bug-010; review round 1 F1, S1–S5): a clone,
 * fetch, update or push whose remote is a repository on this machine is refused when any folder
 * git could open for it belongs to another user — the class of CVE-2024-32004 (a local repository
 * owned by another user can run code in the user's git), checked whatever the git version.
 *
 * Which URLs are local follows git (`url_is_local_not_ssh`, `file://`): every `file://` URL
 * whatever its host (S1), and a string with no `:` or with a `/` before its first `:` (a path);
 * `<scheme>://`, `<transport>::` and scp-like `host:path` are not. For each local URL the folders
 * git tries are checked in its order — `<p>/.git`, `<p>`, `<p>.git/.git`, `<p>.git` — a `gitdir:`
 * file followed (S3); a relative path is joined to the base (the repository's top level, S4) and
 * resolved by the file system, never normalised lexically first (`..` after a link, S5). A local
 * URL with no folder that can be read fails closed as `remote-unreadable` (review round 2 F9). A
 * leading `~` or `~user` is expanded as git's `enter_repo` does for fetch, update and push (the git
 * environment's `HOME`; a user's home folder from the user database — `os.userInfo()` for the
 * server's own user, `/etc/passwd` for another; a user known only through NSS/LDAP, or none, is
 * `remote-unreadable`); `git clone` takes a local path as written, so the clone does not expand it
 * (review round 2 F10, S11). `::` makes a remote helper only after a name `^[A-Za-z][A-Za-z0-9+.-]*`
 * (S10). POSIX only: on Windows there is no owner id.
 */
import { readFileSync } from 'node:fs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { homedir, userInfo } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;
/** A remote helper (`<transport>::<address>`): only after a scheme-like name from the start (S10). */
const HELPER = /^[A-Za-z][A-Za-z0-9+.-]*::/;

/** What a local remote is refused for. */
export type LocalRemoteProblem = 'remote-not-owned' | 'remote-unreadable';

/**
 * The home folder of `user` from the user database: `os.userInfo()` for the server's own user,
 * `/etc/passwd` for another; `undefined` when unknown (a user known only through NSS/LDAP too).
 */
export function userHome(user: string): string | undefined {
  try {
    const self = userInfo();
    if (self.username === user) return self.homedir;
  } catch {
    // No passwd entry for the server's user: look in the file.
  }
  try {
    for (const line of readFileSync('/etc/passwd', 'utf8').split('\n')) {
      const fields = line.split(':');
      if (fields.length >= 7 && fields[0] === user && fields[5]) return fields[5];
    }
  } catch {
    // No readable user database.
  }
  return undefined;
}

/** `raw` with a leading `~` or `~user` expanded as git's `enter_repo`; `undefined`: not expandable. */
function expandUser(raw: string, home: string | undefined): string | undefined {
  if (!raw.startsWith('~')) return raw;
  const slash = raw.indexOf('/');
  const name = raw.slice(1, slash < 0 ? undefined : slash);
  const rest = slash < 0 ? '' : raw.slice(slash);
  const folder = name === '' ? home : userHome(name);
  return folder ? `${folder}${rest}` : undefined;
}

/**
 * The path of `url` when git opens it as a local repository (absolute, or relative to where git
 * runs), else `undefined`.
 */
export function localPathOf(url: string): string | undefined {
  const trimmed = url.trim();
  if (trimmed === '') return undefined;
  if (/^file:\/\//i.test(trimmed)) {
    // Whatever the host: git opens the path (S1).
    const rest = trimmed.slice('file://'.length);
    const slash = rest.indexOf('/');
    const pathname = slash < 0 ? '/' : rest.slice(slash);
    try {
      return fileURLToPath(new URL(`file://${pathname}`));
    } catch {
      return pathname;
    }
  }
  if (SCHEME.test(trimmed) || HELPER.test(trimmed)) return undefined;
  const colon = trimmed.indexOf(':');
  if (colon < 0) return trimmed;
  // A Windows drive letter is a path.
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) return trimmed;
  const slash = trimmed.indexOf('/');
  return slash >= 0 && slash < colon ? trimmed : undefined;
}

/** The real path and owner of `file` (links followed), or `undefined` when it cannot be read. */
async function owned(file: string): Promise<{ real: string; uid: number } | undefined> {
  try {
    const real = await realpath(file);
    return { real, uid: (await stat(real)).uid };
  } catch {
    return undefined;
  }
}

/** The folder a `gitdir: <path>` file names, or `undefined`. */
async function gitdirOf(file: string): Promise<string | undefined> {
  try {
    if (!(await stat(file)).isFile()) return undefined;
    const match = /^gitdir: (.+?)\s*$/m.exec(await readFile(file, 'utf8'));
    if (!match) return undefined;
    const target = match[1]!;
    return path.isAbsolute(target) ? target : `${path.dirname(await realpath(file))}${path.sep}${target}`;
  } catch {
    return undefined;
  }
}

/** Options of {@link localRemoteProblem}. */
export interface LocalRemoteOptions {
  /** The server's user id (default); `null`: no owner id (Windows) — nothing is checked. */
  uid?: number | null;
  /** `~` of the git environment (default: the server's home folder). */
  home?: string;
  /** Expand `~` and `~user` (fetch, update, push: yes; a clone: no — git clone does not). Default `true`. */
  expandUser?: boolean;
}

/**
 * Why `urls` (a remote's every fetch or push URL, or a clone source) cannot be used: a local
 * repository a user other than the server's owns (`remote-not-owned`, any URL), else a local URL
 * with no folder git could open (`remote-unreadable`, fail closed); `undefined` when every local
 * URL is the user's own. `base`: where a relative path is resolved (the repository's top level; the
 * clone's working folder).
 */
export async function localRemoteProblem(
  urls: readonly string[],
  base: string,
  options: LocalRemoteOptions = {},
): Promise<LocalRemoteProblem | undefined> {
  const uid = options.uid === undefined ? (process.getuid?.() ?? null) : options.uid;
  if (uid === null) return undefined;
  let unreadable = false;
  for (const url of urls) {
    const written = localPathOf(url);
    if (written === undefined) continue;
    const raw = (options.expandUser ?? true) ? expandUser(written, options.home ?? homedir()) : written;
    if (raw === undefined) {
      unreadable = true;
      continue;
    }
    // Joined, not resolved: `..` is the file system's to resolve, after any link (S5).
    const full = path.isAbsolute(raw) ? raw : `${base}${path.sep}${raw}`;
    const candidates = [`${full}${path.sep}.git`, full, `${full}.git${path.sep}.git`, `${full}.git`];
    let readable = 0;
    for (const candidate of candidates) {
      const found = await owned(candidate);
      if (!found) continue;
      readable += 1;
      if (found.uid !== uid) return 'remote-not-owned';
      const gitdir = await gitdirOf(found.real);
      if (gitdir !== undefined) {
        const target = await owned(gitdir);
        if (!target) unreadable = true;
        else if (target.uid !== uid) return 'remote-not-owned';
      }
    }
    if (readable === 0) unreadable = true;
  }
  return unreadable ? 'remote-unreadable' : undefined;
}
