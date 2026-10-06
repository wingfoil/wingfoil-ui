// spec-003, REQ-ARC-06 (TT-ARC-06) — the action descriptor, table-driven over the standard elements
// of the three fixtures (definitions, histories and team as WingFoil 0.2.2 captured them) and over
// the §9 synthetic rows. The oracle is `02_bdd/00_conventions.md` (*Standard elements*, *Identity
// and roles in steps*) and the tables of spec-003 §2–§7, written by hand — never computed with the
// code under test.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { DnaShow, HistoryEntry, MemoryHistory, MemorySearch, MemoryYaml } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import {
  bucketOf,
  describeElement,
  describeElements,
  stateKind,
  toneOf,
  type DescriptorProject,
  type Enablement,
} from '../../../server/src/descriptor/descriptor.js';
import { parseMemoryYaml, resolveStates } from '../../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../../harness/cli.js';
import type { FixtureKind } from '../../harness/fixtures/index.js';
import { LAST, observed, ROWS, STANDARD, TECH_LEADS } from './standard.js';

const SAMPLES = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.2.2');
const sample = (kind: FixtureKind, file: string) => readFileSync(path.join(SAMPLES, kind, file), 'utf8');
const memoryYaml = (kind: FixtureKind): MemoryYaml => parseMemoryYaml(sample(kind, 'files/memory.yaml'));
const matches = (kind: FixtureKind) => (JSON.parse(sample(kind, 'memory-search.json')) as MemorySearch).matches;
const history = (kind: FixtureKind, id: string) =>
  (JSON.parse(sample(kind, `memory-history/${id}.json`)) as MemoryHistory).entries;
const members = (kind: FixtureKind) => (JSON.parse(sample(kind, 'dna-show.json')) as DnaShow).team.members;

const OPEN: Enablement = { identified: true, version: { supported: true, range: '0.2.2' } };
const project = (kind: FixtureKind, enablement: Enablement = OPEN): DescriptorProject => ({
  memoryYaml: memoryYaml(kind),
  members: members(kind),
  enablement,
});

describe('TT-ARC-06 — the standard elements of the three fixtures', () => {
  it('covers every element of every fixture (the table is complete)', () => {
    for (const kind of ['kanban', 'custom', 'unknown'] as const) {
      expect(Object.keys(STANDARD[kind]).sort()).toEqual(
        matches(kind)
          .map((m) => m.id)
          .sort(),
      );
    }
  });

  it.each(ROWS)('$kind $id', ({ kind, id, row }) => {
    const m = matches(kind).find((x) => x.id === id)!;
    const d = describeElement(m, history(kind, id), project(kind));
    expect({ id: d.id, type: d.type, status: d.status }).toEqual({ id, type: m.type, status: m.status });
    expect(observed(d)).toEqual(row);
    for (const v of d.verbs) expect(v).toEqual({ verb: v.verb, to: v.to, role: v.role, enabled: true });
  });

  it('gives 100 % of the rows (summary)', () => {
    let ok = 0;
    for (const { kind, id, row } of ROWS) {
      const m = matches(kind).find((x) => x.id === id)!;
      if (isDeepStrictEqual(observed(describeElement(m, history(kind, id), project(kind))), row)) ok++;
    }
    expect(ok / ROWS.length).toBe(1);
  });

  it('dates the rejection and the time in the current state from the events', () => {
    const id = 'task-002-password-reset';
    const entries = history('kanban', id);
    const reject = entries.at(-1)!;
    const d = describeElement(
      matches('kanban').find((m) => m.id === id)!,
      entries,
      project('kanban'),
    );
    expect(d.rejection).toEqual({ by: 'Morgan', reason: 'Missing acceptance criteria', at: reject.timestamp });
    expect(d.since).toBe(reject.timestamp);
    expect(d.actor.member).toEqual({ name: 'Jordan', email: 'jordan@example.test' });
  });

  it('describeElements keeps the order of the list and reads each element’s events', () => {
    const all = describeElements(matches('custom'), (id) => history('custom', id), project('custom'));
    expect(all.map((d) => d.id)).toEqual(matches('custom').map((m) => m.id));
  });
});

/** An event as WingFoil records it (spec-002 §1). */
function ev(
  operation: HistoryEntry['operation'],
  from: string | null,
  to: string,
  who: string,
  at: string,
  extra: Partial<HistoryEntry> = {},
): HistoryEntry {
  const emails: Record<string, string> = { Riley: 'riley@example.test' };
  const email = emails[who] ?? `${who.toLowerCase()}@example.test`;
  return {
    sha: at,
    author: `${who} <${email}>`,
    timestamp: at,
    operation,
    from,
    to,
    approver: null,
    reason: null,
    subject: `wf(x): ${operation ?? 'edit'} x`,
    ...extra,
  };
}
const T = (n: number) => `2026-10-0${n}T10:00:00+00:00`;

describe('spec-003 §9 — the synthetic rows', () => {
  const custom = project('custom');
  const el = (type: string, status: string) => ({ id: `${type}-x`, type, status });

  it('custom bug triaged is gate-waiting: reject only (reserved to approver), engine actor, Waiting bucket', () => {
    const d = describeElement(el('bug', 'triaged'), [], custom);
    expect(observed(d)).toEqual({
      kind: 'gate-waiting',
      verbs: [['reject', 'closed', 'approver']],
      actor: { kind: 'engine' },
      tone: 'human',
      bucket: 'waiting',
    });
  });

  it('custom task in-progress is work: submit, the author of the last transition into it', () => {
    const events = [
      ev('add', null, 'draft', 'Jordan', T(1)),
      ev('submit', 'draft', 'pending', 'Jordan', T(2)),
      ev('approve', 'pending', 'backlog', 'Morgan', T(3)),
      ev(null, 'backlog', 'in-progress', 'Alex', T(4)),
    ];
    const d = describeElement(el('task', 'in-progress'), events, custom);
    expect(observed(d)).toEqual({
      kind: 'work',
      verbs: [['submit', 'in-review', null]],
      actor: { kind: 'member', member: 'Alex' },
      tone: 'active',
      bucket: 'in-progress',
    });
    expect(d.since).toBe(T(4));
  });

  it('work after a reject: the member whose submit was rejected, with the reason', () => {
    const events = [
      ev(null, 'backlog', 'in-progress', 'Alex', T(1)),
      ev('submit', 'in-progress', 'in-review', 'Jordan', T(2)),
      ev('reject', 'in-review', 'in-progress', 'Morgan', T(3), {
        approver: 'Morgan <morgan@example.test> (approver)',
        reason: 'Tests missing',
      }),
    ];
    const d = describeElement(el('task', 'in-progress'), events, custom);
    expect(d.actor).toEqual({ kind: 'member', member: { name: 'Jordan', email: 'jordan@example.test' } });
    expect(d.rejection).toEqual({ by: 'Morgan', reason: 'Tests missing', at: T(3) });
  });

  it('a waiting state followed only by an archived one is last (custom adr accepted, tech-spec approved)', () => {
    expect(observed(describeElement(el('adr', 'accepted'), [], custom))).toEqual(LAST);
    expect(observed(describeElement(el('tech-spec', 'approved'), [], custom))).toEqual(LAST);
  });

  it('archived states are final and muted, with no bucket', () => {
    for (const d of [
      describeElement(el('adr', 'superseded'), [], custom),
      describeElement(el('task', 'deprecated'), [], custom),
    ]) {
      expect(observed(d)).toEqual({
        kind: 'archived',
        verbs: [],
        actor: { kind: 'none' },
        tone: 'muted',
        bucket: undefined,
      });
    }
  });

  const synthetic = (states: NonNullable<MemoryYaml['types'][string]['states']>): DescriptorProject => ({
    ...custom,
    memoryYaml: { version: 1, types: { flow: { path: 'docs/{id}.md', states } } },
  });

  it('a gate on the last state offers its reject (and no approve)', () => {
    const p = synthetic({ sequence: ['a', 'b'], gates: { b: { reject: 'a' } } });
    expect(observed(describeElement(el('flow', 'b'), [], p))).toEqual({
      ...LAST,
      verbs: [['reject', 'a', 'approver']],
    });
  });

  it('a reject target outside the sequence is off-sequence: final, done tone, Waiting bucket', () => {
    const p = synthetic({ sequence: ['a', 'b', 'c'], gates: { b: { reject: 'x' } } });
    expect(observed(describeElement(el('flow', 'x'), [], p))).toEqual({
      kind: 'off-sequence',
      verbs: [],
      actor: { kind: 'none' },
      tone: 'done',
      bucket: 'waiting',
    });
  });

  it('a type memory.yaml does not declare is undeclared', () => {
    expect(stateKind(resolveStates(custom.memoryYaml, 'ghost'), 'draft')).toBe('undeclared');
    expect(stateKind(undefined, 'deprecated')).toBe('archived');
  });

  it('falls back to the tech-lead role when the author is not in the team or there is no event', () => {
    const fallback = { kind: 'role', role: 'tech-lead', members: TECH_LEADS, fallback: 'author-not-in-team' };
    const outsider = describeElement(el('adr', 'draft'), [ev('add', null, 'draft', 'Riley', T(1))], custom);
    expect(outsider.actor).toEqual(fallback);
    expect(describeElement(el('adr', 'draft'), [], custom).actor).toEqual(fallback);
    expect(describeElement(el('adr', 'draft'), [], custom).since).toBeUndefined();
    // A member with no email (optional in 0.2.2) is never matched.
    const noEmail = { ...custom, members: custom.members.map(({ email: _e, ...m }) => m) };
    expect(describeElement(el('adr', 'draft'), [ev('add', null, 'draft', 'Alex', T(1))], noEmail).actor.fallback).toBe(
      'author-not-in-team',
    );
  });

  it('a rejected element whose rejected submit is unknown falls back too', () => {
    const events = [ev('reject', 'pending', 'draft', 'Morgan', T(2), { reason: 'No' })];
    const d = describeElement(el('adr', 'draft'), events, custom);
    expect(d.actor.fallback).toBe('author-not-in-team');
    expect(d.rejection).toEqual({ by: 'Morgan', reason: 'No', at: T(2) });
  });

  it('a reject with no reason still reports the rejection', () => {
    const events = [ev('submit', 'draft', 'pending', 'Jordan', T(1)), ev('reject', 'pending', 'draft', 'Morgan', T(2))];
    expect(describeElement(el('adr', 'draft'), events, custom).rejection).toEqual({
      by: 'Morgan',
      reason: null,
      at: T(2),
    });
  });

  it('an edit outside a verb after the reject does not hide it', () => {
    const events = [
      ev('submit', 'draft', 'pending', 'Jordan', T(1)),
      ev('reject', 'pending', 'draft', 'Morgan', T(2), { reason: 'No' }),
      ev(null, 'draft', 'draft', 'Jordan', T(3)),
    ];
    const d = describeElement(el('adr', 'draft'), events, custom);
    expect(d.actor.member?.name).toBe('Jordan');
    expect(d.since).toBe(T(2));
  });

  it('the output carries the bucket of its kind, none when archived (custom adr accepted Done, superseded none)', () => {
    expect(describeElement(el('adr', 'accepted'), [], custom).bucket).toBe('done');
    expect('bucket' in describeElement(el('adr', 'superseded'), [], custom)).toBe(false);
    for (const { kind, id } of ROWS) {
      const d = describeElement(
        matches(kind).find((m) => m.id === id)!,
        history(kind, id),
        project(kind),
      );
      expect(d.bucket).toBe(bucketOf(d.kind));
    }
  });

  it('tones and buckets per kind (spec-003 §7, memory-list.feature)', () => {
    expect(
      Object.fromEntries(
        (
          [
            'first',
            'work',
            'gate',
            'gate-waiting',
            'waiting',
            'last',
            'off-sequence',
            'undeclared',
            'archived',
          ] as const
        ).map((k) => [k, [toneOf(k), bucketOf(k)]]),
      ),
    ).toEqual({
      first: ['neutral', 'waiting'],
      work: ['active', 'in-progress'],
      gate: ['human', 'to-approve'],
      'gate-waiting': ['human', 'waiting'],
      waiting: ['neutral', 'waiting'],
      last: ['done', 'done'],
      'off-sequence': ['done', 'waiting'],
      undeclared: ['attention', 'in-progress'],
      archived: ['muted', undefined],
    });
  });
});

describe('spec-003 §6 — enablement', () => {
  const kanbanGate = () => matches('kanban').find((m) => m.id === 'task-001-login-form')!;
  const reasons = (enablement: Enablement) =>
    describeElement(kanbanGate(), [], project('kanban', enablement)).verbs.map((v) => [v.enabled, v.reason]);

  it('every verb is enabled when the four rules hold', () => {
    expect(reasons({ ...OPEN, localChanges: new Set(['other']), copy: { state: 'ok' } })).toEqual([
      [true, undefined],
      [true, undefined],
    ]);
  });

  it('gives the first failing reason, in the order of §6', () => {
    const all: Enablement = {
      identified: false,
      version: { supported: false, range: '>=0.2.2 <0.3.0' },
      localChanges: new Set(['task-001-login-form']),
      copy: { state: 'behind', commits: 1 },
    };
    expect(reasons(all)[0]).toEqual([false, { code: 'not-in-team' }]);
    expect(reasons({ ...all, identified: true })[0]).toEqual([
      false,
      { code: 'version-unsupported', range: '>=0.2.2 <0.3.0' },
    ]);
    expect(reasons({ ...all, identified: true, version: OPEN.version })[0]).toEqual([false, { code: 'local-changes' }]);
    expect(reasons({ ...OPEN, copy: { state: 'behind', commits: 2 } })[1]).toEqual([
      false,
      { code: 'copy-behind', commits: 2 },
    ]);
    expect(reasons({ ...OPEN, copy: { state: 'diverged' } })[0]).toEqual([false, { code: 'copy-diverged' }]);
    expect(reasons({ ...OPEN, copy: { state: 'detached' } })[0]).toEqual([false, { code: 'copy-detached' }]);
  });

  it('the role is not an enablement rule', () => {
    // Sam (reviewer) or no one: the descriptor does not depend on the user's roles.
    expect(reasons(OPEN)).toEqual([
      [true, undefined],
      [true, undefined],
    ]);
  });
});
