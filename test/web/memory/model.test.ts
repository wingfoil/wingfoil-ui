// task-017 — pure helpers of the Memory list (web/src/memory/model.ts): type filters from
// `memory.yaml` with counts, state filters (the type's states, or the buckets of the descriptor),
// filtering, bucket labels from the catalogue (no bucket code written in web/). task-066 — the
// states of a bucket (N7), the missing-references filter (M2), the figure ids and the URL's precedence.
import type { ActionDescriptor, Bucket, ListedElement, MemoryYaml } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import {
  ageOf,
  BUCKET_FILTERS,
  bucketFilters,
  bucketKeyOf,
  bucketStateFilters,
  filterRows,
  MISSING_REFS,
  missingCount,
  stateFilters,
  typeFilters,
} from '../../../web/src/memory/model.js';
import { memorySearch } from '../../../web/src/routes/memory.js';

function descriptor(type: string, status: string, bucket: Bucket | undefined, tone = 'neutral'): ActionDescriptor {
  return {
    id: `${type}-x`,
    type,
    status,
    kind: 'work',
    tone: tone as ActionDescriptor['tone'],
    ...(bucket ? { bucket } : {}),
    verbs: [],
    actor: { kind: 'none' },
  };
}

function el(id: string, type: string, status: string, bucket?: Bucket, tone?: string): ListedElement {
  return {
    path: `docs/${id}.md`,
    id,
    title: id,
    type,
    status,
    tags: [],
    localChanges: false,
    descriptor: descriptor(type, status, bucket, tone),
  };
}

const TYPES: MemoryYaml = {
  version: 1,
  types: {
    zeta: { path: 'z/{id}.md', states: { sequence: ['s1', 's2', 's3'] } },
    alpha: { path: 'a/{id}.md', states: { sequence: ['a1', 'a2'] } },
    empty: { path: 'e/{id}.md', states: { sequence: ['e1'] } },
  },
};

const ELEMENTS = [
  el('z1', 'zeta', 's1', 'waiting', 'neutral'),
  el('z2', 'zeta', 's2', 'to-approve', 'human'),
  el('z3', 'zeta', 'off', 'in-progress', 'active'),
  el('a1', 'alpha', 'a2', 'done', 'done'),
  el('u1', 'stray', 'x1', 'in-progress', 'active'),
];

describe('typeFilters', () => {
  it('lists the declared types in memory.yaml order with their counts, zero included', () => {
    expect(typeFilters(TYPES, ELEMENTS).slice(0, 3)).toEqual([
      { type: 'zeta', count: 3 },
      { type: 'alpha', count: 1 },
      { type: 'empty', count: 0 },
    ]);
  });
  it('appends the types found on elements but not declared, under their own names (W3-25)', () => {
    expect(typeFilters(TYPES, ELEMENTS).map((t) => t.type)).toEqual(['zeta', 'alpha', 'empty', 'stray']);
  });
  it('without type definitions, lists the types of the elements in order of appearance', () => {
    expect(typeFilters(undefined, ELEMENTS)).toEqual([
      { type: 'zeta', count: 3 },
      { type: 'alpha', count: 1 },
      { type: 'stray', count: 1 },
    ]);
  });
});

describe('stateFilters', () => {
  it('lists the sequence then the undeclared states found on the elements, with counts and tones', () => {
    const zeta = ELEMENTS.filter((e) => e.type === 'zeta');
    expect(stateFilters(['s1', 's2', 's3'], zeta)).toEqual([
      { state: 's1', count: 1, tone: 'neutral' },
      { state: 's2', count: 1, tone: 'human' },
      { state: 's3', count: 0 },
      { state: 'off', count: 1, tone: 'active' },
    ]);
  });
  it('without a sequence, lists the states of the elements', () => {
    expect(stateFilters(undefined, [el('q', 't', 'x')]).map((s) => s.state)).toEqual(['x']);
  });
});

describe('buckets', () => {
  it('has the four labels of the feature header, in its order', () => {
    const messages = en as Record<string, string>;
    expect(BUCKET_FILTERS.map((b) => messages[b.label.id as string])).toEqual([
      'To approve',
      'In progress',
      'Waiting/drafts/closed',
      'Done',
    ]);
  });
  it('maps every bucket code of the contracts to one label (lowerCamel rule)', () => {
    const codes: Bucket[] = ['to-approve', 'in-progress', 'waiting', 'done'];
    expect(codes.map(bucketKeyOf)).toEqual(BUCKET_FILTERS.map((b) => b.key));
    expect(bucketKeyOf(undefined)).toBeUndefined();
  });
  it('counts the elements by the bucket of their descriptor; archived ones (no bucket) in none', () => {
    const counts = bucketFilters(
      [...ELEMENTS, el('ar', 'zeta', 'gone')].map((e) =>
        e.id === 'ar' ? { ...e, descriptor: descriptor('zeta', 'gone', undefined) } : e,
      ),
    );
    expect(counts.map((b) => [b.key, b.count])).toEqual([
      ['toApprove', 1],
      ['inProgress', 2],
      ['waiting', 1],
      ['done', 1],
    ]);
  });
});

describe('filterRows', () => {
  it('keeps everything with no filter', () => {
    expect(filterRows(ELEMENTS, {})).toHaveLength(5);
  });
  it('filters by type, then by state', () => {
    expect(filterRows(ELEMENTS, { type: 'zeta' }).map((e) => e.id)).toEqual(['z1', 'z2', 'z3']);
    expect(filterRows(ELEMENTS, { type: 'zeta', state: 'off' }).map((e) => e.id)).toEqual(['z3']);
  });
  it('filters all types by bucket key', () => {
    expect(filterRows(ELEMENTS, { bucket: 'inProgress' }).map((e) => e.id)).toEqual(['z3', 'u1']);
    expect(filterRows(ELEMENTS, { bucket: 'done' }).map((e) => e.id)).toEqual(['a1']);
  });
  it('ignores a bucket when a type is selected', () => {
    expect(filterRows(ELEMENTS, { type: 'alpha', bucket: 'toApprove' }).map((e) => e.id)).toEqual(['a1']);
  });
});

describe('ageOf', () => {
  const now = Date.parse('2026-10-07T10:00:00Z');
  it('gives the largest whole unit, in the past', () => {
    expect(ageOf('2026-10-07T09:59:30Z', now)).toEqual({ value: -30, unit: 'second' });
    expect(ageOf('2026-10-07T09:55:00Z', now)).toEqual({ value: -5, unit: 'minute' });
    expect(ageOf('2026-10-07T07:00:00Z', now)).toEqual({ value: -3, unit: 'hour' });
    expect(ageOf('2026-10-05T10:00:00+00:00', now)).toEqual({ value: -2, unit: 'day' });
    expect(ageOf('2026-08-01T10:00:00Z', now)).toEqual({ value: -2, unit: 'month' });
    expect(ageOf('2024-10-01T10:00:00Z', now)).toEqual({ value: -2, unit: 'year' });
  });
  it('treats a time in the future as now', () => {
    expect(ageOf('2026-10-08T10:00:00Z', now)).toEqual({ value: -0, unit: 'second' });
  });
});

// task-066 — the states of a bucket (N7, AC-1), the missing-references filter (AC-2), the figure ids
// (AC-3) and the URL (D66-2): `memorySearch` is the route's validation (the address itself is kept).
const FLAGGED = (e: ListedElement): ListedElement => ({ ...e, missingCategories: ['requirement'] });
const MIXED = [
  el('z1', 'zeta', 's1', 'waiting', 'neutral'),
  el('a0', 'alpha', 'a1', 'waiting', 'neutral'),
  el('u2', 'stray', 'x9', 'waiting', 'neutral'),
  el('z4', 'zeta', 's1', 'waiting', 'neutral'),
  el('u3', 'stray', 'x8', 'waiting', 'neutral'),
  FLAGGED(el('z2', 'zeta', 's2', 'to-approve', 'human')),
  FLAGGED(el('a1', 'alpha', 'a2', 'done', 'done')),
  el('m1', 'mu', 'a1', 'waiting', 'active'),
];

describe('bucketStateFilters (task-066 AC-1)', () => {
  it('lists the states of a bucket by name with counts: types in type-filter order, each in sequence order, undeclared after', () => {
    expect(bucketStateFilters(TYPES, MIXED, 'waiting').map((s) => [s.state, s.count, s.tone])).toEqual([
      ['s1', 2, 'neutral'],
      ['a1', 2, 'neutral'],
      ['x9', 1, 'neutral'],
      ['x8', 1, 'neutral'],
    ]);
  });
  it('gives a state shared by two types one entry, and a bucket with no element no state', () => {
    expect(bucketStateFilters(TYPES, MIXED, 'waiting').filter((s) => s.state === 'a1')).toHaveLength(1);
    expect(bucketStateFilters(TYPES, MIXED, 'inProgress')).toEqual([]);
  });
  it('without type definitions, lists the states in order of appearance', () => {
    expect(bucketStateFilters(undefined, MIXED, 'waiting').map((s) => s.state)).toEqual(['s1', 'a1', 'x9', 'x8']);
  });
});

describe('filterRows (task-066)', () => {
  it('narrows a bucket to one of its states (AC-1)', () => {
    expect(filterRows(MIXED, { bucket: 'waiting', state: 'a1' }).map((e) => e.id)).toEqual(['a0', 'm1']);
    expect(filterRows(MIXED, { bucket: 'waiting', state: 'none' })).toEqual([]);
  });
  it('lists the elements the server flags, of the selected type when one is (AC-2)', () => {
    expect(filterRows(MIXED, { missing: MISSING_REFS }).map((e) => e.id)).toEqual(['z2', 'a1']);
    expect(filterRows(MIXED, { type: 'alpha', missing: MISSING_REFS }).map((e) => e.id)).toEqual(['a1']);
  });
  it('keeps the elements whose full id is in a figure, in the list order (AC-3)', () => {
    expect(filterRows(MIXED, {}, new Set(['a1', 'z1', 'z'])).map((e) => e.id)).toEqual(['z1', 'a1']);
  });
});

describe('missingCount (task-066 AC-2)', () => {
  it('counts the flagged elements of the selection, 0 included', () => {
    expect(missingCount(MIXED, undefined)).toBe(2);
    expect(missingCount(MIXED, 'zeta')).toBe(1);
    expect(missingCount(MIXED, 'mu')).toBe(0);
  });
});

describe('memorySearch (task-066 D66-2)', () => {
  it('keeps a known figure alone and drops an unknown one', () => {
    expect(memorySearch({ figure: 'pending-gates', type: 'zeta', bucket: 'done', missing: 'refs' })).toEqual({
      figure: 'pending-gates',
    });
    expect(memorySearch({ figure: 'bogus' })).toEqual({});
    expect(memorySearch({ figure: 'phase', type: 'zeta' })).toEqual({ type: 'zeta' });
  });
  it('keeps a bucket and its state, and drops a state with neither type nor bucket', () => {
    expect(memorySearch({ bucket: 'waiting', state: 's1' })).toEqual({ bucket: 'waiting', state: 's1' });
    expect(memorySearch({ state: 's1' })).toEqual({});
    expect(memorySearch({ type: 'zeta', state: 's1', bucket: 'done' })).toEqual({ type: 'zeta', state: 's1' });
  });
  it('keeps missing=refs with the type, over a state or a bucket; drops any other value', () => {
    expect(memorySearch({ missing: 'refs', bucket: 'waiting', state: 's1' })).toEqual({ missing: 'refs' });
    expect(memorySearch({ missing: 'refs', type: 'zeta', state: 's1' })).toEqual({ type: 'zeta', missing: 'refs' });
    expect(memorySearch({ missing: 'yes', bucket: 'done' })).toEqual({ bucket: 'done' });
  });
});
