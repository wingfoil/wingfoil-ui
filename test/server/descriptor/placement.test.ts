// spec-003 §5 — placement in the role views (Requires you, Waiting on others) and the order of
// Requires you; §6 — a verb whose role the user does not hold is not offered. Oracle:
// `00_conventions.md` *Identity and roles in steps*, `features/t/requires-you.feature`,
// `features/t/waiting-on-others.feature`.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DnaShow, MemoryHistory, MemorySearch } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { describeElement, type ActionDescriptor } from '../../../server/src/descriptor/descriptor.js';
import { compareRequiresYou, offeredVerbs, placement } from '../../../server/src/descriptor/placement.js';
import { parseMemoryYaml } from '../../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { memberByName, type FixtureKind, type MemberName } from '../../harness/fixtures/index.js';

const SAMPLES = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.2.2');
const read = (kind: FixtureKind, file: string) => readFileSync(path.join(SAMPLES, kind, file), 'utf8');

function descriptors(kind: FixtureKind): Map<string, ActionDescriptor> {
  const project = {
    memoryYaml: parseMemoryYaml(read(kind, 'files/memory.yaml')),
    members: (JSON.parse(read(kind, 'dna-show.json')) as DnaShow).team.members,
    enablement: { identified: true, version: { supported: true, range: '0.2.2' } },
  };
  const out = new Map<string, ActionDescriptor>();
  for (const m of (JSON.parse(read(kind, 'memory-search.json')) as MemorySearch).matches) {
    const events = (JSON.parse(read(kind, `memory-history/${m.id}.json`)) as MemoryHistory).entries;
    out.set(m.id, describeElement(m, events, project));
  }
  return out;
}

const user = (name: MemberName) => {
  const m = memberByName(name);
  return { email: m.email, roles: m.roles };
};

/** Requires you and Waiting on others of `name` in `view`, as id → action / who. */
function views(kind: FixtureKind, name: MemberName, view: string) {
  const requires: Record<string, string> = {};
  const waiting: string[] = [];
  for (const [id, d] of descriptors(kind)) {
    const p = placement(d, user(name), view);
    if (p.list === 'requires-you') requires[id] = p.action;
    if (p.list === 'waiting-on-others') waiting.push(id);
  }
  return { requires, waiting: waiting.sort() };
}

describe('placement (spec-003 §5)', () => {
  it('kanban, Jordan (developer): his rejected and his draft task; the gates wait on approver', () => {
    expect(views('kanban', 'Jordan', 'developer')).toEqual({
      requires: { 'task-002-password-reset': 'rework', 'task-004-session-timeout': 'submit' },
      waiting: ['bug-001-crash-on-save', 'task-001-login-form'],
    });
  });

  it('kanban, Morgan: gates in the approver view as Approve; not in tech-lead view', () => {
    expect(views('kanban', 'Morgan', 'approver').requires).toEqual({
      'bug-001-crash-on-save': 'approve',
      'task-001-login-form': 'approve',
    });
    expect(views('kanban', 'Morgan', 'tech-lead')).toEqual({
      requires: {},
      waiting: ['task-002-password-reset', 'task-004-session-timeout'],
    });
  });

  it('a member actor is in Requires you in every role view of that member', () => {
    for (const view of memberByName('Alex').roles) {
      expect(views('custom', 'Alex', view).requires['adr-001-local-server']).toBe('submit');
    }
  });

  it('Alex in the reviewer view: gates as Review', () => {
    expect(views('unknown', 'Alex', 'reviewer').requires).toEqual({ 'story-001-onboarding': 'review' });
  });

  it('Sam (reviewer, no approver): gates are reserved — in Waiting on others', () => {
    const v = views('kanban', 'Sam', 'reviewer');
    expect(v.requires).toEqual({});
    expect(v.waiting).toContain('task-001-login-form');
  });

  it('an undeclared state requires the tech-lead view only', () => {
    expect(views('unknown', 'Morgan', 'tech-lead').requires).toEqual({ 'note-002-retro': 'resolve' });
    expect(views('unknown', 'Morgan', 'approver').requires).toEqual({ 'story-001-onboarding': 'approve' });
    expect(views('unknown', 'Jordan', 'developer').waiting).toContain('note-002-retro');
  });

  it('engine-waiting elements wait on others; final ones are in no list', () => {
    const v = views('custom', 'Jordan', 'developer');
    expect(v.waiting).toEqual(
      expect.arrayContaining(['minor-v0.1', 'task-003-element-panel', 'task-004-themes', 'task-001-cli-adapter']),
    );
    expect(v.waiting).not.toContain('task-002-memory-list');
    expect(v.waiting).not.toContain('dl-001-initialise-wingfoil-before-inception');
    const engine = placement(descriptors('custom').get('minor-v0.1')!, user('Jordan'), 'developer');
    expect(engine).toEqual({ list: 'waiting-on-others', who: { kind: 'engine' } });
  });

  it('a gate-waiting element is never in Requires you', () => {
    const d = descriptors('custom').get('bug-001-toast-overlap')!;
    const triaged = { ...d, kind: 'gate-waiting' as const };
    expect(placement(triaged, user('Morgan'), 'approver').list).toBeNull();
    expect(placement(triaged, user('Sam'), 'reviewer').list).toBe('waiting-on-others');
  });

  it('a user with no identity sees nothing of their own', () => {
    const d = descriptors('kanban').get('task-004-session-timeout')!;
    expect(placement(d, undefined, 'developer').list).toBe('waiting-on-others');
  });
});

describe('Requires you order (spec-003 §5)', () => {
  it('rejected work first, then by time in the current state, oldest first, then id', () => {
    const base = descriptors('kanban').get('task-004-session-timeout')!;
    const a = { ...base, id: 'a', since: '2026-10-03T10:00:00+00:00' };
    const b = { ...base, id: 'b', since: '2026-10-01T10:00:00+00:00' };
    const c = { ...base, id: 'c', since: '2026-10-04T10:00:00+00:00', rejection: { by: 'M', reason: 'r', at: 'x' } };
    const d = { ...base, id: 'd' } as ActionDescriptor;
    delete d.since;
    const e = { ...base, id: 'e', since: '2026-10-01T10:00:00+00:00' };
    expect([a, d, b, c, e].sort(compareRequiresYou).map((x) => x.id)).toEqual(['c', 'b', 'e', 'a', 'd']);
    // An unparsable time sorts last too, consistently with an absent one (then by id).
    const f = { ...base, id: 'f', since: 'not a date' };
    expect([f, d, a].sort(compareRequiresYou).map((x) => x.id)).toEqual(['a', 'd', 'f']);
    expect([d, f, a].sort(compareRequiresYou).map((x) => x.id)).toEqual(['a', 'd', 'f']);
  });
});

describe('offered verbs (spec-003 §6)', () => {
  it('a verb whose role the user does not hold is not offered', () => {
    const gate = descriptors('kanban').get('task-001-login-form')!;
    expect(offeredVerbs(gate, user('Sam').roles)).toEqual([]);
    expect(offeredVerbs(gate, user('Morgan').roles).map((v) => v.verb)).toEqual(['approve', 'reject']);
    const draft = descriptors('kanban').get('task-004-session-timeout')!;
    expect(offeredVerbs(draft, []).map((v) => v.verb)).toEqual(['submit']);
  });
});
