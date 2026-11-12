/**
 * The text rules of the API bodies (spec-004 §5; task-056 AC-1, D56-1): every string a body takes
 * from a tool or from the repository is written through one of them where the route serialises it,
 * never earlier — the snapshot, its caches and the action descriptor keep the texts as read (the
 * descriptor matches the authors' emails on them, spec-002 §1).
 *
 * | Class | What | Rule |
 * |-------|------|------|
 * | (a) tool message | a CLI or git message, a CLI warning, **commit text** (a history entry's `subject`, `reason`, `author`, `approver`; a Memory event's `author`, `approver`, `reason`; the descriptor's `rejection`) | the whole sanitiser `redactLocalPaths` with the project's roots ({@link TextSanitiser}) |
 * | (b) repository display text | any string a body takes from the project — a committed or working-tree file, a file or folder name, the project's `origin`, the user's git email, the console's stored copy of one — that the page only shows (task-072 D72-1): an element **title** (`/elements`, `/elements/:eid`, the Today rows, the candidates of spec-011 §3, spec-012's `ElementRef`), the pattern references, the `ui.yaml` strings `/config` echoes, the DNA's texts ({@link dnaBody}), the workflow texts ({@link workflowsBody}), member names and emails wherever they are ({@link identityBody}, {@link descriptorBody}), the project's name and `remote` ({@link projectItemBody}), a directive's `name` and `title` ({@link directiveBody}), a history entry's and a Memory event's states, a file-tree name, a documentation path's `label`, a repository path in an error detail | {@link repositoryText} (`neutralise`) |
 * | (c) key | a value the page sends back, builds an address from, or compares with another key — an element id, type, state, a role, a path — whatever its source (an event's `type` and `id` come from the commit subject); a key that is also shown gets a display sibling (a documentation path's `label`) | as returned |
 * | (d) document content | a frontmatter value, an element or directive body, a working-tree file | as written: the page renders it as a document — but `rejection_reason`, which `memory reject` writes from its reason: class (a) ({@link frontmatterBody}) |
 *
 * Keys stay raw even where the page shows them (bug-041). The CLI adapter's own tool texts (its `stderr` warnings,
 * the `memory search` message, a refusal's message and reasons) are class (a) through the same
 * sanitiser, applied by the adapter (`toolLines`, `WingfoilCli.sanitise`); `test/server/http/text-sweep.test.ts`
 * holds the whole enumeration.
 */
import type {
  ActionDescriptor,
  DescriptorActor,
  DirectiveEntry,
  DnaShow,
  Identity,
  MemoryEventEntry,
  MemoryHistory,
  MemoryMatch,
  ProjectListItem,
  WorkflowList,
} from '@wingfoil-ui/contracts';
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

/** An actor with its member's name and email and its members' names as class (b) (task-072 D72-3). */
function actorBody(actor: DescriptorActor): DescriptorActor {
  const { member, members } = actor;
  if (member === undefined && members === undefined) return actor;
  return {
    ...actor,
    ...(member !== undefined
      ? { member: { ...member, name: repositoryText(member.name), email: repositoryText(member.email) } }
      : {}),
    ...(members !== undefined ? { members: members.map(repositoryText) } : {}),
  };
}

/**
 * A descriptor with its `rejection` (commit text, spec-003 §8) as class (a) and its actor's names and
 * email as class (b) (task-072 D72-3: the same text as the DNA's and the identity's); the rest
 * unchanged. Written after the descriptor matched the raw texts.
 */
export function descriptorBody(descriptor: ActionDescriptor, sanitise: TextSanitiser): ActionDescriptor {
  const { rejection } = descriptor;
  const actor = actorBody(descriptor.actor);
  if (rejection === undefined && actor === descriptor.actor) return descriptor;
  return {
    ...descriptor,
    actor,
    ...(rejection !== undefined
      ? { rejection: { ...rejection, by: sanitise(rejection.by), reason: nullable(rejection.reason, sanitise) } }
      : {}),
  };
}

/**
 * The identity of a project's header with its names and email as class (b) (task-072 D72-3, Q3):
 * the member's name, the ambiguous members' names, the user's effective email — matched on the raw
 * values before ({@link identityBody} never matches); the roles are keys.
 */
export function identityBody(identity: Identity): Identity {
  switch (identity.kind) {
    case 'member':
      return { ...identity, email: repositoryText(identity.email), name: repositoryText(identity.name) };
    case 'not-in-team':
      return { ...identity, email: repositoryText(identity.email) };
    case 'ambiguous':
      return { ...identity, email: repositoryText(identity.email), members: identity.members.map(repositoryText) };
    default:
      return identity;
  }
}

/**
 * A project-list item with its `name` and `remote` as class (b) (task-072 D72-4); the stored entry
 * keeps them raw (its refresh and the duplicate-remote check compare raw values).
 */
export function projectItemBody(item: ProjectListItem): ProjectListItem {
  return { ...item, name: repositoryText(item.name), remote: repositoryText(item.remote) };
}

/**
 * A directive's frontmatter (a list entry's, or the file's: the page's heading) with its `name` and
 * `title` as class (b) (task-072 D72-5); the rest as written (classes (c) and (d)).
 */
export function directiveFrontmatterBody<T extends object>(frontmatter: T): T {
  const out = { ...frontmatter } as Record<string, unknown>;
  for (const field of ['name', 'title']) {
    const value = out[field];
    if (typeof value === 'string') out[field] = repositoryText(value);
  }
  return out as T;
}

/** A `directives list` entry with its frontmatter's `name` and `title` as class (b) (task-072 D72-5). */
export function directiveBody<T extends Pick<DirectiveEntry, 'frontmatter'>>(entry: T): T {
  return { ...entry, frontmatter: directiveFrontmatterBody(entry.frontmatter) };
}

/**
 * `value` with every string leaf as class (b) but at the paths `keys` lists (`.a.b[].c`: a property
 * by its name, an array's items as `[]`) and with the subtrees `kept` lists returned as they are;
 * an object's keys are never changed.
 */
function displayLeaves(value: unknown, at: string, keys: ReadonlySet<string>, kept: ReadonlySet<string>): unknown {
  if (kept.has(at)) return value;
  if (typeof value === 'string') return keys.has(at) ? value : repositoryText(value);
  if (Array.isArray(value)) return value.map((v) => displayLeaves(v, `${at}[]`, keys, kept));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, displayLeaves(v, `${at}.${k}`, keys, kept)]));
  }
  return value;
}

/** The keys of `dna show`: the role names, as the roles are named everywhere (task-072 D72-2). */
export const DNA_KEYS: ReadonlySet<string> = new Set([
  '.team.roles[].name',
  '.team.members[].roles[]',
  '.team.agents[].executes_as[]',
]);

/**
 * `dna show` for `/config` (task-072 D72-2): every string escaped (class (b)) — the fields a newer
 * CLI adds included — but {@link DNA_KEYS}; the shape and every object key kept.
 */
export function dnaBody(data: DnaShow): DnaShow {
  return displayLeaves(data, '', DNA_KEYS, new Set()) as DnaShow;
}

/** The keys of `workflow list`, both version lines (task-072 D72-2). */
export const WORKFLOW_KEYS: ReadonlySet<string> = new Set([
  '.manifest.include[]',
  '.workflows[].name',
  '.workflows[].kind',
  '.workflows[].element',
  '.workflows[].phases[].name',
  '.workflows[].phases[].role',
  '.workflows[].phases[].approval.by_role',
  '.workflows[].phases[].fallback.step',
  '.workflows[].phases[].fallback.set_state',
  '.workflows[].phases[].include',
  '.workflows[].phases[].iterate_over',
]);

/**
 * The parts of WingFoil 0.3.x's `workflow list` the adapter already sanitised as tool text (class
 * (a), `toolText`) or that are a sha: never escaped twice.
 */
const WORKFLOW_SANITISED: ReadonlySet<string> = new Set(['.message', '.diagnostics', '.baseline']);

/**
 * `workflow list` for `/config` (task-072 D72-2): every string escaped (class (b)) — descriptions,
 * 0.2.x phase texts, the fields a newer CLI adds — but {@link WORKFLOW_KEYS} and the sanitised parts.
 */
export function workflowsBody(data: WorkflowList): WorkflowList {
  return displayLeaves(data, '', WORKFLOW_KEYS, WORKFLOW_SANITISED) as WorkflowList;
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
      // A history entry's states are only shown (task-072 D72-8): class (b).
      from: from === null ? null : repositoryText(from),
      to: to === null ? null : repositoryText(to),
      approver: nullable(approver, sanitise),
      reason: nullable(reason, sanitise),
      subject: sanitise(subject),
    })),
  };
}

/**
 * A Memory event with its commit texts (`author`, `approver`, `reason`) as class (a) (bug-027) and
 * its states (`from`, `to`) as class (b): only shown, as a history entry's (task-072 review round 1
 * F-2); its `type` and `id` stay keys (the page compares them and links to the element, D56-8).
 */
export function memoryEventBody<T extends Pick<MemoryEventEntry, 'author' | 'approver' | 'reason' | 'from' | 'to'>>(
  event: T,
  sanitise: TextSanitiser,
): T {
  return {
    ...event,
    from: event.from === null ? null : repositoryText(event.from),
    to: event.to === null ? null : repositoryText(event.to),
    author: sanitise(event.author),
    approver: nullable(event.approver, sanitise),
    reason: nullable(event.reason, sanitise),
  };
}

/** `value` with every string leaf through `sanitise`, its shape kept (an object's keys stay keys). */
function sanitiseLeaves(value: unknown, sanitise: TextSanitiser): unknown {
  if (typeof value === 'string') return sanitise(value);
  if (Array.isArray(value)) return value.map((v) => sanitiseLeaves(v, sanitise));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitiseLeaves(v, sanitise)]));
  }
  return value;
}

/**
 * An element's frontmatter as written (class (d)), but for the one free-text field a WingFoil
 * transition verb writes: `rejection_reason`, set by `memory reject` from its `--reason` (spec-001
 * §3) — commit text, class (a), like the descriptor's `rejection.reason` (review round 1), as a
 * whole: a value committed by hand as a list or an object has every string leaf sanitised, its shape
 * and its keys kept (review round 2). The other verbs write `status` (a key) and, through their
 * arguments, keys and versions (`release`, `supersedes`, the id pattern's tokens).
 */
export function frontmatterBody<T extends object>(frontmatter: T, sanitise: TextSanitiser): T {
  if (!Object.hasOwn(frontmatter, REJECTION_REASON_FIELD)) return frontmatter;
  const reason = (frontmatter as Record<string, unknown>)[REJECTION_REASON_FIELD];
  return { ...frontmatter, [REJECTION_REASON_FIELD]: sanitiseLeaves(reason, sanitise) };
}
