// task-017 — pure helpers of the Memory list (web/src/memory/model.ts): type filters from
// `memory.yaml` with counts, state filters (the type's states, or the buckets of the descriptor),
// filtering, bucket labels from the catalogue (no bucket code written in web/).
import type { ActionDescriptor, Bucket, ListedElement, MemoryYaml } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import en from '../../../web/src/i18n/en.json' with { type: 'json' };
import {
  ageOf,
  BUCKET_FILTERS,
  bucketFilters,
  bucketKeyOf,
  filterRows,
  stateFilters,
  typeFilters,
} from '../../../web/src/memory/model.js';

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
