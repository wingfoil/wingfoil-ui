/**
 * Pure helpers of the element panel (ux-reference §4.2): what the panel shows of the element read
 * (`GET /api/p/:pid/elements/:eid`) and of its history (`…/history`, spec-002 §2). Nothing here
 * knows a type or state name (REQ-ARC-05): states and fields are the project's data.
 */
import type { HistoryEntry, HistoryOperation } from '@wingfoil-ui/contracts';

/** The member name of `Name <email>` or `Name <email> (role)` (the CLI's author and approver). */
export function memberName(ident: string): string {
  const at = ident.indexOf('<');
  return (at === -1 ? ident : ident.slice(0, at)).trim();
}

/** Where a state chip stands against the current state. */
export type ChipPosition = 'past' | 'current' | 'future' | 'other';

/** One chip of the state machine. */
export interface StateChip {
  name: string;
  position: ChipPosition;
}

/**
 * The state machine chips: the type's `sequence` marked past / current / future around the current
 * state; when the current state is outside the sequence (off-sequence, undeclared, archived), the
 * sequence unmarked (`other`) and the current state after it; without the type's states (an
 * unreadable `memory.yaml`), only the current state.
 */
export function stateChips(sequence: readonly string[] | undefined, current: string): StateChip[] {
  if (!sequence) return [{ name: current, position: 'current' }];
  const at = sequence.indexOf(current);
  if (at === -1) {
    return [
      ...sequence.map((name): StateChip => ({ name, position: 'other' })),
      { name: current, position: 'current' },
    ];
  }
  return sequence.map((name, i) => ({ name, position: i < at ? 'past' : i === at ? 'current' : 'future' }));
}

/**
 * The summary of a Markdown body in v0.1: its first paragraph as plain text — HTML comments (the
 * scaffold's placeholders) and headings skipped, lines joined —, `undefined` when there is none.
 * The rendered document is US-G-03 (v0.3).
 */
export function summaryOf(body: string): string | undefined {
  const text = body.replace(/<!--[\s\S]*?(?:-->|$)/g, '');
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== '' && !l.startsWith('#'));
    if (lines.length > 0) return lines.join(' ').replace(/\s+/g, ' ');
  }
  return undefined;
}

/** The frontmatter keys every element has (shown in the panel's header, not as fields). */
const CORE_FIELDS: ReadonlySet<string> = new Set(['id', 'type', 'title', 'status']);

/** A frontmatter field of the element and its values as text (empty: no value). */
export interface FieldEntry {
  field: string;
  values: string[];
}

function valuesOf(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(valuesOf);
  if (typeof value === 'string') return value.trim() === '' ? [] : [value];
  if (typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  return [JSON.stringify(value)];
}

/** The frontmatter fields beyond `id`, `type`, `title`, `status`, in file order. */
export function fieldEntries(frontmatter: Readonly<Record<string, unknown>>): FieldEntry[] {
  return Object.entries(frontmatter)
    .filter(([field]) => !CORE_FIELDS.has(field))
    .map(([field, value]) => ({ field, values: valuesOf(value) }));
}

/** Who made a history entry: the approver of an approve or reject, else the commit author. */
export function actorName(entry: HistoryEntry): string {
  return memberName(entry.approver ?? entry.author);
}

/** A history operation, with `edit` for a commit that is not a WingFoil verb (spec-002 §2). */
export type HistoryLineOperation = Exclude<HistoryOperation, null> | 'edit';

/** One line of the panel's history. */
export interface HistoryLine {
  sha: string;
  /** The first 7 characters of the commit hash. */
  shortSha: string;
  operation: HistoryLineOperation;
  name: string;
  timestamp: string;
  from: string | null;
  to: string | null;
  reason: string | null;
}

/** The history lines, newest first. */
export function historyLines(entries: readonly HistoryEntry[]): HistoryLine[] {
  return [...entries].reverse().map((e) => ({
    sha: e.sha,
    shortSha: e.sha.slice(0, 7),
    operation: e.operation ?? 'edit',
    name: actorName(e),
    timestamp: e.timestamp,
    from: e.from,
    to: e.to,
    reason: e.reason,
  }));
}
