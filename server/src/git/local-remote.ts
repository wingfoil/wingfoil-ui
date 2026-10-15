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
 * URL with no folder that can be read fails closed. POSIX only: on Windows there is no owner id.
 */
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//;

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
  if (SCHEME.test(trimmed) || trimmed.includes('::')) return undefined;
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

/**
 * Whether any of `urls` (a remote's every fetch or push URL, or a clone source) is a local
 * repository a user other than `uid` owns — or a local URL with no folder git could open
 * (fail closed). `base`: where a relative path is resolved (the repository's top level; the
 * clone's working folder). Always `false` without an owner id (Windows).
 */
export async function foreignLocalRemote(
  urls: readonly string[],
  base: string,
  uid: number | null = process.getuid?.() ?? null,
): Promise<boolean> {
  if (uid === null) return false;
  for (const url of urls) {
    const raw = localPathOf(url);
    if (raw === undefined) continue;
    // Joined, not resolved: `..` is the file system's to resolve, after any link (S5).
    const full = path.isAbsolute(raw) ? raw : `${base}${path.sep}${raw}`;
    const candidates = [`${full}${path.sep}.git`, full, `${full}.git${path.sep}.git`, `${full}.git`];
    let readable = 0;
    for (const candidate of candidates) {
      const found = await owned(candidate);
      if (!found) continue;
      readable += 1;
      if (found.uid !== uid) return true;
      const gitdir = await gitdirOf(found.real);
      if (gitdir !== undefined) {
        const target = await owned(gitdir);
        if (!target || target.uid !== uid) return true;
      }
    }
    if (readable === 0) return true;
  }
  return false;
}
