// task-067 — the pure part of the Traceability page (web/src/traceability/model.ts; ux-reference
// §4.8 v0.3; D67-2, D67-8; Q2 (a)): the address's filters, the status key with the web's own
// address word `partial`, the closed category order checked against the contract's schema lists
// (no category or status literal that collides with a fixture name is written in web/, REQ-ARC-05),
// the facets and their counts, the search (a case-insensitive substring, never a regular
// expression) and the rows shown in the server's order.
import type { ReferenceStatus, Traceability, TraceabilityReference, UiCategory } from '@wingfoil-ui/contracts';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  byCategoryOrder,
  categoryFacets,
  effectiveFilters,
  referenceKey,
  STATUS_FILTERS,
  statusFacets,
  statusKey,
  traceabilitySearch,
  visibleReferences,
} from '../../../web/src/traceability/model.js';

function schema(file: string): unknown {
  return JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'api', file), 'utf8'));
}

/** The closed category list of `ui-config.schema.json` (spec-012 §7, spec-005 §1), in its order. */
const CATEGORIES = (schema('ui-config.schema.json') as { definitions: { category: { enum: UiCategory[] } } })
  .definitions.category.enum;

/** The status list of `traceability.schema.json` (spec-012 §4). */
function statuses(): ReferenceStatus[] {
  const found: ReferenceStatus[][] = [];
  const walk = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const status = record['status'] as { enum?: ReferenceStatus[] } | undefined;
    if (status?.enum) found.push(status.enum);
    for (const value of Object.values(record)) walk(value);
  };
  walk(schema('traceability.schema.json'));
  expect(found).toHaveLength(1);
  return found[0] ?? [];
}

function ref(
  id: string,
  category: UiCategory,
  status: ReferenceStatus,
  extra: Partial<TraceabilityReference> = {},
): TraceabilityReference {
  return { id, category, element: false, linked: [], done: 0, total: 0, percent: null, status, ...extra };
}

const [IN_PROGRESS] = statuses().filter((s) => !['completed', 'not-started', 'no-elements'].includes(s));
const RELEASE = CATEGORIES[6] as UiCategory;

function answer(references: TraceabilityReference[], applied: 'current' | 'project' = 'project'): Traceability {
  return {
    ui: { source: 'file' },
    patterns: true,
    scope: { type: null, current: null, applied },
    figures: {
      completion: { state: 'unavailable', reason: { code: 'no-linked-elements' } },
      phaseCompletion: { state: 'read-only', reason: { code: 'not-in-release' } },
      coverage: { state: 'unavailable', reason: { code: 'no-requires' } },
      referencesWithoutElements: 0,
    },
    references,
    missing: [],
    elements: [
      {
        path: 'docs/t/task-001-login-form.md',
        id: 'task-001-login-form',
        shortId: 'task-001',
        title: 'Login Form',
        type: 'task',
        status: 'approved',
        tags: [],
        localChanges: false,
        done: false,
        inScope: true,
      },
    ],
    unreadable: [],
    capped: [],
  };
}

const ROWS: TraceabilityReference[] = [
  ref('REQ-1', 'requirement', 'completed', { linked: ['a'], done: 1, total: 1, percent: 100 }),
  ref('REQ-2', 'requirement', IN_PROGRESS ?? 'completed', { linked: ['a', 'b'], done: 1, total: 2, percent: 50 }),
  ref('REQ-10', 'requirement', 'no-elements'),
  ref('task-001-login-form', 'work', 'not-started', { element: true, linked: ['b'], total: 1, percent: 0 }),
  ref('minor-v0.1', RELEASE, 'not-started', { element: true, linked: ['b'], total: 1, percent: 0 }),
  ref('ext-1', 'external', 'not-started', { linked: ['b'], total: 1, percent: 0 }),
];

describe('Q2 (a) — the orders derived from the contract types, no colliding literal', () => {
  it('maps every status of the schema to one of the four address words, the in-progress one to "partial"', () => {
    const all = statuses();
    expect(all).toHaveLength(4);
    const keys = all.map(statusKey);
    expect(new Set(keys)).toEqual(new Set(STATUS_FILTERS));
    expect(STATUS_FILTERS).toEqual(['completed', 'partial', 'not-started', 'no-elements']);
    expect(statusKey(IN_PROGRESS as ReferenceStatus)).toBe('partial');
    expect(statusKey('completed')).toBe('completed');
  });

  it('orders the categories as the schema lists them (the closed order of ux-reference §6)', () => {
    expect(CATEGORIES).toHaveLength(8);
    const shuffled = [...CATEGORIES].reverse();
    const mixed = [shuffled[3], shuffled[0], shuffled[7], shuffled[1], shuffled[5], shuffled[2], shuffled[6], shuffled[4]];
    expect((mixed as UiCategory[]).sort(byCategoryOrder)).toEqual(CATEGORIES);
  });
});

describe('D67-2 — the address', () => {
  it('keeps scope=project, a category, a known status word and a non-empty search', () => {
    expect(traceabilitySearch({ scope: 'project', category: 'requirement', status: 'partial', q: 'req' })).toEqual({
      scope: 'project',
      category: 'requirement',
      status: 'partial',
      q: 'req',
    });
  });

  it('drops an unknown scope or status, an empty category or search, and non-text values', () => {
    expect(traceabilitySearch({ scope: 'current', status: IN_PROGRESS, category: '', q: '' })).toEqual({});
    expect(traceabilitySearch({ scope: 1, status: 'bogus', category: ['x'], q: 3, panel: 'x' })).toEqual({});
  });

  it('ignores a category the answer does not list and "no-elements" in the current scope', () => {
    const project = answer(ROWS);
    expect(effectiveFilters({ category: 'spec', status: 'no-elements' }, project)).toEqual({
      status: 'no-elements',
      q: '',
    });
    expect(effectiveFilters({ category: 'requirement', status: 'no-elements' }, answer(ROWS, 'current'))).toEqual({
      category: 'requirement',
      q: '',
    });
  });
});

describe('D67-8 — facets, search and rows', () => {
  it('lists each category found, in the closed order, with its count over every row', () => {
    expect(categoryFacets(ROWS)).toEqual([
      { value: 'work', count: 1 },
      { value: 'requirement', count: 3 },
      { value: RELEASE, count: 1 },
      { value: 'external', count: 1 },
    ]);
  });

  it('counts the statuses within the chosen category; "No elements" only with the whole project', () => {
    expect(statusFacets(ROWS, 'requirement', true)).toEqual([
      { value: 'completed', count: 1 },
      { value: 'partial', count: 1 },
      { value: 'not-started', count: 0 },
      { value: 'no-elements', count: 1 },
    ]);
    expect(statusFacets(ROWS, undefined, false).map((f) => f.value)).toEqual(['completed', 'partial', 'not-started']);
    expect(statusFacets(ROWS, undefined, false).find((f) => f.value === 'not-started')?.count).toBe(3);
  });

  it('combines category, status and search, keeping the server order', () => {
    const a = answer(ROWS);
    expect(visibleReferences(a, { category: 'requirement' }).map((r) => r.id)).toEqual(['REQ-1', 'REQ-2', 'REQ-10']);
    expect(visibleReferences(a, { status: 'partial' }).map((r) => r.id)).toEqual(['REQ-2']);
    expect(visibleReferences(a, { category: 'requirement', status: 'completed' }).map((r) => r.id)).toEqual(['REQ-1']);
    expect(visibleReferences(a, { status: 'completed', category: 'external' })).toEqual([]);
  });

  it('searches the id and an element reference title case-insensitively, never as a regular expression', () => {
    const a = answer(ROWS);
    expect(visibleReferences(a, { q: 'req-1' }).map((r) => r.id)).toEqual(['REQ-1', 'REQ-10']);
    expect(visibleReferences(a, { q: 'LOGIN' }).map((r) => r.id)).toEqual(['task-001-login-form']);
    expect(visibleReferences(a, { q: '.*' })).toEqual([]);
    expect(visibleReferences(a, { q: 'REQ-[12]' })).toEqual([]);
  });

  it('keys a row by its kind and id, so an element row and a pattern row with one id differ', () => {
    expect(referenceKey(ref('X-1', 'work', 'completed'))).not.toBe(
      referenceKey(ref('X-1', 'work', 'completed', { element: true })),
    );
  });
});
