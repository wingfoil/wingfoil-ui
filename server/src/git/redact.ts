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
 * Longest folder first, only as a whole path (`/a/project` never matches inside `/a/project-two`).
 * First (bug-017, review rounds 3–4) the raw text is bounded: past {@link RAW_BOUND} code points at
 * either end only whole lines of its head and its tail are kept, and one line stands for the rest —
 * `…`, or `… <N> characters without a line break omitted` when the rest lies inside one line — so no
 * transform below ever sees a hook's megabytes and no path or URL is cut in two; the final cap then
 * adds no second omission line.
 *
 * Then (bug-017, task-040) what is sent is made safe to show, whatever a hook or a remote printed —
 * this function is the one sanitiser of every verbatim tool message the API sends (`git-refused`,
 * `cli-refused`, the sync status's `lastError`, a write's `push.message`, the project list's refusals;
 * `test/server/tool-messages.test.ts` enumerates the producers):
 *
 * | Found | Becomes |
 * |-------|---------|
 * | CR LF | a newline |
 * | a backslash | `\\` (so that every `\x…`/`\u…` in the output is an escape made here) |
 * | a character of the Unicode categories Cc, Cf, Cs, Zl, Zp other than newline and tab (ESC, CR, NUL, DEL, the C1 controls, the bidi controls and marks, U+FEFF, U+200B, U+00AD, a lone surrogate, U+2028, U+2029, …) | a visible escape: `\xHH` up to U+00FF, `\uHHHH` up to U+FFFF, `\u{HHHHH}` beyond |
 *
 * Last, the text is capped at {@link MAX_MESSAGE} characters by keeping its head and its tail
 * around a `…` line — git's own concluding lines (`! [rejected]`, `error:`, `fatal:`) come after a
 * hook's output —; a cut never splits an escape, a redaction token or a surrogate pair. Declared
 * residuals (spec-010 §4): a literal `<project>` printed by a hook stays indistinguishable from the
 * redaction token; the scheme-less userinfo rule reads its left context only (after `=`, `,`, `;`,
 * `|`, with a tab inside it, or `?`/`#` in a password, a userinfo may be kept).
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
export function redactLocalPaths(raw: string, roots: LocalRoots): string {
  const bounded = boundParts(raw);
  if (bounded === undefined) return cap(sanitise(raw, roots));
  // Each side on its own (the cuts are line breaks: no path or URL spans them), one omission line.
  return joinCapped(sanitise(bounded.head, roots), bounded.marker, sanitise(bounded.tail, roots));
}

/** `text` with the folders of `roots` and URL userinfo redacted, then neutralised (no cap). */
function sanitise(text: string, roots: LocalRoots): string {
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
      new RegExp(`${escape(folder)}(?=$|[\\s/\\\\'"\`:;,)\\]>?!|*&=#}{(<@+%~^$]|${UNSAFE.source}|\\.(?:$|\\s))`, 'gu'),
      token,
    );
  }
  // `scheme://userinfo@host` → `scheme://host`: the userinfo runs to the last `@` before the host
  // and may hold quotes (review round 1 S7).
  // It ends only at ASCII white space, `/`, `?` or `#` (review round 3 S3-4: a no-break space or a
  // line separator inside a password does not end it).
  out = out.replace(/\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^ \t\n\r\f\v/?#]*@/g, '$1');
  // `user:password@host` without a scheme (git's `unable to look up u:tok@host`); a plain e-mail
  // address (no `:`) stays.
  // Only after the start, a space or a quote (review round 2 F11, S13).
  // A control or format character before it counts as a start too (review round 2 R2-6).
  // After opening punctuation too (review round 3 S3-4).
  out = out.replace(
    new RegExp(`(^|[\\s'"([{<]|${UNSAFE.source})[A-Za-z0-9._~%+-]+:[^ \\t\\n\\r\\f\\v/?#]*@(?=[A-Za-z0-9[])`, 'gu'),
    '$1',
  );
  return neutralise(out);
}

/**
 * A character to write as an escape (bug-017, review round 2 S2-2): the Unicode categories Cc
 * (controls), Cf (format: bidi controls and marks, U+FEFF, U+200B, U+00AD, …), Cs (a lone
 * surrogate), Zl and Zp (line and paragraph separators) — except newline and tab.
 */
const UNSAFE = /(?![\n\t])[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

/**
 * `text` with CR LF folded to a newline, a backslash doubled and every unsafe character (Cc, Cf,
 * Cs, Zl, Zp but newline and tab) written as a visible escape (`\x1b`, `\u202e`, `\u{e0001}`).
 */
export function neutralise(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(new RegExp(`\\\\|${UNSAFE.source}`, 'gu'), (ch) => {
    if (ch === '\\') return '\\\\';
    const code = ch.codePointAt(0)!;
    const hex = code.toString(16);
    if (code <= 0xff) return `\\x${hex.padStart(2, '0')}`;
    if (code <= 0xffff) return `\\u${hex.padStart(4, '0')}`;
    return `\\u{${hex}}`;
  });
}

/** The line that stands for the part a capped text leaves out. */
const ELLIPSIS = '\n…\n';

/** An escape or a redaction token: one unit a cut must not split. */
const UNIT = /\\\\|\\x[0-9a-f]{2}|\\u\{[0-9a-f]{5,6}\}|\\u[0-9a-f]{4}|<(?:project|repository|remote|wingfoil)>/g;

/**
 * A cut at `at` moved off any unit it would split, and off a surrogate pair (review round 2 R2-5):
 * backwards (`back`) or forwards. Units are matched from the start, so an escaped backslash is never
 * read as the start of an escape.
 */
function safeCut(text: string, at: number, back: boolean): number {
  let cut = at;
  UNIT.lastIndex = 0;
  for (let m = UNIT.exec(text); m !== null && m.index < cut; m = UNIT.exec(text)) {
    const end = m.index + m[0].length;
    if (end > cut) {
      cut = back ? m.index : end;
      break;
    }
  }
  const high = text.charCodeAt(cut - 1);
  if (cut > 0 && cut < text.length && high >= 0xd800 && high <= 0xdbff) cut += back ? -1 : 1;
  return cut;
}

/** `text`, or its head and tail around {@link ELLIPSIS}, at most {@link MAX_MESSAGE} characters. */
function cap(text: string): string {
  if (text.length <= MAX_MESSAGE) return text;
  const room = MAX_MESSAGE - ELLIPSIS.length;
  const head = safeCut(text, Math.floor(room / 2), true);
  const tail = safeCut(text, text.length - (room - head), false);
  return `${text.slice(0, head)}${ELLIPSIS}${text.slice(tail)}`;
}

/** The code points kept at each end of a raw tool message before any transform (S3-3). */
export const RAW_BOUND = 8_192;

/** The bounded text: kept head and tail (whole lines) and the one line standing for the rest. */
interface Bounded {
  head: string;
  marker: string;
  tail: string;
}

/** Code points of `text` (a surrogate pair counts once). */
function codePoints(text: string): number {
  let n = text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 0xdc00 && c <= 0xdfff && i > 0) {
      const h = text.charCodeAt(i - 1);
      if (h >= 0xd800 && h <= 0xdbff) n -= 1;
    }
  }
  return n;
}

/**
 * `raw` bounded (bug-017, review rounds 3–4, coordinator decision): past {@link RAW_BOUND} code
 * points at either end only whole lines are kept — the head up to the last line break of its window,
 * the tail from the first line break of its window (paths and URLs never span a line) — and one line
 * stands for the rest: `…`, or `… <N> characters without a line break omitted` when what is left out
 * lies inside one line (N in code points), so the message carries information but no fragment.
 * `undefined` when the text is short enough.
 */
function boundParts(raw: string): Bounded | undefined {
  // Two UTF-16 units per code point at most: shorter texts hold fewer code points than twice the bound.
  if (raw.length <= 2 * RAW_BOUND) return undefined;
  let head = 0;
  for (let n = 0; n < RAW_BOUND && head < raw.length; n++) head += raw.codePointAt(head)! > 0xffff ? 2 : 1;
  let tail = raw.length;
  for (let n = 0; n < RAW_BOUND && tail > head; n++) {
    const low = raw.charCodeAt(tail - 1);
    tail -= low >= 0xdc00 && low <= 0xdfff && tail >= 2 ? 2 : 1;
  }
  if (tail <= head) return undefined;
  const headBreak = raw.lastIndexOf('\n', head - 1);
  const keptHead = headBreak < 0 ? '' : raw.slice(0, headBreak);
  const tailBreak = raw.indexOf('\n', tail);
  const keptTail = tailBreak < 0 ? '' : raw.slice(tailBreak + 1);
  const from = headBreak < 0 ? 0 : headBreak + 1;
  const to = tailBreak < 0 ? raw.length : tailBreak;
  const omitted = raw.slice(from, Math.max(from, to));
  const marker = omitted.includes('\n') ? '…' : `… ${codePoints(omitted)} characters without a line break omitted`;
  return { head: keptHead, marker, tail: keptTail };
}

/** {@link boundParts} as one text (`raw` itself when short enough). */
export function boundRaw(raw: string): string {
  const b = boundParts(raw);
  return b === undefined ? raw : [b.head, b.marker, b.tail].filter((part, i) => i === 1 || part !== '').join('\n');
}

/**
 * `head`, `marker` and `tail` joined by line breaks, at most {@link MAX_MESSAGE} characters: when
 * longer, the head is cut at its end and the tail at its start — never inside a unit — and the one
 * marker line stands for all that is left out (review round 4 R4-3).
 */
function joinCapped(head: string, marker: string, tail: string): string {
  const join = (h: string, t: string): string => [h, marker, t].filter((part, i) => i === 1 || part !== '').join('\n');
  const whole = join(head, tail);
  if (whole.length <= MAX_MESSAGE) return whole;
  const room = MAX_MESSAGE - marker.length - 2;
  const headRoom = Math.min(head.length, Math.max(Math.floor(room / 2), room - tail.length));
  const tailRoom = Math.max(0, room - headRoom);
  const h = head.slice(0, safeCut(head, headRoom, true));
  const t = tail.slice(safeCut(tail, Math.max(0, tail.length - tailRoom), false));
  return join(h, t);
}
