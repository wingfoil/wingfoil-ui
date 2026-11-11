// task-073 — `state-limit` (spec-003 §6 rule 5; RP3-14 D11, RP3-15 F4; D73-2, D73-5): a `submit` or
// `approve` whose target state is at the type's `limits` is disabled with `state-limit {state,
// limit}`; a `reject` into a full state stays enabled (WingFoil exempts it, design probe P8). On the
// definitions WingFoil 0.3.1 captured for the custom fixture (`sprint` `limits: { active: 1 }`), with
// `task` given limits of its own for the gate cases. The oracle is the spec text and S-24.7.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { DnaShow } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { describeElement, type DescriptorProject, type Enablement } from '../../../server/src/descriptor/descriptor.js';
import { parseMemoryYaml } from '../../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../../harness/cli.js';

const SAMPLES = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.3.1/custom');
const read = (file: string) => readFileSync(path.join(SAMPLES, file), 'utf8');
const TEXT = read('files/memory.yaml');
const TASK_SEQUENCE = '      sequence: [ draft, pending, backlog, in-progress, in-review, approved, done ]\n';
if (!TEXT.includes(TASK_SEQUENCE)) throw new Error('the sample no longer has the task sequence this test extends');
/** The live definitions plus `task` limits on an approve target and a reject target. */
const memoryYaml = parseMemoryYaml(
  TEXT.replace(TASK_SEQUENCE, `${TASK_SEQUENCE}      limits: { approved: 1, in-progress: 1 }\n`),
);
const members = (JSON.parse(read('dna-show.json')) as DnaShow).team.members;

const ENABLED: Enablement = { identified: true, version: { supported: true, range: '0.2.2 to 0.3.x' } };

/** The occupancy of a type and state, from a table (`type/state` → count). */
function project(counts?: Record<string, number>, enablement: Enablement = ENABLED): DescriptorProject {
  return {
    memoryYaml,
    members,
    enablement,
    ...(counts ? { occupancy: (type: string, state: string) => counts[`${type}/${state}`] ?? 0 } : {}),
  };
}

const el = (type: string, status: string, id = `${type}-x`) => ({ id, type, status });

describe('state-limit — the descriptor (spec-003 §6 rule 5)', () => {
  it('submit into a full state is disabled with state-limit {state, limit}', () => {
    const d = describeElement(el('sprint', 'planned', 'sprint-002'), [], project({ 'sprint/active': 1 }));
    expect(d.verbs).toEqual([
      {
        verb: 'submit',
        to: 'active',
        role: null,
        enabled: false,
        reason: { code: 'state-limit', state: 'active', limit: 1 },
      },
    ]);
  });

  it('approve into a full state is disabled, its reject stays enabled', () => {
    const d = describeElement(el('task', 'in-review'), [], project({ 'task/approved': 1, 'task/in-progress': 1 }));
    expect(d.verbs).toEqual([
      {
        verb: 'approve',
        to: 'approved',
        role: 'approver',
        enabled: false,
        reason: { code: 'state-limit', state: 'approved', limit: 1 },
      },
      // `in-progress` is full too: a reject is never limited (design probe P8).
      { verb: 'reject', to: 'in-progress', role: 'approver', enabled: true },
    ]);
  });

  it('below the limit the move is enabled', () => {
    const d = describeElement(el('sprint', 'planned'), [], project({ 'sprint/active': 0 }));
    expect(d.verbs).toEqual([{ verb: 'submit', to: 'active', role: null, enabled: true }]);
  });

  it('above the limit (a reject filled it past N) the move is still disabled', () => {
    const d = describeElement(el('task', 'backlog'), [], project({ 'task/in-progress': 2 }));
    expect(d.verbs[0]).toMatchObject({ verb: 'submit', to: 'in-progress', enabled: false });
    expect(d.verbs[0]?.reason).toEqual({ code: 'state-limit', state: 'in-progress', limit: 1 });
  });

  it('counts the type of the element only', () => {
    const d = describeElement(el('sprint', 'planned'), [], project({ 'task/active': 5, 'release/active': 5 }));
    expect(d.verbs[0]?.enabled).toBe(true);
  });

  it.each([
    ['not-in-team', { ...ENABLED, identified: false }, { code: 'not-in-team' }],
    [
      'version-unsupported',
      { ...ENABLED, version: { supported: false, range: '0.2.2 to 0.3.x' } },
      { code: 'version-unsupported', range: '0.2.2 to 0.3.x' },
    ],
    ['local-changes', { ...ENABLED, localChanges: new Set(['sprint-002']) }, { code: 'local-changes' }],
    ['copy-behind', { ...ENABLED, copy: { state: 'behind', commits: 2 } }, { code: 'copy-behind', commits: 2 }],
    ['copy-diverged', { ...ENABLED, copy: { state: 'diverged' } }, { code: 'copy-diverged' }],
    ['copy-detached', { ...ENABLED, copy: { state: 'detached' } }, { code: 'copy-detached' }],
  ] as const)('rule %s wins over the limit', (_label, enablement, reason) => {
    const d = describeElement(el('sprint', 'planned', 'sprint-002'), [], project({ 'sprint/active': 1 }, enablement));
    expect(d.verbs[0]).toMatchObject({ enabled: false, reason });
  });

  it('no occupancy (a CLI that does not read limits) applies no limit', () => {
    const d = describeElement(el('sprint', 'planned'), [], project());
    expect(d.verbs).toEqual([{ verb: 'submit', to: 'active', role: null, enabled: true }]);
  });

  it('a limit on another state has no effect', () => {
    // `draft → planned`: `planned` declares no limit, whatever its count.
    const d = describeElement(el('sprint', 'draft'), [], project({ 'sprint/planned': 9, 'sprint/active': 1 }));
    expect(d.verbs).toEqual([{ verb: 'submit', to: 'planned', role: null, enabled: true }]);
  });

  it('a limit of defaults.states applies to a type without states', () => {
    const yaml = parseMemoryYaml(
      'version: 1\ndefaults:\n  states:\n    sequence: [ draft, doing, done ]\n    limits: { doing: 2 }\ntypes:\n  a:\n    path: a/{id}.md\n',
    );
    const d = describeElement(el('a', 'draft'), [], {
      memoryYaml: yaml,
      members,
      enablement: ENABLED,
      occupancy: (type, state) => (type === 'a' && state === 'doing' ? 2 : 0),
    });
    expect(d.verbs[0]).toMatchObject({
      verb: 'submit',
      enabled: false,
      reason: { code: 'state-limit', state: 'doing', limit: 2 },
    });
  });

  it('asks the occupancy of the target state of the element’s type', () => {
    const asked: string[] = [];
    describeElement(el('sprint', 'planned'), [], {
      ...project(),
      occupancy: (type, state) => {
        asked.push(`${type}/${state}`);
        return 0;
      },
    });
    expect(asked).toEqual(['sprint/active']);
  });
});
