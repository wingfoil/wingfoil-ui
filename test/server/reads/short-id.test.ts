// spec-011 §1 (task-057 AC-1) — the short id of an element from its full id and its type's
// `id_pattern`: the literal prefix before `{n}` plus the digits; none for a pattern without `{n}`,
// with `{n}` first or another token before it, for an id that does not follow its pattern, and for
// every element when `memory.yaml` is unreadable. Every `id_pattern` of this repository's
// `.wingfoil/memory.yaml` and of the three fixtures' captured `memory.yaml` is covered.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MemoryYaml } from '../../../contracts/src/files.js';
import { parseMemoryYaml } from '../../../server/src/reads/memory-yaml.js';
import { shortIdOf, shortIdsOf } from '../../../server/src/reads/short-id.js';
import { REPO_ROOT } from '../../harness/cli.js';

const FILES = [
  '.wingfoil/memory.yaml',
  ...['wingfoil-0.2.2', 'wingfoil-0.3.1'].flatMap((v) =>
    ['kanban', 'custom', 'unknown'].map((kind) => `test/contracts/samples/${v}/${kind}/files/memory.yaml`),
  ),
];
const read = (file: string): MemoryYaml =>
  parseMemoryYaml(readFileSync(path.join(REPO_ROOT, file), 'utf8'), '.wingfoil/memory.yaml');

/** Every pattern of {@link FILES}: an id it makes, and that id's short id. */
const PATTERNS: Record<string, [id: string, short: string | undefined]> = {
  'task-{n}-{slug}': ['task-046-wingfoil-0.3-support', 'task-046'],
  'adr-{n}-{slug}': ['adr-003-console-discovery', 'adr-003'],
  'dl-{n}-{slug}': ['dl-002-use-fastify', 'dl-002'],
  'spec-{n}-{slug}': ['spec-011-element-addressing', 'spec-011'],
  'bug-{n}-{slug}': ['bug-019-long-ids', 'bug-019'],
  'svc-{n}-{slug}': ['svc-001-github-repository', 'svc-001'],
  'story-{n}-{slug}': ['story-001-search', 'story-001'],
  'note-{n}-{slug}': ['note-002-meeting', 'note-002'],
  'sprint-{n}': ['sprint-001', 'sprint-001'],
  'release-{n}': ['release-1', 'release-1'],
  'rl-{n}': ['rl-1', 'rl-1'],
  'rl-{version}': ['rl-v1', undefined],
  '{kind}-{version}': ['minor-v0.1', undefined],
  '{workflow}-{phase}-plan': ['backlog-item-rel-v0.3-plan', undefined],
};

describe('shortIdOf on every id_pattern of this repository and of the fixtures', () => {
  const found = new Set<string>();
  for (const file of FILES) {
    for (const def of Object.values(read(file).types)) if (def.id_pattern !== undefined) found.add(def.id_pattern);
  }

  it('knows every pattern the files declare', () => {
    expect([...found].filter((p) => !(p in PATTERNS))).toEqual([]);
  });

  it.each([...found].map((p) => [p, ...PATTERNS[p]!] as const))('%s: %s → %s', (pattern, id, short) => {
    expect(shortIdOf(id, pattern)).toBe(short);
  });
});

describe('shortIdOf — the rule (spec-011 §1)', () => {
  it.each([
    ['the longest digit run', 'task-0461x-a', 'task-{n}-{slug}', 'task-0461'],
    ['digits up to the end', 'task-46', 'task-{n}-{slug}', 'task-46'],
    ['the first {n} only', 'a-12-34', 'a-{n}-{n}', 'a-12'],
    ['a prefix with regular-expression characters, taken literally', 'a.*(-7-x', 'a.*(-{n}-{slug}', 'a.*(-7'],
  ])('%s', (_name, id, pattern, short) => {
    expect(shortIdOf(id, pattern)).toBe(short);
  });

  it.each([
    ['no pattern', 'task-046-x', undefined],
    ['a pattern without {n}', 'minor-v0.1', '{kind}-{version}'],
    ['{n} first: a bare number is no address', '046-x', '{n}-{slug}'],
    ['another token before {n}', 'x1-046', '{scope}-{n}'],
    // The id holds the token's text itself, so only the `{` check refuses it (review round 1, m2).
    ['another token before {n}, the id spelling it', '{scope}-046', '{scope}-{n}'],
    ['a token inside the prefix', 'ab-046', 'a{x}b-{n}'],
    ['a token inside the prefix, the id spelling it', 'a{x}b-046', 'a{x}b-{n}'],
    ['an id with another prefix', 'tasks-046-x', 'task-{n}-{slug}'],
    ['no digit after the prefix', 'task-abc', 'task-{n}-{slug}'],
    ['the prefix alone', 'task-', 'task-{n}-{slug}'],
    ['an id shorter than the prefix', 'tas', 'task-{n}-{slug}'],
    ['non-ASCII digits', 'task-٠٤٦-x', 'task-{n}-{slug}'],
    ['a regular-expression prefix that would match', 'abbb-1', 'ab+-{n}'],
    ['another case', 'TASK-046-x', 'task-{n}-{slug}'],
  ])('none: %s', (_name, id, pattern) => {
    expect(shortIdOf(id, pattern)).toBeUndefined();
  });

  it('scans hostile lengths linearly (one prefix comparison and one digit scan)', () => {
    const prefix = `${'(a+)+'.repeat(2000)}-`;
    expect(shortIdOf(`${prefix}${'9'.repeat(10_000)}x`, `${prefix}{n}`)).toBe(`${prefix}${'9'.repeat(10_000)}`);
    expect(shortIdOf(`${'a'.repeat(10_000)}!`, `${'a'.repeat(10_000)}{n}`)).toBeUndefined();
  });
});

describe('shortIdsOf — the type of each match', () => {
  const yaml = read('test/contracts/samples/wingfoil-0.3.1/custom/files/memory.yaml');

  it("takes the pattern of the match's type", () => {
    const of = shortIdsOf(yaml);
    expect(of({ id: 'task-046-x', type: 'task' })).toBe('task-046');
    expect(of({ id: 'sprint-001', type: 'sprint' })).toBe('sprint-001');
    expect(of({ id: 'minor-v0.1', type: 'release' })).toBeUndefined();
    // The pattern of the element's own type, never another type's.
    expect(of({ id: 'task-046-x', type: 'bug' })).toBeUndefined();
  });

  it('gives none for a type memory.yaml does not declare, or without a pattern', () => {
    const { id_pattern: _pattern, ...task } = yaml.types['task']!;
    const of = shortIdsOf({ ...yaml, types: { ...yaml.types, task } });
    expect(of({ id: 'task-046-x', type: 'task' })).toBeUndefined();
    expect(of({ id: 'task-046-x', type: 'nothing' })).toBeUndefined();
    expect(of({ id: 'task-046-x', type: '__proto__' })).toBeUndefined();
  });

  it('gives none to every element when memory.yaml is unreadable', () => {
    expect(shortIdsOf(undefined)({ id: 'task-046-x', type: 'task' })).toBeUndefined();
  });
});
