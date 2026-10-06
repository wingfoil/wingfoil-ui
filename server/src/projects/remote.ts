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
 *
 * Choices the spec leaves open: an explicit port stays part of the host (`host:2222/x` and
 * `host/x` are different repositories — a port often means another server); a local path remote
 * (`/srv/x.git`, what `origin` holds after a clone from a folder) has an empty host, so it equals
 * the same path as a `file://` URL; the case of the path is kept (only the host is folded). A
 * relative local path is never compared as such: the clone refuses it ({@link cloneSourceProblem}).
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

/**
 * The repository's name in `url`: its last path segment without `.git` (else the host), the query
 * and fragment of a URL ignored; `undefined` when that leaves no usable folder name (empty, `.`,
 * `..`) — the default working directory `~/projects/<repo>` cannot be derived then.
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

/**
 * Why `url` cannot be cloned as given, or `undefined`: a value starting with `-` (it would be read
 * as an option), or a local path that is not absolute (git would resolve it against the server's
 * working directory).
 */
export function cloneSourceProblem(url: string, platform: NodeJS.Platform = process.platform): string | undefined {
  const trimmed = url.trim();
  if (trimmed.startsWith('-')) return 'url must not start with -';
  if (URL_FORM.test(trimmed)) return undefined;
  const { host, path } = split(trimmed);
  // Drive letters and UNC paths are absolute on Windows only.
  const absolute = platform === 'win32' ? /^(\/|[A-Za-z]:[\\/]|\\\\)/ : /^\//;
  if (host === '' && !absolute.test(path)) return 'a local url must be an absolute path';
  return undefined;
}
