/**
 * The links of a document (US-R-08, US-R-09; REQ-SEC-06; decisions W3-30, W3-32, W3-33): an href
 * is first resolved against the document's path ({@link resolveLink}, pure, no request), then
 * classified ({@link classifyLink}) against the documentation index, the Memory elements and the
 * server's answers for the other repository paths.
 *
 * - `http`/`https` → external (a new tab); any other scheme, a protocol-relative `//host`, a
 *   control character or an invalid percent-encoding → not supported.
 * - `#fragment` → an anchor of the same document.
 * - Anything else is a repository path: query dropped, fragment kept, percent-decoded, `\` read as
 *   `/`, resolved against the document's folder (`/x` from the repository root, as GitHub does),
 *   normalised. A path that climbs above the root is outside the repository — decided here, never
 *   sent to the server.
 */

/** A resolved href, before classification. */
export type LinkTarget =
  | { kind: 'external'; href: string }
  | { kind: 'anchor'; fragment: string }
  | { kind: 'path'; path: string; fragment: string }
  | { kind: 'outside' }
  | { kind: 'unsupported' };

/** The server's answer about a repository path (`GET /files/content`). */
export type ProbeAnswer =
  /** A document the server serves: it opens in the UI. */
  | 'served'
  /** `missing`: nothing there. */
  | 'missing'
  /** `outside`: it leads out of the repository (e.g. a symlink). */
  | 'outside'
  /** `not-allowed`, `too-large` or no usable answer: not shown in the UI. */
  | 'hidden';

/** Why a link is refused: the mark shown next to its text. */
export type RefusalMark = 'broken' | 'outside' | 'hidden' | 'unsupported';

/** What a link of a rendered document does. */
export type LinkClass =
  | { kind: 'external'; href: string }
  | { kind: 'anchor'; fragment: string }
  | { kind: 'document'; path: string; fragment: string }
  | { kind: 'element'; eid: string }
  | { kind: 'refused'; mark: RefusalMark }
  /** Waiting for the elements or the server's answer about `path`. */
  | { kind: 'unresolved'; path: string };

/** What {@link classifyLink} knows. */
export interface LinkLookup {
  /** Paths of the documentation index (`GET /docs`). */
  documents: ReadonlySet<string>;
  /** Element id by file path (`GET /elements`), `undefined` until loaded. */
  elements: ReadonlyMap<string, string> | undefined;
  /** The server's answers by path. */
  probes: ReadonlyMap<string, ProbeAnswer>;
}

const UNSUPPORTED: LinkTarget = { kind: 'unsupported' };
const SCHEME = /^([a-zA-Z][a-zA-Z0-9+.-]*):/;
// eslint-disable-next-line no-control-regex -- control characters are exactly what is refused
const CONTROL = /[\u0000-\u001f\u007f]/;

/** `text` percent-decoded, or `undefined` when the encoding is invalid. */
function decode(text: string): string | undefined {
  try {
    return decodeURIComponent(text);
  } catch {
    return undefined;
  }
}

/** Resolve `raw` (an href of the document at the repository path `documentPath`). */
export function resolveLink(raw: string, documentPath: string): LinkTarget {
  const href = raw.trim();
  if (href === '' || CONTROL.test(href)) return UNSUPPORTED;
  const scheme = SCHEME.exec(href)?.[1]?.toLowerCase();
  if (scheme !== undefined) {
    if (scheme !== 'http' && scheme !== 'https') return UNSUPPORTED;
    try {
      return { kind: 'external', href: new URL(href).href };
    } catch {
      return UNSUPPORTED;
    }
  }
  // `//host` and `\\host` name another server (browsers read `\` as `/`).
  if (/^[/\\]{2}/.test(href)) return UNSUPPORTED;
  const hashAt = href.indexOf('#');
  const fragment = hashAt < 0 ? '' : decode(href.slice(hashAt + 1));
  let rest = hashAt < 0 ? href : href.slice(0, hashAt);
  const queryAt = rest.indexOf('?');
  if (queryAt >= 0) rest = rest.slice(0, queryAt);
  if (fragment === undefined) return UNSUPPORTED;
  if (rest === '' && fragment !== '') return { kind: 'anchor', fragment };
  const decoded = decode(rest);
  if (decoded === undefined || CONTROL.test(decoded)) return UNSUPPORTED;
  const relative = decoded.replace(/\\/g, '/');
  const segments = relative.startsWith('/') ? [] : documentPath.split('/').slice(0, -1);
  if (rest === '') return { kind: 'path', path: documentPath, fragment };
  for (const segment of relative.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (segments.length === 0) return { kind: 'outside' };
      segments.pop();
    } else segments.push(segment);
  }
  return { kind: 'path', path: segments.join('/'), fragment };
}

const MARK_OF_ANSWER: Record<Exclude<ProbeAnswer, 'served'>, RefusalMark> = {
  missing: 'broken',
  outside: 'outside',
  hidden: 'hidden',
};

/** Classify a resolved link: what selecting it does, or why it is refused. */
export function classifyLink(target: LinkTarget, lookup: LinkLookup): LinkClass {
  switch (target.kind) {
    case 'external':
    case 'anchor':
      return target;
    case 'outside':
    case 'unsupported':
      return { kind: 'refused', mark: target.kind };
    case 'path':
      break;
  }
  const path = target.path.normalize('NFC');
  // The repository root itself: a folder, never shown.
  if (path === '') return { kind: 'refused', mark: 'hidden' };
  if (hasNfc(lookup.documents, path)) return { kind: 'document', path, fragment: target.fragment };
  if (lookup.elements === undefined) return { kind: 'unresolved', path };
  const eid = lookup.elements.get(path);
  if (eid !== undefined) return { kind: 'element', eid };
  const answer = lookup.probes.get(path);
  if (answer === undefined) return { kind: 'unresolved', path };
  if (answer === 'served') return { kind: 'document', path, fragment: target.fragment };
  return { kind: 'refused', mark: MARK_OF_ANSWER[answer] };
}

/** True when `set` holds `path`, comparing in NFC. */
function hasNfc(set: ReadonlySet<string>, path: string): boolean {
  if (set.has(path)) return true;
  for (const entry of set) if (entry.normalize('NFC') === path) return true;
  return false;
}
