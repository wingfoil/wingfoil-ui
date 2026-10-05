// spec-001 §4.1 — the `memory.yaml` subset and WingFoil 0.2.2's resolution rule
// (`resolveStateMachine`, `resolveTransitionTarget` of `dist/memory/state-machine.js`).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DirectReadError } from '../../../server/src/reads/confine.js';
import {
  BUILT_IN_STATES,
  declaredStates,
  parseMemoryYaml,
  resolveStates,
  transitionTarget,
} from '../../../server/src/reads/memory-yaml.js';
import { REPO_ROOT } from '../../harness/cli.js';

const sample = (kind: string) =>
  readFileSync(path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.2.2', kind, 'files/memory.yaml'), 'utf8');
const FILE = '.wingfoil/memory.yaml';

describe('parseMemoryYaml', () => {
  it('keeps only the keys of spec-001 §4.1', () => {
    const parsed = parseMemoryYaml(sample('custom'), FILE);
    expect(Object.keys(parsed).sort()).toEqual(['defaults', 'types', 'version']);
    const task = parsed.types.task!;
    expect(Object.keys(task).sort()).toEqual([
      'description',
      'id_pattern',
      'name',
      'path',
      'required',
      'states',
      'tags',
    ]);
    expect(task).toMatchObject({
      path: 'docs/04_memory/{release}/{id}.md',
      id_pattern: 'task-{n}-{slug}',
      name: 'Task',
      required: ['title', 'release'],
      states: { gates: { pending: { reject: 'draft' }, 'in-review': { reject: 'in-progress' } } },
    });
  });

  it('reads the kanban types without labels, and types with no states', () => {
    const parsed = parseMemoryYaml(sample('kanban'), FILE);
    expect(Object.keys(parsed.types).sort()).toEqual([
      'adr',
      'bug',
      'decision-log',
      'release',
      'release-line',
      'task',
      'tech-spec',
    ]);
    expect(parsed.types.task).toEqual({
      path: 'docs/memory/task/{id}.md',
      id_pattern: 'task-{n}-{slug}',
      required: ['id', 'type', 'title', 'status'],
    });
    expect(parsed.defaults?.states).toEqual({
      sequence: ['draft', 'pending', 'approved'],
      gates: { pending: { reject: 'draft' } },
    });
  });

  it('accepts what WingFoil 0.2.2 accepts: no id_pattern, a non-integer version, merge keys', () => {
    const parsed = parseMemoryYaml(
      [
        'version: 1.5',
        'types:',
        '  bug: &bug',
        '    path: bugs/{id}.md',
        '    id_pattern: "bug-{n}-{slug}"',
        '    states: { sequence: [ open, closed ] }',
        '  incident:',
        '    <<: *bug',
        '    path: incidents/{id}.md',
        '  note:',
        '    path: notes/{id}.md',
        '',
      ].join('\n'),
      FILE,
    );
    expect(parsed.version).toBe(1.5);
    expect(parsed.types.incident).toEqual({
      path: 'incidents/{id}.md',
      id_pattern: 'bug-{n}-{slug}',
      states: { sequence: ['open', 'closed'] },
    });
    expect(parsed.types.note).toEqual({ path: 'notes/{id}.md' });
  });

  it.each([
    ['a version that is not positive', 'version: 0\ntypes:\n  a:\n    path: a/{id}.md\n'],
    ['invalid YAML', 'types: [unclosed'],
    ['no types', 'version: 1\n'],
    ['a type without path', 'version: 1\ntypes:\n  a:\n    id_pattern: "a-{n}"\n'],
    [
      'an alias bomb',
      `version: 1\na: &a [x, x]\nb: &b [*a, *a, *a, *a, *a, *a, *a, *a, *a, *a]\nc: &c [*b, *b, *b, *b, *b, *b, *b, *b, *b, *b]\nd: [*c, *c, *c, *c, *c, *c, *c, *c, *c, *c]\ntypes:\n  a:\n    path: a/{id}.md\n`,
    ],
    [
      'a sequence that is not a list',
      'version: 1\ntypes:\n  a:\n    path: a/{id}.md\n    id_pattern: "a-{n}"\n    states:\n      sequence: draft\n',
    ],
    [
      'a version that is not an integer',
      'version: "one"\ntypes:\n  a:\n    path: a/{id}.md\n    id_pattern: "a-{n}"\n',
    ],
  ])('refuses %s with a read error naming the file', (_label, text) => {
    expect(() => parseMemoryYaml(text, FILE)).toThrow(DirectReadError);
    try {
      parseMemoryYaml(text, FILE);
    } catch (e) {
      expect(e).toMatchObject({ kind: 'shape', file: FILE });
    }
  });
});

describe('resolveStates — as a whole, no key-by-key merge', () => {
  const yaml = parseMemoryYaml(
    [
      'version: 1',
      'defaults:',
      '  states:',
      '    sequence: [ new, done ]',
      'types:',
      '  own:',
      '    path: own/{id}.md',
      '    id_pattern: "own-{n}"',
      '    states:',
      '      sequence: [ a, b, c ]',
      '      gates:',
      '        b: { reject: x }',
      '  shared:',
      '    path: shared/{id}.md',
      '    id_pattern: "shared-{n}"',
      '',
    ].join('\n'),
    FILE,
  );

  it("uses the type's states, else defaults.states, else the built-in machine", () => {
    expect(resolveStates(yaml, 'own')).toEqual({ sequence: ['a', 'b', 'c'], gates: { b: { reject: 'x' } } });
    expect(resolveStates(yaml, 'shared')).toEqual({ sequence: ['new', 'done'] });
    const noDefaults = parseMemoryYaml(
      'version: 1\ntypes:\n  t:\n    path: t/{id}.md\n    id_pattern: "t-{n}"\n',
      FILE,
    );
    expect(resolveStates(noDefaults, 't')).toEqual(BUILT_IN_STATES);
    expect(BUILT_IN_STATES).toEqual({
      sequence: ['draft', 'pending', 'approved'],
      gates: { pending: { reject: 'draft' } },
    });
  });

  it('is undefined for a type memory.yaml does not declare', () => {
    expect(resolveStates(yaml, 'nope')).toBeUndefined();
  });

  it('declared states: the sequence, every reject target (also outside it) and deprecated', () => {
    expect(declaredStates(resolveStates(yaml, 'own')!)).toEqual(['a', 'b', 'c', 'x', 'deprecated']);
  });
});

describe('transitionTarget — what the CLI allows (WingFoil 0.2.2 rules)', () => {
  const machine = {
    sequence: ['draft', 'open', 'triaged', 'planned', 'done'],
    gates: { open: { reject: 'closed' }, triaged: { reject: 'closed' } },
    waiting: ['triaged', 'planned'],
  };
  it.each([
    ['submit', 'draft', 'open'],
    ['submit', 'open', undefined], // a gate: approve, not submit
    ['submit', 'planned', undefined], // waiting
    ['submit', 'done', undefined], // last
    ['submit', 'closed', undefined], // not in sequence
    ['approve', 'open', 'triaged'],
    ['approve', 'triaged', undefined], // gate and waiting
    ['approve', 'draft', undefined], // not a gate
    ['reject', 'open', 'closed'],
    ['reject', 'triaged', 'closed'],
    ['reject', 'draft', undefined],
    ['deprecate', 'planned', 'deprecated'],
  ] as const)('%s from %s → %s', (op, from, to) => {
    expect(transitionTarget(machine, from, op)).toBe(to);
  });

  it('a gate at the end of the sequence cannot be approved', () => {
    expect(transitionTarget({ sequence: ['a', 'b'], gates: { b: { reject: 'a' } } }, 'b', 'approve')).toBeUndefined();
  });
});
