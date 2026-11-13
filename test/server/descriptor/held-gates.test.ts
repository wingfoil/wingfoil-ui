// task-069 — held gates (spec-003 §3, §5, §8; spec-005 §4a; RP3-14 D5) and the actor of a `work`
// state entered by an `approve` (spec-003 §4, RP3-14 D6), on the definitions, histories and team
// WingFoil 0.3.1 captured for the custom fixture (the packs' governance: `release` `releasing` and
// `release-line` `active` are gates, a task approved into `backlog` is `work`). The oracle is the
// spec text and the scenarios S-24.5, S-24.6 and T-11.x, written by hand.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DnaShow, HistoryEntry, Identity, MemoryHistory, MemorySearch, TodayRow } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import {
  describeElement,
  type DescriptorHolds,
  type DescriptorProject,
} from '../../../server/src/descriptor/descriptor.js';
import { placement } from '../../../server/src/descriptor/placement.js';
import { today } from '../../../server/src/descriptor/today.js';
import { parseMemoryYaml } from '../../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { memberByName, type MemberName } from '../../harness/fixtures/index.js';
import { APPROVERS } from './standard.js';

const SAMPLES = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.3.1/custom');
const read = (file: string) => readFileSync(path.join(SAMPLES, file), 'utf8');
const memoryYaml = parseMemoryYaml(read('files/memory.yaml'));
const members = (JSON.parse(read('dna-show.json')) as DnaShow).team.members;
const matches = (JSON.parse(read('memory-search.json')) as MemorySearch).matches;
const history = (id: string) => (JSON.parse(read(`memory-history/${id}.json`)) as MemoryHistory).entries;

/** Holds as the effective `ui.yaml` gives them, with a fixed count of referencing elements. */
function holds(table: Record<string, Record<string, 'never' | 'when-references-done'>>, count = 0): DescriptorHolds {
  return {
    condition: (type, state) => table[type]?.[state],
    referencingNotDone: () => count,
  };
}

const SW_LIFE_CYCLE = { release: { releasing: 'never' }, 'release-line': { active: 'when-references-done' } } as const;

function project(h?: DescriptorHolds): DescriptorProject {
  return {
    memoryYaml,
    members,
    enablement: { identified: true, version: { supported: true, range: '0.2.2 to 0.3.x' } },
    ...(h ? { holds: h } : {}),
  };
}

const el = (type: string, status: string, id = `${type}-x`) => ({ id, type, status });

describe('held gates — the descriptor (spec-003 §3, §8; spec-005 §4a)', () => {
  it('never: no approve, the reject kept, approveHeld held-by-config, the actor still the approver role', () => {
    const d = describeElement(el('release', 'releasing', 'minor-v0.1'), [], project(holds(SW_LIFE_CYCLE)));
    expect(d.kind).toBe('gate');
    expect(d.verbs).toEqual([{ verb: 'reject', to: 'in-development', role: 'approver', enabled: true }]);
    expect(d.approveHeld).toEqual({ condition: 'never', reason: { code: 'held-by-config' } });
    expect(d.actor).toEqual({ kind: 'role', role: 'approver', members: APPROVERS });
    expect(d.bucket).toBe('to-approve'); // Q3 (a): the bucket follows the kind
  });

  it('when-references-done with referencing elements not done: held with their count', () => {
    const d = describeElement(el('release-line', 'active', 'rl-v1'), [], project(holds(SW_LIFE_CYCLE, 2)));
    expect(d.verbs.map((v) => v.verb)).toEqual(['reject']);
    expect(d.approveHeld).toEqual({
      condition: 'when-references-done',
      reason: { code: 'held-until-references-done', count: 2 },
    });
  });

  it('when-references-done with none left: not held, approve offered', () => {
    const d = describeElement(el('release-line', 'active', 'rl-v1'), [], project(holds(SW_LIFE_CYCLE, 0)));
    expect(d.verbs.map((v) => [v.verb, v.to])).toEqual([
      ['approve', 'done'],
      ['reject', 'planning'],
    ]);
    expect(d).not.toHaveProperty('approveHeld');
  });

  it('asks the count of the element itself', () => {
    const asked: string[] = [];
    describeElement(el('release-line', 'active', 'rl-v1'), [], {
      ...project(),
      holds: {
        condition: (type, state) => SW_LIFE_CYCLE[type as 'release-line']?.[state as 'active'],
        referencingNotDone: (id) => {
          asked.push(id);
          return 1;
        },
      },
    });
    expect(asked).toEqual(['rl-v1']);
  });

  it('a hold on a state that is not a gate of its type has no effect (spec-005 §1)', () => {
    const work = describeElement(el('release', 'planning'), [], project(holds({ release: { planning: 'never' } })));
    expect(work.kind).toBe('work');
    expect(work.verbs.map((v) => v.verb)).toEqual(['submit']);
    expect(work).not.toHaveProperty('approveHeld');
    const last = describeElement(el('release', 'released'), [], project(holds({ release: { released: 'never' } })));
    expect(last).not.toHaveProperty('approveHeld');
  });

  it('a hold on another type or state, or no holds at all, changes nothing', () => {
    const gate = el('task', 'in-review');
    const plain = describeElement(gate, [], project());
    expect(describeElement(gate, [], project(holds(SW_LIFE_CYCLE)))).toEqual(plain);
    expect(plain.verbs.map((v) => v.verb)).toEqual(['approve', 'reject']);
  });

  it('a held gate keeps the reject disabled by the enablement rules', () => {
    const d = describeElement(el('release', 'releasing'), [], {
      ...project(holds(SW_LIFE_CYCLE)),
      enablement: { identified: true, version: { supported: true, range: 'r' }, copy: { state: 'diverged' } },
    });
    expect(d.verbs).toEqual([
      { verb: 'reject', to: 'in-development', role: 'approver', enabled: false, reason: { code: 'copy-diverged' } },
    ]);
  });
});

const user = (name: MemberName, roles?: readonly string[]) => {
  const m = memberByName(name);
  return { email: m.email, roles: roles ?? m.roles };
};

describe('held gates — placement (spec-003 §5)', () => {
  const held = describeElement(el('release', 'releasing', 'minor-v0.1'), [], project(holds(SW_LIFE_CYCLE)));
  const plainGate = describeElement(el('release', 'releasing', 'minor-v0.1'), [], project());

  it('S-24.5 — never in Requires you of an approver, in the approver and the reviewer views', () => {
    expect(placement(plainGate, user('Morgan'), 'approver').list).toBe('requires-you');
    for (const view of ['approver', 'reviewer', 'tech-lead']) {
      expect(placement(held, user('Morgan', ['approver', 'reviewer', 'tech-lead']), view)).toEqual({
        list: 'waiting-on-others',
        who: held.actor,
      });
    }
  });

  it('in Waiting on others for a member without approver and for a user not identified', () => {
    expect(placement(held, user('Casey'), 'product-owner').list).toBe('waiting-on-others');
    expect(placement(held, undefined, '').list).toBe('waiting-on-others');
  });
});

const member = (name: MemberName, roles?: readonly string[]): Identity => {
  const m = memberByName(name);
  return { kind: 'member', email: m.email, name, roles: [...(roles ?? m.roles)] };
};

/** The Today rows of the 0.3.1 custom sample, with `extra` elements and their events. */
function rows(
  p: DescriptorProject,
  extra: { id: string; type: string; status: string; events?: HistoryEntry[] }[] = [],
) {
  const all = [
    ...matches.map((m) => ({ m, events: history(m.id) })),
    ...extra.map((e) => ({
      m: { ...matches[0]!, id: e.id, type: e.type, status: e.status, title: e.id },
      events: e.events ?? [],
    })),
  ];
  return all.map(({ m, events }): TodayRow => ({
    element: { id: m.id, type: m.type, title: m.title, status: m.status, localChanges: false },
    descriptor: describeElement(m, events, p),
  }));
}
const ids = (list: readonly { element: { id: string } }[] | null | undefined) => list?.map((r) => r.element.id);

describe('held gates — Today (spec-003 §5: not a pending gate)', () => {
  const extra = [{ id: 'rl-v1', type: 'release-line', status: 'active' }];

  it('the greeting and the summary count exclude a held gate; Waiting on others lists it', () => {
    const open = today(rows(project(), extra), member('Alex'), 'approver');
    const held = today(rows(project(holds(SW_LIFE_CYCLE, 1)), extra), member('Alex'), 'approver');
    expect(ids(open.requiresYou)).toContain('rl-v1');
    expect(ids(held.requiresYou)).not.toContain('rl-v1');
    expect(held.requiresYou!.length).toBe(open.requiresYou!.length - 1);
    expect(ids(held.waitingOnOthers)).toContain('rl-v1');
    const count = (t: typeof open) => t.summary?.find((l) => l.role === 'approver')?.count;
    expect(count(held)).toBe(count(open)! - 1);
  });

  it('S-24.6 — Casey (no approver role) sees it in Waiting on others', () => {
    const t = today(rows(project(holds(SW_LIFE_CYCLE, 1)), extra), member('Casey'), 'product-owner');
    const row = t.waitingOnOthers.find((r) => r.element.id === 'rl-v1')!;
    expect(row.descriptor.approveHeld?.reason).toEqual({ code: 'held-until-references-done', count: 1 });
  });
});

/** An event as WingFoil records it (spec-002 §1). */
function ev(operation: HistoryEntry['operation'], from: string | null, to: string, who: string, at: string) {
  return {
    sha: at,
    author: `${who} <${who.toLowerCase()}@example.test>`,
    timestamp: at,
    operation,
    from,
    to,
    approver: operation === 'approve' ? `${who} <${who.toLowerCase()}@example.test> (approver)` : null,
    reason: null,
    subject: `wf(x): ${operation ?? 'edit'} x`,
  } satisfies HistoryEntry;
}
const T = (n: number) => `2026-10-0${n}T10:00:00+00:00`;

describe('the actor of a work state entered by an approve (spec-003 §4, D6)', () => {
  const task = el('task', 'backlog');

  it('names the author of the submit that reached the gate, basis submitter', () => {
    const events = [
      ev('add', null, 'draft', 'Jordan', T(1)),
      ev('submit', 'draft', 'pending', 'Jordan', T(2)),
      ev('approve', 'pending', 'backlog', 'Morgan', T(3)),
    ];
    const d = describeElement(task, events, project());
    expect(d.kind).toBe('work');
    expect(d.actor).toEqual({
      kind: 'member',
      member: { name: 'Jordan', email: 'jordan@example.test' },
      basis: 'submitter',
    });
    expect(d.since).toBe(T(3));
  });

  it('the last submit before the approve, when the element went round more than once', () => {
    const events = [
      ev('submit', 'draft', 'pending', 'Jordan', T(1)),
      ev('reject', 'pending', 'draft', 'Morgan', T(2)),
      ev('submit', 'draft', 'pending', 'Sam', T(3)),
      ev('approve', 'pending', 'backlog', 'Morgan', T(4)),
    ];
    expect(describeElement(task, events, project()).actor.member?.name).toBe('Sam');
  });

  it('no submit before the approve (a rewritten history): the approve author, last-transition', () => {
    const events = [ev('approve', 'pending', 'backlog', 'Morgan', T(1))];
    expect(describeElement(task, events, project()).actor).toEqual({
      kind: 'member',
      member: { name: 'Morgan', email: 'morgan@example.test' },
      basis: 'last-transition',
    });
  });

  it('Q2 (a) — a submitter who is not a member: the tech-lead fallback', () => {
    const events = [
      ev('submit', 'draft', 'pending', 'Riley', T(1)),
      ev('approve', 'pending', 'backlog', 'Morgan', T(2)),
    ];
    const d = describeElement(task, events, project());
    expect(d.actor.kind).toBe('role');
    expect(d.actor.role).toBe('tech-lead');
    expect(d.actor.fallback).toBe('author-not-in-team');
  });

  it('a later move into the state that is not an approve keeps the last-transition rule', () => {
    const events = [
      ev('submit', 'draft', 'pending', 'Jordan', T(1)),
      ev('approve', 'pending', 'backlog', 'Morgan', T(2)),
      ev('start', 'backlog', 'in-progress', 'Alex', T(3)),
      ev('park', 'in-progress', 'backlog', 'Sam', T(4)),
    ];
    expect(describeElement(task, events, project()).actor).toMatchObject({
      member: { name: 'Sam' },
      basis: 'last-transition',
    });
  });

  it('an amend after the approve changes nothing (D48-6)', () => {
    const events = [
      ev('submit', 'draft', 'pending', 'Jordan', T(1)),
      ev('approve', 'pending', 'backlog', 'Morgan', T(2)),
      ev('amend', 'backlog', 'backlog', 'Morgan', T(3)),
    ];
    const d = describeElement(task, events, project());
    expect(d.actor).toMatchObject({ member: { name: 'Jordan' }, basis: 'submitter' });
    expect(d.since).toBe(T(2));
  });

  it('T-11.x on the 0.3.1 sample — a task approved into backlog is its submitter’s, not the approver’s', () => {
    const r = rows(project());
    const jordan = today(r, member('Jordan'), 'developer');
    expect(ids(jordan.requiresYou)).toEqual(expect.arrayContaining(['task-003-element-panel', 'task-004-themes']));
    for (const view of ['approver', 'tech-lead']) {
      const morgan = today(r, member('Morgan'), view);
      expect(ids(morgan.requiresYou)).not.toContain('task-003-element-panel');
      const row = morgan.waitingOnOthers.find((x) => x.element.id === 'task-003-element-panel')!;
      expect(row.descriptor.actor).toMatchObject({ member: { name: 'Jordan' }, basis: 'submitter' });
    }
  });
});
