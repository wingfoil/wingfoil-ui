/**
 * The text rules of the API bodies (spec-004 §5; task-056 AC-1, D56-1): every string a body takes
 * from a tool or from the repository is written through one of them where the route serialises it,
 * never earlier — the snapshot, its caches and the action descriptor keep the texts as read (the
 * descriptor matches the authors' emails on them, spec-002 §1).
 *
 * | Class | What | Rule |
 * |-------|------|------|
 * | (a) tool message | a CLI or git message, a CLI warning, **commit text** (a history entry's `subject`, `reason`, `author`, `approver`; a Memory event's `author`, `approver`, `reason`; the descriptor's `rejection`) | the whole sanitiser `redactLocalPaths` with the project's roots ({@link TextSanitiser}) |
 * | (b) repository display text | an element **title** (`/elements`, `/elements/:eid`, the Today rows, the candidates of spec-011 §3, spec-012's `ElementRef`), the pattern references, the `ui.yaml` strings `/config` echoes | {@link repositoryText} (`neutralise`) |
 * | (c) key | an element id, type, state, a role, a path the page sends back — whatever its source (an event's `type`, `id`, `from`, `to` come from the commit subject and patch) | as returned |
 * | (d) document content | a frontmatter value, an element or directive body, a working-tree file | as written: the page renders it as a document — but `rejection_reason`, which `memory reject` writes from its reason: class (a) ({@link frontmatterBody}) |
 *
 * The repository display text outside the fields (b) names — the DNA's names and descriptions, the
 * directives' names and titles, the workflow texts, a file tree's names, the project list's name and
 * `remote` — is not escaped yet (bug-035). The CLI adapter's own tool texts (its `stderr` warnings,
 * the `memory search` message, a refusal's message and reasons) are class (a) through the same
 * sanitiser, applied by the adapter (`toolLines`, `WingfoilCli.sanitise`); `test/server/http/text-sweep.test.ts`
 * holds the whole enumeration.
 */
import type { ActionDescriptor, MemoryEventEntry, MemoryHistory, MemoryMatch } from '@wingfoil-ui/contracts';
import { neutralise, redactLocalPaths, type LocalRoots } from '../git/redact.js';
import { REJECTION_REASON_FIELD } from '../presets/wingfoil.js';

/** The rule of class (a): one text in, the sanitised text out. */
export type TextSanitiser = (text: string) => string;

/** Class (b): `text` with every unsafe character as a visible escape and a backslash doubled. */
export function repositoryText(text: string): string {
  return neutralise(text);
}

/**
 * Class (a) for the project of `roots` (its folder, its repository's, the CLI's package folder; the
 * home directory by default): `redactLocalPaths`, each distinct text sanitised once.
 */
export function toolTextSanitiser(roots: LocalRoots): TextSanitiser {
  const done = new Map<string, string>();
  return (text) => {
    let out = done.get(text);
    if (out === undefined) done.set(text, (out = redactLocalPaths(text, roots)));
    return out;
  };
}

/** `text` through `sanitise`, `null` kept. */
const nullable = (text: string | null, sanitise: TextSanitiser): string | null =>
  text === null ? null : sanitise(text);

/** A `memory search` match with its title as class (b); its keys as returned. */
export function matchBody<T extends Pick<MemoryMatch, 'title'>>(match: T): T {
  return { ...match, title: repositoryText(match.title) };
}

/** A descriptor with its `rejection` (commit text, spec-003 §8) as class (a); the rest unchanged. */
export function descriptorBody(descriptor: ActionDescriptor, sanitise: TextSanitiser): ActionDescriptor {
  const { rejection } = descriptor;
  if (rejection === undefined) return descriptor;
  return {
    ...descriptor,
    rejection: { ...rejection, by: sanitise(rejection.by), reason: nullable(rejection.reason, sanitise) },
  };
}

/**
 * `memory history` with each entry on the contract's fields only — the fields a newer CLI adds
 * (WingFoil 0.3.x's `wingfoil`, W-34) are not passed on (task-048 D48-8) — and its commit texts
 * (`subject`, `reason`, `author`, `approver`) as class (a) (bug-027).
 */
export function historyBody({ id, path, entries }: MemoryHistory, sanitise: TextSanitiser): MemoryHistory {
  return {
    id,
    path,
    entries: entries.map(({ sha, author, timestamp, operation, from, to, approver, reason, subject }) => ({
      sha,
      author: sanitise(author),
      timestamp,
      operation,
      from,
      to,
      approver: nullable(approver, sanitise),
      reason: nullable(reason, sanitise),
      subject: sanitise(subject),
    })),
  };
}

/** A Memory event with its commit texts (`author`, `approver`, `reason`) as class (a) (bug-027). */
export function memoryEventBody<T extends Pick<MemoryEventEntry, 'author' | 'approver' | 'reason'>>(
  event: T,
  sanitise: TextSanitiser,
): T {
  return {
    ...event,
    author: sanitise(event.author),
    approver: nullable(event.approver, sanitise),
    reason: nullable(event.reason, sanitise),
  };
}

/**
 * An element's frontmatter as written (class (d)), but for the one free-text field a WingFoil verb
 * writes: `rejection_reason`, set by `memory reject` from its `--reason` (spec-001 §3) — commit
 * text, class (a), like the descriptor's `rejection.reason` (review round 1). The other verbs write
 * `status` (a key) and, through their arguments, keys and versions (`release`, `supersedes`, the id
 * pattern's tokens).
 */
export function frontmatterBody<T extends object>(frontmatter: T, sanitise: TextSanitiser): T {
  const reason = (frontmatter as Record<string, unknown>)[REJECTION_REASON_FIELD];
  if (typeof reason !== 'string') return frontmatter;
  return { ...frontmatter, [REJECTION_REASON_FIELD]: sanitise(reason) };
}
