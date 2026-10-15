/**
 * Local absolute paths out of the tool messages the API sends (task-033 D33-5, bug-012): the CLI's
 * refusal (`cli-refused`, REQ-INT-04) and git's error (`git-refused`, `sync.*.lastError`,
 * REQ-INT-06) stay verbatim except for the folders of this machine they quote — the pinned CLI
 * wraps a failed git command as `Command failed: git -C <root> …`, git names `<root>/.git/index.lock`.
 *
 * | Found | Becomes |
 * |-------|---------|
 * | the project root (as listed and as its real path) | `<project>` |
 * | the repository's top level, git directory, common directory (when not inside the project root) | `<repository>` |
 * | a local remote's path, wherever it is (review round 1 R1) | `<remote>` |
 * | the CLI's own package folder (a CLI from the `PATH`) | `<wingfoil>` |
 * | the home directory | `~` |
 * | the userinfo of a URL (`https://user:token@host`, up to the last `@` before the host), and a `user:password@` without a scheme (`git://` lookups) | removed |
 *
 * Longest folder first, only as a whole path (`/a/project` never matches inside `/a/project-two`);
 * the text is capped at {@link MAX_MESSAGE} characters.
 */
import { realpathSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

/** Most characters of a tool message the API sends. */
export const MAX_MESSAGE = 4_000;

/** The folders a message may quote. */
export interface LocalRoots {
  project?: readonly string[];
  repository?: readonly string[];
  wingfoil?: readonly string[];
  /** The local paths a remote's URLs resolve to (review round 1 R1): shown as `<remote>`. */
  remote?: readonly string[];
  /** Default: the server's home directory; `null`: none. */
  home?: string | null;
}

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `folder` and its real path (when it exists), without a trailing separator. */
function forms(folder: string): string[] {
  const trimmed = folder.length > 1 ? folder.replace(/[\\/]+$/, '') : folder;
  const out = new Set([trimmed]);
  try {
    out.add(realpathSync(trimmed));
  } catch {
    // Gone or unreadable: the given form only.
  }
  return [...out].filter((f) => path.isAbsolute(f) && f.length > 1);
}

function inside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** `text` with the local folders of `roots` replaced, URL userinfo removed, capped (D33-5). */
export function redactLocalPaths(text: string, roots: LocalRoots): string {
  const pairs: [string, string][] = [];
  const project = (roots.project ?? []).flatMap(forms);
  for (const p of project) pairs.push([p, '<project>']);
  // A git directory inside the top level (`<top>/.git`) is named through the top level.
  const repository = (roots.repository ?? []).flatMap(forms);
  for (const r of repository) {
    const nested = repository.some((other) => other !== r && inside(r, other));
    if (!nested && !project.some((p) => inside(r, p))) pairs.push([r, '<repository>']);
  }
  for (const w of (roots.wingfoil ?? []).flatMap(forms)) {
    if (!project.some((p) => inside(w, p))) pairs.push([w, '<wingfoil>']);
  }
  for (const r of (roots.remote ?? []).flatMap(forms)) pairs.push([r, '<remote>']);
  const home = roots.home === undefined ? homedir() : roots.home;
  if (home) for (const h of forms(home)) pairs.push([h, '~']);
  pairs.sort((a, b) => b[0].length - a[0].length);
  let out = text;
  for (const [folder, token] of pairs) {
    // A whole path only: followed by a separator, the end, a quote or punctuation (a full stop only
    // at the end of a sentence).
    out = out.replace(
      new RegExp(`${escape(folder)}(?=$|[\\s/\\\\'"\`:;,)\\]>?!|*&=#}{(<@+%~^$]|\\.(?:$|\\s))`, 'g'),
      token,
    );
  }
  // `scheme://userinfo@host` → `scheme://host`: the userinfo runs to the last `@` before the host
  // and may hold quotes (review round 1 S7).
  out = out.replace(/\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s/]*@/g, '$1');
  // `user:password@host` without a scheme (git's `unable to look up u:tok@host`); a plain e-mail
  // address (no `:`) stays.
  // Only after the start, a space or a quote (review round 2 F11, S13).
  out = out.replace(/(^|[\s'"])[A-Za-z0-9._~%+-]+:[^\s/]*@(?=[A-Za-z0-9[])/g, '$1');
  return out.length > MAX_MESSAGE ? `${out.slice(0, MAX_MESSAGE)}…` : out;
}
