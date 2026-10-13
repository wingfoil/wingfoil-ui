/**
 * The project-wide Memory events of spec-002 §3: one `git log -p` over the Memory directories,
 * parsed into the events of every element (the source of the action descriptor's creator,
 * submitter, last reject and `since`, spec-003 §1), so that an element list costs one git process
 * per HEAD instead of one `memory history` per element (REQ-PERF-05). The element panel keeps
 * `memory history` (spec-002 §2).
 *
 * Pure: the git read is {@link GitReads.memoryLog}; here the output is parsed.
 *
 * **Framing** (review rounds 1–2, as WingFoil bug-050 / task-086): every field is followed by a NUL
 * (`%x00`), which git refuses in a commit message — so no subject, body or `--reason` can split a
 * record or forge one. A patch can still hold a NUL (a text file with one past git's 8000-byte
 * binary check), so records are cut at the authoritative sha order of a second, header-only read
 * of the same walk; a damaged record and a `wf` record with an unreadable date or author are
 * skipped (warnings), the others read; an output that does not match the sha list is refused as a
 * whole ({@link MemoryLogFormatError}), never guessed at (spec-002 §3, as amended 2026-10-06).
 */
import path from 'node:path';
import type { MemoryYaml } from '@wingfoil-ui/contracts';

/** The `--format` of the read: sha, author date, author, subject, body, each followed by a NUL. */
export const MEMORY_LOG_FORMAT = '%H%x00%aI%x00%an <%ae>%x00%s%x00%b%x00';

/** The output of the read does not have the shape {@link MEMORY_LOG_FORMAT} gives. */
export class MemoryLogFormatError extends Error {
  override name = 'MemoryLogFormatError';
}

const NUL = String.fromCharCode(0);
const SHA = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
/** `Name <email>` as `%an <%ae>` prints it. */
const IDENT = /^[^<>\n]* <[^<>\n]*>$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/;

/** A WingFoil verb recorded by a `wf(…)` commit. */
export type MemoryOperation = 'add' | 'submit' | 'approve' | 'reject' | 'deprecate';

/** One event (spec-002 §1). */
export interface MemoryEvent {
  sha: string;
  /** Author date, ISO 8601. */
  timestamp: string;
  /** `Name <email>`. */
  author: string;
  operation: MemoryOperation;
  type: string;
  id: string;
  /** `null` for `add`, and when the commit's patch shows no transition. */
  from: string | null;
  to: string | null;
  /** `Name <email> (role)`, or `null`. */
  approver: string | null;
  reason: string | null;
}

/** The parse of one log. */
export interface MemoryLog {
  /** Newest first, as git prints them. */
  events: MemoryEvent[];
  /** Commits matching the subject rule with no `+status:` line (spec-002 §3 rule 4), by sha. */
  warnings: string[];
}

const SUBJECT =
  /^wf\((?<type>[^)]+)\): (?<op>add|submit|approve|reject|deprecate) (?<id>\S+)(?: \[(?<from>[^\]]+) (?:→|->) (?<to>[^\]]+)\])?$/;
const HUNK = /^@@ -\d+(?:,(?<old>\d+))? \+\d+(?:,(?<new>\d+))? @@/;
const STATUS_LINE = /^status:[ \t]*(.*)$/;
const TRAILER_LINE = /^[A-Za-z][A-Za-z0-9-]*:[ \t]\S/;
const REASON_KEY = /^Reason:[ \t]*/;
const APPROVER_KEY = /^Approver:[ \t]*/;

/** A reason in WingFoil 0.2.2's normal form (`memory/commit-message.js` `normalizeReason`). */
export function normalizeReason(reason: string): string {
  return reason
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '')
    .replace(/^[ \t]+/, '');
}

/** Where the body's trailing trailer paragraph begins (`Co-Authored-By: …`), or `lines.length`. */
function trailerParagraphStart(lines: readonly string[]): number {
  let end = lines.length;
  while (end > 0 && lines[end - 1]!.trim() === '') end -= 1;
  let start = 0;
  for (let i = end - 1; i >= 0; i -= 1) {
    if (lines[i]!.trim() === '') {
      start = i + 1;
      break;
    }
  }
  if (start === 0 || start >= end) return lines.length;
  return lines.slice(start, end).every((line) => TRAILER_LINE.test(line)) ? start : lines.length;
}

/** The `Reason:` block of a body, as WingFoil 0.2.2 reads it (`parseReasonBlock`). */
function reasonOf(lines: readonly string[]): string | null {
  const start = lines.findIndex((line) => REASON_KEY.test(line));
  if (start === -1) return null;
  const end = Math.max(trailerParagraphStart(lines), start + 1);
  const block = [lines[start]!.replace(REASON_KEY, ''), ...lines.slice(start + 1, end)].join('\n');
  const normalized = normalizeReason(block);
  return normalized === '' ? null : normalized;
}

/** The `Approver:` value, read only on the body's first non-empty line. */
function approverOf(lines: readonly string[]): string | null {
  const first = lines.find((line) => line.trim() !== '');
  if (first === undefined || !APPROVER_KEY.test(first)) return null;
  const value = first.replace(APPROVER_KEY, '').trim();
  return value === '' ? null : value;
}

/** A frontmatter value without quotes and trailing comment. */
function statusValue(raw: string): string {
  let value = raw.replace(/\s+#.*$/, '').trim();
  if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
    value = value.slice(1, -1);
  }
  return value;
}

/** The file name of a `--- a/…` / `+++ b/…` header (`/dev/null` → `undefined`). */
function headerFile(line: string): string | undefined {
  let name = line.slice(4).replace(/\t$/, '');
  if (name === '/dev/null') return undefined;
  if (name.startsWith('"') && name.endsWith('"')) name = name.slice(1, -1);
  // The `a/` / `b/` prefixes (or none with `diff.noprefix`): only the base name is compared.
  return path.posix.basename(name);
}

/**
 * Whether the patch touches the file `<id>.md`, and its first `-status:` and `+status:` values
 * there.
 */
function transitionInPatch(patch: string, fileName: string): { touched: boolean; from?: string; to?: string } {
  const found: { touched: boolean; from?: string; to?: string } = { touched: false };
  let file: string | undefined;
  // Lines left in the current hunk: content lines are never read as headers.
  let oldLeft = 0;
  let newLeft = 0;
  for (const line of patch.split('\n')) {
    if (oldLeft > 0 || newLeft > 0) {
      const sign = line[0];
      if (sign === '-') oldLeft -= 1;
      else if (sign === '+') newLeft -= 1;
      else if (sign === ' ') {
        oldLeft -= 1;
        newLeft -= 1;
      }
      if (file !== fileName || (sign !== '-' && sign !== '+')) continue;
      const value = STATUS_LINE.exec(line.slice(1))?.[1];
      if (value === undefined) continue;
      if (sign === '-') found.from ??= statusValue(value);
      else found.to ??= statusValue(value);
      continue;
    }
    if (line.startsWith('diff --git ')) {
      file = line.endsWith(`/${fileName}`) || line.endsWith(` ${fileName}`) ? fileName : undefined;
    } else if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      file = headerFile(line) ?? file;
    } else {
      const hunk = HUNK.exec(line);
      if (hunk) {
        oldLeft = Number(hunk.groups?.old ?? 1);
        newLeft = Number(hunk.groups?.new ?? 1);
      }
    }
    if (file === fileName) found.touched = true;
  }
  return found;
}

interface RawRecord {
  sha: string;
  /** The record could not be read whole (fewer fields, a NUL in its patch): only its sha is sure. */
  damaged: boolean;
  timestamp: string;
  author: string;
  subject: string;
  body: string;
  patch: string;
}

/**
 * The records of the output, cut at the shas of the header-only read (see the module comment):
 * from the last record backwards, each one begins at the **last** `\n<sha>\0` before the next
 * record — a patch can quote an older commit's sha, never its own, so the cut is never moved by
 * a commit's content. A sha that cannot be found is a {@link MemoryLogFormatError}.
 */
function records(stdout: string, shas: readonly string[]): RawRecord[] {
  if (shas.length === 0) {
    if (stdout.trim() !== '') throw new MemoryLogFormatError('git log: output without commits');
    return [];
  }
  if (!shas.every((sha) => SHA.test(sha))) throw new MemoryLogFormatError('git log: an invalid commit sha');
  const starts: number[] = new Array<number>(shas.length);
  let end = stdout.length;
  for (let k = shas.length - 1; k >= 1; k -= 1) {
    const marker = `\n${shas[k]!}${NUL}`;
    const at = end - marker.length < 0 ? -1 : stdout.lastIndexOf(marker, end - marker.length);
    if (at < 0) throw new MemoryLogFormatError('git log: a commit of the history is missing from the patch read');
    starts[k] = at + 1;
    end = at;
  }
  if (!stdout.startsWith(`${shas[0]!}${NUL}`) || end < shas[0]!.length) {
    throw new MemoryLogFormatError('git log: the patch read does not start with the first commit');
  }
  starts[0] = 0;
  return shas.map((sha, k) => {
    const chunk = stdout.slice(starts[k]!, k + 1 < shas.length ? starts[k + 1]! - 1 : stdout.length);
    const fields: string[] = [];
    let from = 0;
    for (let f = 0; f < 5; f += 1) {
      const nul = chunk.indexOf(NUL, from);
      if (nul < 0) break;
      fields.push(chunk.slice(from, nul));
      from = nul + 1;
    }
    const patch = chunk.slice(from);
    const [, timestamp = '', author = '', subject = '', body = ''] = fields;
    return { sha, damaged: fields.length < 5 || patch.includes(NUL), timestamp, author, subject, body, patch };
  });
}

/**
 * Parse the output of the spec-002 §3 read (rules 1–4), cut at `shas` — the sha order of the same
 * walk without the patch (`GitReads.memoryLogShas`). A record that cannot be read whole (a NUL
 * in its patch) or a `wf` record with an unreadable date or author is skipped and listed in
 * `warnings`; the others are read. Throws {@link MemoryLogFormatError} when the output does not
 * match the sha list.
 */
export function parseMemoryLog(stdout: string, shas: readonly string[]): MemoryLog {
  const events: MemoryEvent[] = [];
  const warnings: string[] = [];
  for (const { sha, damaged, timestamp, author, subject, body, patch: diff } of records(stdout, shas)) {
    const match = SUBJECT.exec(subject);
    if (damaged && (match || subject === '')) warnings.push(sha);
    if (damaged || !match?.groups) continue;
    if (!ISO_DATE.test(timestamp) || !IDENT.test(author)) {
      warnings.push(sha);
      continue;
    }
    const { type, op, id, from: bracketFrom, to: bracketTo } = match.groups as Record<string, string | undefined>;
    // As `memory history`: only a commit that touches the element's own file is its event.
    const patch = transitionInPatch(diff, `${id!}.md`);
    if (!patch.touched) continue;
    const lines = body.replace(/\r\n?/g, '\n').split('\n');
    let from: string | null;
    let to: string | null;
    if (bracketFrom !== undefined && bracketTo !== undefined) {
      from = bracketFrom;
      to = bracketTo;
    } else {
      if (patch.to === undefined) {
        warnings.push(sha);
        from = null;
        to = null;
      } else {
        from = op === 'add' ? null : (patch.from ?? null);
        to = patch.to;
      }
    }
    events.push({
      sha,
      timestamp,
      author,
      operation: op as MemoryOperation,
      type: type!,
      id: id!,
      from,
      to,
      approver: approverOf(lines),
      reason: reasonOf(lines),
    });
  }
  return { events, warnings };
}

/** The events of each element, oldest first. */
export function eventsByElement(events: readonly MemoryEvent[]): Map<string, MemoryEvent[]> {
  const byId = new Map<string, MemoryEvent[]>();
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i]!;
    const list = byId.get(event.id);
    if (list) list.push(event);
    else byId.set(event.id, [event]);
  }
  return byId;
}

/**
 * The Memory directories of spec-002 §3, relative to the project root: for each type of
 * `memory.yaml`, the static prefix of its `path` up to the first `{` (its folder), de-duplicated,
 * nested ones dropped. A type without a static folder (`{release}/{id}.md`) gives the root (`.`).
 */
export function memoryDirectories(memoryYaml: MemoryYaml): string[] {
  const dirs = new Set<string>();
  for (const type of Object.values(memoryYaml.types)) {
    const fixed = type.path.split('{')[0] ?? '';
    const dir = path.posix.normalize(fixed.endsWith('/') ? fixed.slice(0, -1) : path.posix.dirname(fixed));
    if (dir === '.' || dir === '' || dir.startsWith('..') || path.posix.isAbsolute(dir)) return ['.'];
    dirs.add(dir);
  }
  const sorted = [...dirs].sort();
  return sorted.filter((dir) => !sorted.some((other) => other !== dir && dir.startsWith(`${other}/`)));
}

/** The bell's *Updates*: events of one page when no `limit` is given (spec-004 §3, REQ-PERF-11). */
export const MEMORY_EVENTS_LIMIT = 10;

/** The largest `limit` of one page (D31-2). */
export const MEMORY_EVENTS_MAX_LIMIT = 100;

/**
 * One page of `events` (newest first): at most `limit` events (default
 * {@link MEMORY_EVENTS_LIMIT}) after the event whose sha is `before` (exclusive; the newest when
 * absent), and whether older ones follow (spec-004 §3, D31-1). `undefined` when `before` names no
 * event of the log (history rewritten: the client starts again from the top). `limit` is checked
 * by the route.
 */
export function memoryEventsPage(
  events: readonly MemoryEvent[],
  page: { before?: string; limit?: number },
): { events: MemoryEvent[]; more: boolean } | undefined {
  let start = 0;
  if (page.before !== undefined) {
    const at = events.findIndex((e) => e.sha === page.before);
    if (at < 0) return undefined;
    start = at + 1;
  }
  const end = start + (page.limit ?? MEMORY_EVENTS_LIMIT);
  return { events: events.slice(start, end), more: end < events.length };
}
