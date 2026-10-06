/**
 * The project-wide Memory events of spec-002 §3: one `git log -p` over the Memory directories,
 * parsed into the events of every element (the source of the action descriptor's creator,
 * submitter, last reject and `since`, spec-003 §1), so that an element list costs one git process
 * per HEAD instead of one `memory history` per element (REQ-PERF-05). The element panel keeps
 * `memory history` (spec-002 §2).
 *
 * Pure: the git read is {@link GitReads.memoryLog}; here the output is parsed.
 */
import path from 'node:path';
import type { MemoryYaml } from '@wingfoil-ui/contracts';

/** The `--format` of the read (spec-002 §3): record separator, header fields, body end. */
export const MEMORY_LOG_FORMAT = '%x1e%H%x1f%aI%x1f%an <%ae>%x1f%s%x1f%b%x1d';

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

/** The first `-status:` and `+status:` values in the patch of the file `<id>.md`. */
function transitionInPatch(patch: string, fileName: string): { from?: string; to?: string } {
  const found: { from?: string; to?: string } = {};
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
      file = undefined;
    } else if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      file = headerFile(line) ?? file;
    } else {
      const hunk = HUNK.exec(line);
      if (hunk) {
        oldLeft = Number(hunk.groups?.old ?? 1);
        newLeft = Number(hunk.groups?.new ?? 1);
      }
    }
  }
  return found;
}

/** Parse the output of the spec-002 §3 read (rules 1–4). */
export function parseMemoryLog(stdout: string): MemoryLog {
  const events: MemoryEvent[] = [];
  const warnings: string[] = [];
  for (const record of stdout.split('\x1e')) {
    const end = record.indexOf('\x1d');
    if (end === -1) continue;
    const [sha = '', timestamp = '', author = '', subject = '', ...rest] = record.slice(0, end).split('\x1f');
    const match = SUBJECT.exec(subject);
    if (!match?.groups) continue;
    const { type, op, id, from: bracketFrom, to: bracketTo } = match.groups as Record<string, string | undefined>;
    const lines = rest.join('\x1f').replace(/\r\n?/g, '\n').split('\n');
    let from: string | null;
    let to: string | null;
    if (bracketFrom !== undefined && bracketTo !== undefined) {
      from = bracketFrom;
      to = bracketTo;
    } else {
      const patch = transitionInPatch(record.slice(end + 1), `${id!}.md`);
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
