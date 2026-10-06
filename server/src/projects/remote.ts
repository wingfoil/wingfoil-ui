/**
 * Remote comparison for the duplicate check of spec-006 §3 (S-06.2, REQ-STATE-07) and the default
 * working directory of a clone (`ux-reference` §3: `~/projects/<repo>`).
 */

const URL_FORM = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/(.*)$/s;
/** `user@host:path` or `host:path` (git's scp-like syntax); a drive letter is a local path. */
const SCP_FORM = /^(?:[^@/:]+@)?([^/:]{2,}):(.*)$/s;

/** Host and path of `remote`, before folding. */
function split(remote: string): { host: string; path: string } {
  const trimmed = remote.trim();
  const url = URL_FORM.exec(trimmed);
  if (url) {
    const rest = url[2]!;
    const slash = rest.indexOf('/');
    const authority = slash < 0 ? rest : rest.slice(0, slash);
    // Userinfo removed: everything up to the last `@` of the authority.
    return { host: authority.slice(authority.lastIndexOf('@') + 1), path: slash < 0 ? '' : rest.slice(slash) };
  }
  const scp = SCP_FORM.exec(trimmed);
  if (scp && !/^[A-Za-z]:[\\/]/.test(trimmed)) {
    // Read as `ssh://host/path`.
    const p = scp[2]!;
    return { host: scp[1]!, path: p.startsWith('/') ? p : `/${p}` };
  }
  // A local path (git accepts one as a remote).
  return { host: '', path: trimmed };
}

/**
 * The comparison key of a remote (spec-006 §3): the scp-like form `user@host:owner/repo` read as
 * `ssh://host/owner/repo`, userinfo removed, host lower-cased, trailing `/` and `.git` removed;
 * host + path, whatever the scheme. `""` for no remote.
 */
export function normaliseRemote(remote: string): string {
  if (remote.trim() === '') return '';
  const { host, path } = split(remote);
  let p = path.replace(/\/+$/, '');
  if (p.endsWith('.git')) p = p.slice(0, -'.git'.length).replace(/\/+$/, '');
  return `${host.toLowerCase()}${p}`;
}

/** Whether two remotes name the same repository; an empty remote matches nothing. */
export function sameRemote(a: string, b: string): boolean {
  const key = normaliseRemote(a);
  return key !== '' && key === normaliseRemote(b);
}

/** The repository's name in `url`: its last path segment without `.git` (else the host). */
export function repoName(url: string): string {
  const { host, path } = split(url);
  const segments = path
    .replace(/\.git\/*$/, '')
    .split(/[\\/]/)
    .filter(Boolean);
  return segments.at(-1) ?? host;
}
