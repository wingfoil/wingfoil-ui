// The oracle of TT-ARC-06 (spec-003, REQ-ARC-06): what the action descriptor must say for every
// standard element of the three fixtures, written by hand from `02_bdd/00_conventions.md`
// (*Standard elements*, *Identity and roles in steps*) and spec-003 §2–§7 — never computed with
// the code under test. Shared by the unit test (captured samples) and the contract test (fixtures
// built with the pinned CLI).
import { bucketOf, type ActionDescriptor } from '../../../server/src/descriptor/descriptor.js';
import type { FixtureKind } from '../../harness/fixtures/index.js';

export const APPROVERS = ['Morgan', 'Alex'];
export const TECH_LEADS = ['Morgan', 'Alex'];

export type V = [verb: 'submit' | 'approve' | 'reject', to: string, role: string | null];
export interface Row {
  kind: string;
  verbs: V[];
  actor:
    | { kind: 'member'; member: string }
    | { kind: 'role'; role: string; members: string[] }
    | { kind: 'engine' | 'none' };
  rejection?: { by: string; reason: string };
  tone: string;
  bucket: string | undefined;
}

const gate = (approveTo: string, rejectTo: string): Row => ({
  kind: 'gate',
  verbs: [
    ['approve', approveTo, 'approver'],
    ['reject', rejectTo, 'approver'],
  ],
  actor: { kind: 'role', role: 'approver', members: APPROVERS },
  tone: 'human',
  bucket: 'to-approve',
});
const first = (submitTo: string, member: string): Row => ({
  kind: 'first',
  verbs: [['submit', submitTo, null]],
  actor: { kind: 'member', member },
  tone: 'neutral',
  bucket: 'waiting',
});
export const LAST: Row = { kind: 'last', verbs: [], actor: { kind: 'none' }, tone: 'done', bucket: 'done' };
const WAITING: Row = { kind: 'waiting', verbs: [], actor: { kind: 'engine' }, tone: 'neutral', bucket: 'waiting' };

/** Every standard element of the three fixtures (`00_conventions.md`). */
export const STANDARD: Record<FixtureKind, Record<string, Row>> = {
  kanban: {
    'task-001-login-form': gate('approved', 'draft'),
    'task-002-password-reset': {
      ...first('pending', 'Jordan'),
      rejection: { by: 'Morgan', reason: 'Missing acceptance criteria' },
    },
    'task-003-logout': LAST,
    'task-004-session-timeout': first('pending', 'Jordan'),
    'bug-001-crash-on-save': gate('approved', 'draft'),
  },
  custom: {
    'adr-001-local-server': first('pending', 'Alex'),
    'bug-001-toast-overlap': gate('triaged', 'closed'),
    'dl-001-initialise-wingfoil-before-inception': LAST,
    'dl-002-use-fastify': gate('ready', 'draft'),
    'minor-v0.1': WAITING,
    'task-001-cli-adapter': gate('approved', 'in-progress'),
    'task-002-memory-list': LAST,
    'task-003-element-panel': WAITING,
    'task-004-themes': WAITING,
  },
  unknown: {
    'note-001-kickoff': first('archived', 'Casey'),
    'note-002-retro': {
      kind: 'undeclared',
      verbs: [],
      actor: { kind: 'role', role: 'tech-lead', members: TECH_LEADS },
      tone: 'attention',
      bucket: 'in-progress',
    },
    'story-001-onboarding': gate('ready-to-build', 'idea'),
    'story-002-billing': WAITING,
  },
};

/** The descriptor's answer for one row, in the oracle's terms. */
export function observed(d: ActionDescriptor): Row {
  const actor =
    d.actor.kind === 'member'
      ? { kind: 'member' as const, member: d.actor.member!.name }
      : d.actor.kind === 'role'
        ? { kind: 'role' as const, role: d.actor.role!, members: d.actor.members! }
        : { kind: d.actor.kind };
  return {
    kind: d.kind,
    verbs: d.verbs.map((v): V => [v.verb, v.to, v.role]),
    actor,
    ...(d.rejection ? { rejection: { by: d.rejection.by, reason: d.rejection.reason ?? '' } } : {}),
    tone: d.tone,
    bucket: bucketOf(d.kind),
  };
}

/** Every row: fixture, element id, expectation. */
export const ROWS = (Object.entries(STANDARD) as [FixtureKind, Record<string, Row>][]).flatMap(([kind, rows]) =>
  Object.entries(rows).map(([id, row]) => ({ kind, id, row })),
);
