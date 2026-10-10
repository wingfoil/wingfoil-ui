/**
 * The default working directory of a clone (ux-reference §3, spec-006 §3, S-04.1):
 * `~/projects/<repo>`, `<repo>` the last path segment of the URL without `.git`. A mirror of the
 * server's `repoName` (`server/src/projects/remote.ts`), kept equal by a unit test replaying the
 * server's table (decision W4-14). The dialog always sends the field's value: the server's own
 * default is never relied on.
 */

const URL_FORM = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(.*)$/s;
/** `user@host:path` or `host:path` (git's scp-like syntax); a drive letter is a local path. */
const SCP_FORM = /^(?:[^@/:]+@)?([^/:]{2,}):(.*)$/s;

/** Host and path of `remote` (the server's `split`). */
function split(remote: string): { host: string; path: string } {
  const trimmed = remote.trim();
  const url = URL_FORM.exec(trimmed);
  if (url) {
    const rest = url[2]!;
    const slash = rest.indexOf('/');
    const authority = slash < 0 ? rest : rest.slice(0, slash);
    return { host: authority.slice(authority.lastIndexOf('@') + 1), path: slash < 0 ? '' : rest.slice(slash) };
  }
  const scp = SCP_FORM.exec(trimmed);
  if (scp && !/^[A-Za-z]:[\\/]/.test(trimmed)) {
    const p = scp[2]!;
    return { host: scp[1]!, path: p.startsWith('/') ? p : `/${p}` };
  }
  return { host: '', path: trimmed };
}

/**
 * The repository's name in `url`: its last path segment without `.git` (else the host), the query
 * and fragment of a URL ignored; `undefined` when no usable folder name is left (empty, `.`, `..`).
 */
export function repoName(url: string): string | undefined {
  const { host, path } = split(URL_FORM.test(url.trim()) ? url.trim().replace(/[?#].*$/s, '') : url);
  const segments = path
    .replace(/\.git\/*$/, '')
    .split(/[\\/]/)
    .filter(Boolean);
  const name = segments.at(-1) ?? host;
  return name === '' || name === '.' || name === '..' ? undefined : name;
}

/** `~/projects/<repo>` for `url`, or `''` when the URL gives no folder name. */
export function defaultWorkingDirectory(url: string): string {
  const name = repoName(url);
  return name === undefined ? '' : `~/projects/${name}`;
}
