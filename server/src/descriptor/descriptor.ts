/**
 * The action descriptor (spec-003, REQ-ARC-06): for each element, from the project's own
 * definitions only — its resolved states (`memory.yaml`), its events, the team (`dna show`) — the
 * state kind, the verbs WingFoil 0.2.2 accepts, who must act, the enablement of each verb and the
 * tone. No type or state name of any methodology appears here (REQ-ARC-05); WingFoil's own
 * vocabulary comes from `presets/`.
 *
 * Pure: every input is passed in, nothing is read here. The caller (task-012) reads the inputs
 * once per repository state (adr-001 D6) and serves the result with the element list.
 */
import type {
  ActionDescriptor,
  DescriptorActor,
  DescriptorRejection,
  DescriptorVerb,
  DisabledReason,
  DnaMember,
  HistoryOperation,
  MemoryYaml,
  StateKind,
  StateMachine,
  Tone,
} from '@wingfoil-ui/contracts';
import { ARCHIVED_KIND, BUCKET_OF_KIND, TONE_OF_KIND, type Bucket } from '../presets/descriptor.js';
import { APPROVER_ROLE, ARCHIVED_STATES, TECH_LEAD_ROLE } from '../presets/wingfoil.js';
import { resolveStates, transitionTarget } from '../reads/memory-yaml.js';

export type { ActionDescriptor } from '@wingfoil-ui/contracts';
export type { Bucket } from '../presets/descriptor.js';

/**
 * One event of an element (spec-002 §1), oldest first. A `memory history` entry and a spec-002
 * project-wide event both fit. `operation: null` is a commit outside a WingFoil verb: it counts
 * only when it changed the state (`from` ≠ `to`).
 */
export interface DescriptorEvent {
  /** ISO 8601. */
  timestamp: string;
  /** `Name <email>`. */
  author: string;
  operation: HistoryOperation;
  from: string | null;
  to: string | null;
  /** `Name <email> (role)`, or `null`. */
  approver: string | null;
  reason: string | null;
}

/** The element as `memory search` lists it. */
export interface DescribedElement {
  id: string;
  type: string;
  status: string;
}

/** The state of the working copy against its remote (REQ-STATE-04; v0.2). */
export type CopyState =
  { state: 'ok' } | { state: 'behind'; commits: number } | { state: 'diverged' } | { state: 'detached' };

/** The inputs of the four enablement rules of spec-003 §6. */
export interface Enablement {
  /** The current user is identified in the team (REQ-SEC-08). */
  identified: boolean;
  /** The project's WingFoil version against the supported range. */
  version: { supported: boolean; range: string };
  /** Ids of the elements whose file has local changes (REQ-STATE-03); none when absent. */
  localChanges?: ReadonlySet<string>;
  /** The copy against its remote; `ok` when absent. */
  copy?: CopyState;
}

/** The project-wide inputs of the descriptor. */
export interface DescriptorProject {
  memoryYaml: MemoryYaml;
  /** `dna.team.members`. */
  members: readonly DnaMember[];
  enablement: Enablement;
}

const isArchived = (state: string): boolean => (ARCHIVED_STATES as readonly string[]).includes(state);

/** The state kind of `status` in `machine` (spec-003 §2); `undefined` machine: an undeclared type. */
export function stateKind(machine: StateMachine | undefined, status: string): StateKind {
  if (isArchived(status)) return ARCHIVED_KIND;
  if (!machine) return 'undeclared';
  const { sequence } = machine;
  const gates = machine.gates ?? {};
  if (!sequence.includes(status)) {
    return Object.values(gates).some((g) => g.reject === status) ? 'off-sequence' : 'undeclared';
  }
  const end = sequence.filter((s) => !isArchived(s)).at(-1);
  if (status === end) return 'last';
  const gate = Object.hasOwn(gates, status);
  const waiting = (machine.waiting ?? []).includes(status);
  if (gate && waiting) return 'gate-waiting';
  if (gate) return 'gate';
  if (waiting) return 'waiting';
  return status === sequence[0] ? 'first' : 'work';
}

/** The tone of a kind (spec-003 §7). */
export function toneOf(kind: StateKind): Tone {
  return TONE_OF_KIND[kind];
}

/** The Memory list bucket of a kind (`memory-list.feature`; see {@link BUCKET_OF_KIND}). */
export function bucketOf(kind: StateKind): Bucket | undefined {
  return BUCKET_OF_KIND[kind];
}

/** The verbs of spec-003 §3, with their targets and roles (enablement added by the caller). */
function verbsOf(
  machine: StateMachine | undefined,
  status: string,
  kind: StateKind,
): Omit<DescriptorVerb, 'enabled'>[] {
  if (!machine) return [];
  const out: Omit<DescriptorVerb, 'enabled'>[] = [];
  const add = (verb: DescriptorVerb['verb'], role: string | null) => {
    const to = transitionTarget(machine, status, verb);
    // Transitions into the archived set are not offered in the MVP (spec-003 §9).
    if (to !== undefined && !isArchived(to)) out.push({ verb, to, role });
  };
  switch (kind) {
    case 'first':
    case 'work':
      add('submit', null);
      break;
    case 'gate':
      add('approve', APPROVER_ROLE);
      add('reject', APPROVER_ROLE);
      break;
    case 'gate-waiting':
      add('reject', APPROVER_ROLE);
      break;
    case 'last':
      // A gate on the last state: WingFoil accepts its reject.
      add('reject', APPROVER_ROLE);
      break;
  }
  return out;
}

/** The first failing rule of spec-003 §6 for element `id`, or `undefined`. */
function disabledReason(id: string, enablement: Enablement): DisabledReason | undefined {
  if (!enablement.identified) return { code: 'not-in-team' };
  if (!enablement.version.supported) return { code: 'version-unsupported', range: enablement.version.range };
  if (enablement.localChanges?.has(id)) return { code: 'local-changes' };
  const copy = enablement.copy;
  if (copy?.state === 'behind') return { code: 'copy-behind', commits: copy.commits };
  if (copy?.state === 'diverged') return { code: 'copy-diverged' };
  if (copy?.state === 'detached') return { code: 'copy-detached' };
  return undefined;
}

/** `Name` of `Name <email>` or `Name <email> (role)`. */
function nameOf(person: string): string {
  return /^(.*?)\s*<[^>]*>/.exec(person)?.[1] ?? person;
}

/** `email` of `Name <email>`, lower-cased. */
function emailOf(person: string): string | undefined {
  return /<([^>]*)>/.exec(person)?.[1]?.toLowerCase();
}

/** Who must act, from the team: a member, a role with its holders, or the fallback. */
class Team {
  constructor(private readonly members: readonly DnaMember[]) {}

  member(author: string | undefined): DescriptorActor | undefined {
    const email = author === undefined ? undefined : emailOf(author);
    const m = email ? this.members.find((x) => x.email?.toLowerCase() === email) : undefined;
    return m?.email ? { kind: 'member', member: { name: m.name, email: m.email } } : undefined;
  }

  role(role: string): DescriptorActor {
    return { kind: 'role', role, members: this.members.filter((m) => m.roles.includes(role)).map((m) => m.name) };
  }

  /** The member who authored `author`, else the tech-lead role "Author not in the team". */
  memberOrFallback(author: string | undefined): DescriptorActor {
    return this.member(author) ?? { ...this.role(TECH_LEAD_ROLE), fallback: 'author-not-in-team' };
  }
}

/** The events that moved the element: every verb, and commits outside a verb that changed the state. */
function transitions(events: readonly DescriptorEvent[]): DescriptorEvent[] {
  return events.filter((e) => e.operation !== null || (e.to !== null && e.from !== e.to));
}

function actorOf(kind: StateKind, status: string, moves: readonly DescriptorEvent[], team: Team): DescriptorActor {
  switch (kind) {
    case 'first':
    case 'work': {
      const last = moves.at(-1);
      if (last?.operation === 'reject') {
        const before = moves.slice(0, -1);
        return team.memberOrFallback(before.findLast((e) => e.operation === 'submit')?.author);
      }
      if (kind === 'first') return team.memberOrFallback(moves.find((e) => e.operation === 'add')?.author);
      return team.memberOrFallback(moves.findLast((e) => e.to === status)?.author);
    }
    case 'gate':
    case 'gate-waiting':
      return team.role(APPROVER_ROLE);
    case 'waiting':
      return { kind: 'engine' };
    case 'undeclared':
      return team.role(TECH_LEAD_ROLE);
    default:
      return { kind: 'none' };
  }
}

function rejectionOf(status: string, moves: readonly DescriptorEvent[]): DescriptorRejection | undefined {
  const last = moves.at(-1);
  if (last?.operation !== 'reject' || last.to !== status) return undefined;
  return { by: nameOf(last.approver ?? last.author), reason: last.reason, at: last.timestamp };
}

/** The action descriptor of one element (spec-003 §8); `events` oldest first. */
export function describeElement(
  element: DescribedElement,
  events: readonly DescriptorEvent[],
  project: DescriptorProject,
): ActionDescriptor {
  const { id, type, status } = element;
  const machine = resolveStates(project.memoryYaml, type);
  const kind = stateKind(machine, status);
  const reason = disabledReason(id, project.enablement);
  const verbs = verbsOf(machine, status, kind).map((v): DescriptorVerb =>
    reason ? { ...v, enabled: false, reason } : { ...v, enabled: true },
  );
  const moves = transitions(events);
  const rejection = rejectionOf(status, moves);
  const since = moves.findLast((e) => e.to === status)?.timestamp;
  return {
    id,
    type,
    status,
    kind,
    tone: toneOf(kind),
    verbs,
    actor: actorOf(kind, status, moves, new Team(project.members)),
    ...(rejection ? { rejection } : {}),
    ...(since !== undefined ? { since } : {}),
  };
}

/** The descriptors of `elements`, in their order; `eventsOf(id)` gives each element's events. */
export function describeElements(
  elements: readonly DescribedElement[],
  eventsOf: (id: string) => readonly DescriptorEvent[],
  project: DescriptorProject,
): ActionDescriptor[] {
  return elements.map((e) => describeElement(e, eventsOf(e.id), project));
}
