// spec-012 §1 *Values*, task-055 AC-2, D55-3 — the values of one element's frontmatter: top-level
// strings and the string items of a top-level list, as written, distinct, in field then list
// order, at most 200 (then `capped`); the excluded fields; the top-level string `version` kept
// apart (also past the cap).
import { describe, expect, it } from 'vitest';
import { extractValues } from '../../../server/src/references/values.js';
import { MAX_VALUES } from '../../../server/src/references/index.js';

describe('extractValues (spec-012 §1)', () => {
  it('keeps top-level strings and the string items of top-level lists, in field then list order', () => {
    const v = extractValues({
      id: 'task-001-a',
      type: 'task',
      title: 'A',
      status: 'draft',
      release: 'v0.1',
      refs: ['US-M-01', 'US-S-01'],
      module: 'server',
    });
    expect(v).toEqual({ values: ['v0.1', 'US-M-01', 'US-S-01', 'server'], capped: false });
  });

  it('skips id, type, title, status, tags and rejection_reason', () => {
    const v = extractValues({
      id: 'x',
      type: 't',
      title: 'US-1',
      status: 's',
      tags: ['US-2'],
      rejection_reason: 'US-3',
      other: 'US-4',
    });
    expect(v.values).toEqual(['US-4']);
  });

  it('skips nested maps, items of nested lists, numbers, booleans and null; dates are strings (core schema)', () => {
    const v = extractValues({
      nested: { ref: 'US-1' },
      deep: [['US-2'], { ref: 'US-3' }, 'US-4', 7, true, null],
      n: 0.3,
      b: false,
      z: null,
      // The YAML 1.2 core schema has no timestamp type: an unquoted date arrives as a string.
      date: '2026-11-05',
    });
    expect(v.values).toEqual(['US-4', '2026-11-05']);
  });

  it('keeps a value as written (no trim, no case folding) and links a repeated value once', () => {
    const v = extractValues({ a: ' US-1 ', b: 'us-1', c: ['US-1', 'US-1'], d: 'US-1', e: ' US-1 ' });
    expect(v.values).toEqual([' US-1 ', 'us-1', 'US-1']);
  });

  it('caps at 200 distinct values in field then list order, the element capped', () => {
    const many = Array.from({ length: MAX_VALUES + 1 }, (_, i) => `v-${i}`);
    expect(MAX_VALUES).toBe(200);
    const v = extractValues({ first: 'v-0', list: many });
    expect(v.values).toHaveLength(200);
    expect(v.values[0]).toBe('v-0');
    expect(v.values.at(-1)).toBe('v-199');
    expect(v.capped).toBe(true);
    // 200 distinct values exactly: not capped.
    expect(extractValues({ list: many.slice(0, 200) }).capped).toBe(false);
  });

  it('keeps the top-level string `version` apart, also past the cap; a non-string version is none', () => {
    const many = Array.from({ length: 250 }, (_, i) => `v-${i}`);
    const v = extractValues({ list: many, version: 'v1' });
    expect(v.version).toBe('v1');
    expect(v.values).not.toContain('v1');
    expect(extractValues({ version: 'v0.1' })).toEqual({ values: ['v0.1'], version: 'v0.1', capped: false });
    expect(extractValues({ version: 1 }).version).toBeUndefined();
  });
});
