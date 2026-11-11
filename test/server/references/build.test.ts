// spec-012 §1 (amended 2026-11-06, Q2-a), task-055 AC-2, D55-4, D55-5, D55-7, D55-8 — the reference
// index built from the `memory search` matches and a source of values: the two reference rules in
// order, categories, done, the in-scope rule, the hold count, unreadable files, at most 16 reads at
// a time, and the pattern budget (results kept across builds, untested values → `capped`).
import type { MemoryMatch } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { DirectReadError } from '../../../server/src/reads/confine.js';
import { buildReferenceIndex, PatternMemo, testable, type ValueSource } from '../../../server/src/references/build.js';
import { INDEX_READS, PATTERN_BUDGET_MS, type FileValues } from '../../../server/src/references/index.js';
import type { UiCategory, UiPattern } from '../../../server/src/ui-config/types.js';
import { kanban } from '../ui-config/samples.js';

const match = (id: string, type: string, status: string): MemoryMatch => ({
  id,
  type,
  status,
  title: id,
  path: `docs/memory/${type}/${id}.md`,
  tags: [],
});

const pattern = (match: string, category: UiCategory): UiPattern => ({
  match,
  category,
  regex: new RegExp(match, 'u'),
});

/** A source answering from a table; `fail` ids reject with a direct-read error of their kind. */
function tableSource(
  table: Record<string, Partial<FileValues>>,
  fail: Record<string, ConstructorParameters<typeof DirectReadError>[0] | 'other'> = {},
): ValueSource & { reads: string[] } {
  const reads: string[] = [];
  return {
    reads,
    values(m) {
      reads.push(m.id);
      const kind = fail[m.id];
      if (kind === 'other') return Promise.reject(new Error('EIO'));
      if (kind) return Promise.reject(new DirectReadError(kind, m.path, 'x'));
      return Promise.resolve({ values: [], capped: false, ...table[m.id] });
    },
  };
}

const categories = new Map<string, UiCategory | null>([
  ['task', 'work'],
  ['bug', 'defect'],
  ['release', 'release'],
  ['plan', null],
]);

function build(
  matches: MemoryMatch[],
  source: ValueSource,
  extra: Partial<Parameters<typeof buildReferenceIndex>[0]> = {},
) {
  return buildReferenceIndex({
    matches,
    memoryYaml: kanban(),
    categories,
    patterns: [pattern('^(REQ|US)-', 'requirement'), pattern('^US-', 'feature'), pattern('^P\\d', 'feature')],
    source,
    memo: new PatternMemo(),
    ...extra,
  });
}

describe('buildReferenceIndex — the rules (spec-012 §1)', () => {
  it('rule 1: a full id of another listed element; its type gives the category, none for an uncategorised type', async () => {
    const matches = [
      match('task-001-a', 'task', 'draft'),
      match('bug-001-b', 'bug', 'approved'),
      match('plan-001-c', 'plan', 'draft'),
    ];
    const index = await build(
      matches,
      tableSource({ 'task-001-a': { values: ['bug-001-b', 'plan-001-c', 'task-001-a', 'task-001', 'adr-009-gone'] } }),
    );
    const a = index.get('task-001-a')!;
    expect(a.references).toEqual([
      { value: 'bug-001-b', kind: 'element', id: 'bug-001-b', category: 'defect' },
      { value: 'plan-001-c', kind: 'element', id: 'plan-001-c', category: null },
    ]);
    // Its own id, a short id and an id of no listed (e.g. archived) element are no element reference.
    expect(a.references.map((r) => r.value)).not.toContain('task-001-a');
  });

  it('rule 2: the first matching pattern in file order; 256 code points at most; no LF or CR', async () => {
    const long = `US-${'x'.repeat(253)}`; // 256 characters
    const astral = `US-${'😀'.repeat(253)}`; // 256 code points, 509 UTF-16 units
    const index = await build(
      [match('task-001-a', 'task', 'draft')],
      tableSource({
        'task-001-a': { values: ['US-M-01', 'P4.4', 'REQ-1', long, `${long}y`, astral, 'US-1\nx', 'US-1\rx', 'none'] },
      }),
    );
    expect(index.get('task-001-a')!.references).toEqual([
      { value: 'US-M-01', kind: 'pattern', category: 'requirement' },
      { value: 'P4.4', kind: 'pattern', category: 'feature' },
      { value: 'REQ-1', kind: 'pattern', category: 'requirement' },
      { value: long, kind: 'pattern', category: 'requirement' },
      { value: astral, kind: 'pattern', category: 'requirement' },
    ]);
  });

  it('rule 1 before rule 2: a value equal to an element id is an element reference even when a pattern matches', async () => {
    const index = await build(
      [match('task-001-a', 'task', 'draft'), match('US-9', 'bug', 'draft')],
      tableSource({ 'task-001-a': { values: ['US-9'] } }),
    );
    expect(index.get('task-001-a')!.references).toEqual([
      { value: 'US-9', kind: 'element', id: 'US-9', category: 'defect' },
    ]);
  });

  it('kind and done from the type states (done = kind last); elements in memory search order', async () => {
    const matches = [match('task-002-b', 'task', 'approved'), match('task-001-a', 'task', 'pending')];
    const index = await build(matches, tableSource({}));
    expect(index.elements.map((e) => [e.id, e.kind, e.finished])).toEqual([
      ['task-002-b', 'last', true],
      ['task-001-a', 'gate', false],
    ]);
  });

  it('the in-scope rule by id and by the string version, the element itself excluded; the hold count', async () => {
    const matches = [
      match('release-001-r', 'release', 'pending'),
      match('task-001-a', 'task', 'draft'),
      match('task-002-b', 'task', 'approved'),
      match('task-003-c', 'task', 'draft'),
      match('task-004-d', 'task', 'draft'),
    ];
    const index = await build(
      matches,
      tableSource({
        'release-001-r': { values: ['v1', 'release-001-r'], version: 'v1' },
        'task-001-a': { values: ['release-001-r'] },
        'task-002-b': { values: ['v1'] },
        'task-003-c': { values: ['v1', 'release-001-r'] },
        'task-004-d': { values: ['v2'] },
      }),
    );
    const r = index.get('release-001-r')!;
    expect(index.inScope(r).map((e) => e.id)).toEqual(['task-001-a', 'task-002-b', 'task-003-c']);
    expect(index.carrying('v1').map((e) => e.id)).toEqual(['release-001-r', 'task-002-b', 'task-003-c']);
    // Not done: task-001-a and task-003-c (task-002-b is in its last state).
    expect(index.referencingNotDone('release-001-r')).toBe(2);
    expect(index.referencingNotDone('nothing-listed')).toBe(0);
  });

  it('an empty version is no version: it scopes only by id, and counts only by id (task-059 review round 1 F-2, round 2 F-9)', async () => {
    const matches = [
      match('release-001-r', 'release', 'pending'),
      match('task-001-a', 'task', 'draft'),
      match('task-002-b', 'task', 'draft'),
      match('task-003-c', 'task', 'approved'),
    ];
    // Empty template fields carry "": task-002-b and task-003-c hold it, task-001-a names the release.
    const index = await build(
      matches,
      tableSource({
        'release-001-r': { values: [''], version: '' },
        'task-001-a': { values: ['release-001-r', ''] },
        'task-002-b': { values: [''] },
        'task-003-c': { values: [''] },
      }),
    );
    const r = index.get('release-001-r')!;
    expect(r.version).toBe('');
    expect(index.inScope(r).map((e) => e.id)).toEqual(['task-001-a']);
    // The `when-references-done` count of a gate with an empty version: task-001-a only.
    expect(index.referencingNotDone('release-001-r')).toBe(1);
  });

  it('an unreadable file: its kind, no values, in no scope, listed; never a failed index', async () => {
    const matches = [
      match('release-001-r', 'release', 'pending'),
      match('task-001-a', 'task', 'draft'),
      match('task-002-b', 'task', 'draft'),
      match('task-003-c', 'task', 'draft'),
      match('task-004-d', 'task', 'draft'),
      match('task-005-e', 'task', 'draft'),
    ];
    const index = await build(
      matches,
      tableSource(
        { 'task-001-a': { values: ['release-001-r'] }, 'task-005-e': { values: ['release-001-r'] } },
        { 'release-001-r': 'shape', 'task-002-b': 'outside', 'task-003-c': 'mismatch', 'task-004-d': 'other' },
      ),
    );
    expect(index.unreadable).toEqual(['release-001-r', 'task-002-b', 'task-003-c', 'task-004-d']);
    expect(index.get('task-004-d')!.unreadable).toBe('missing');
    expect(index.get('task-002-b')).toMatchObject({ unreadable: 'outside', values: [], references: [] });
    // The unreadable gate's own version is unknown: counted by its id only.
    expect(index.referencingNotDone('release-001-r')).toBe(2);
  });

  it('capped: more than 200 values (the source says so)', async () => {
    const index = await build(
      [match('task-001-a', 'task', 'draft')],
      tableSource({ 'task-001-a': { values: ['US-1'], capped: true } }),
    );
    expect(index.capped).toEqual(['task-001-a']);
  });

  it(`reads at most ${INDEX_READS} files at a time`, async () => {
    expect(INDEX_READS).toBe(16);
    let inFlight = 0;
    let max = 0;
    const source: ValueSource = {
      async values() {
        inFlight += 1;
        max = Math.max(max, inFlight);
        await new Promise((r) => setTimeout(r, 2));
        inFlight -= 1;
        return { values: [], capped: false };
      },
    };
    const matches = Array.from({ length: 60 }, (_, i) =>
      match(`task-${String(i).padStart(3, '0')}-x`, 'task', 'draft'),
    );
    const index = await build(matches, source);
    expect(index.elements).toHaveLength(60);
    expect(max).toBe(16);
  });
});

describe('buildReferenceIndex — the pattern budget (spec-012 §1, Q2-a)', () => {
  /** A clock that moves `step` ms on every read. */
  const ticking = (step: number) => {
    let t = 0;
    return () => (t += step);
  };

  it(`stops testing after ${PATTERN_BUDGET_MS} ms; untested values are no reference and their elements capped; the next build goes on`, async () => {
    expect(PATTERN_BUDGET_MS).toBe(500);
    const matches = Array.from({ length: 10 }, (_, i) => match(`task-00${i}-x`, 'task', 'draft'));
    const table = Object.fromEntries(matches.map((m, i) => [m.id, { values: [`US-${i}`] }]));
    const memo = new PatternMemo();
    // The clock is read before and after each test: 100 ms per test → 5 tests fit in the budget.
    const first = await build(matches, tableSource(table), {
      memo,
      clock: ticking(100),
      pause: () => Promise.resolve(),
    });
    const tested = first.elements.filter((e) => e.references.length > 0).map((e) => e.id);
    expect(tested.length).toBeGreaterThan(0);
    expect(tested.length).toBeLessThan(10);
    expect(first.capped).toEqual(matches.map((m) => m.id).filter((id) => !tested.includes(id)));
    // The kept results: the next build tests only the rest.
    const second = await build(matches, tableSource(table), {
      memo,
      clock: ticking(1),
      pause: () => Promise.resolve(),
    });
    expect(second.capped).toEqual([]);
    expect(second.elements.every((e) => e.references.length === 1)).toBe(true);
  });

  it('keeps results per pattern list: a changed list tests again', async () => {
    const memo = new PatternMemo();
    const matches = [match('task-001-a', 'task', 'draft')];
    const src = tableSource({ 'task-001-a': { values: ['US-1'] } });
    let tests = 0;
    const counting = (p: UiPattern): UiPattern => ({
      ...p,
      regex: { test: (v: string) => (tests++, p.regex.test(v)) } as unknown as RegExp,
    });
    const list = [counting(pattern('^US-', 'requirement'))];
    await build(matches, src, { memo, patterns: list });
    await build(matches, src, { memo, patterns: list });
    expect(tests).toBe(1);
    await build(matches, src, { memo, patterns: [counting(pattern('^US-', 'feature'))] });
    expect(tests).toBe(2);
  });

  it('review round 1 F2: serves the event loop between the patterns of one value, not only between values', async () => {
    const matches = [match('task-001-a', 'task', 'draft')];
    const many = Array.from({ length: 10 }, (_, i) => pattern(`^Z${i}`, 'requirement'));
    let pauses = 0;
    // 10 ms per clock read, no pattern matches: 10 tests on one value, a slice spent every test or two.
    const index = await build(matches, tableSource({ 'task-001-a': { values: ['US-1'] } }), {
      patterns: many,
      clock: ticking(10),
      pause: () => {
        pauses += 1;
        return Promise.resolve();
      },
    });
    expect(pauses).toBeGreaterThanOrEqual(4);
    expect(index.capped).toEqual([]);
  });

  it('review round 1 F2: a budget spent inside one value leaves that value untested (capped), not half-tested', async () => {
    const matches = [match('task-001-a', 'task', 'draft')];
    const many = Array.from({ length: 10 }, (_, i) => pattern(`^Z${i}`, 'requirement'));
    const memo = new PatternMemo();
    // 100 ms per test: the budget is spent after 5 of the 10 patterns.
    const index = await build(matches, tableSource({ 'task-001-a': { values: ['Z9-x'] } }), {
      patterns: many,
      memo,
      clock: ticking(100),
      pause: () => Promise.resolve(),
    });
    expect(index.capped).toEqual(['task-001-a']);
    expect(memo.for(many).has('Z9-x')).toBe(false);
  });

  it('review round 1 F3: the kept results are pruned to the values of the current build', async () => {
    const memo = new PatternMemo();
    const list = [pattern('^US-', 'requirement')];
    const matches = [match('task-001-a', 'task', 'draft')];
    await build(matches, tableSource({ 'task-001-a': { values: ['US-1', 'US-2', 'US-3'] } }), { memo, patterns: list });
    expect(memo.for(list).size).toBe(3);
    await build(matches, tableSource({ 'task-001-a': { values: ['US-3', 'US-4'] } }), { memo, patterns: list });
    expect([...memo.for(list).keys()].sort()).toEqual(['US-3', 'US-4']);
  });

  it('review round 2 N1: the passes before and after the pattern tests serve the event loop too', async () => {
    // No pattern at all: no pattern test runs, yet 2 000 values are walked before and after.
    const matches = Array.from({ length: 20 }, (_, i) =>
      match(`task-0${String(i).padStart(2, '0')}-x`, 'task', 'draft'),
    );
    const table = Object.fromEntries(
      matches.map((m, i) => [m.id, { values: Array.from({ length: 100 }, (_, k) => `v-${i}-${k}`) }]),
    );
    const phases: string[] = [];
    let phase = 'pre';
    const source = tableSource(table);
    const index = await build(matches, source, {
      patterns: [],
      clock: ticking(1),
      sliceMs: 20,
      pause: () => {
        phases.push(phase);
        return Promise.resolve();
      },
    });
    phase = 'done';
    expect(index.elements).toHaveLength(20);
    // At least one pause per 20 clock reads over the walk of 2 000 values (before) and the
    // elements and the inverted index (after): far more than one.
    expect(phases.length).toBeGreaterThanOrEqual(10);
  });

  it('review round 2 N2: a build whose results a newer build pruned keeps its own; only the newest build prunes', async () => {
    const memo = new PatternMemo();
    const list = [pattern('^US-', 'requirement')];
    const one = [match('task-001-a', 'task', 'draft')];
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    let paused = false;
    // Build A pauses at its first slice and resumes only after build B (a newer state) is done.
    const a = build(one, tableSource({ 'task-001-a': { values: ['US-1'] } }), {
      memo,
      patterns: list,
      clock: ticking(1),
      sliceMs: 0,
      pause: () => {
        if (paused) return Promise.resolve();
        paused = true;
        return held;
      },
    });
    const b = await build(one, tableSource({ 'task-001-a': { values: ['US-2'] } }), { memo, patterns: list });
    expect(b.get('task-001-a')!.references).toEqual([{ value: 'US-2', kind: 'pattern', category: 'requirement' }]);
    release();
    const done = await a;
    expect(done.capped).toEqual([]);
    expect(done.get('task-001-a')!.references).toEqual([{ value: 'US-1', kind: 'pattern', category: 'requirement' }]);
    // The older build did not prune the newer one's results.
    expect(memo.for(list).has('US-2')).toBe(true);
  });

  it('review round 3: each build reads its own results — a newer build pruning them after they were tested leaves no gap', async () => {
    const memo = new PatternMemo();
    const list = [pattern('^US-', 'requirement')];
    const shared = memo.for(list);
    const aValues = Array.from({ length: 32 }, (_, i) => `US-${i}`);
    const one = [match('task-001-a', 'task', 'draft')];
    let release: () => void = () => undefined;
    const held = new Promise<void>((r) => (release = r));
    let holding = false;
    let onHold: () => void = () => undefined;
    const aHolds = new Promise<void>((r) => (onHold = r));
    // Build A holds at its first pause after every one of its values is in the shared results (its
    // pass after the tests), while build B, a newer state's, prunes them all.
    const a = build(one, tableSource({ 'task-001-a': { values: aValues } }), {
      memo,
      patterns: list,
      clock: ticking(1),
      sliceMs: 0,
      pause: () => {
        if (holding || !aValues.every((v) => shared.has(v))) return Promise.resolve();
        holding = true;
        onHold();
        return held;
      },
    });
    await aHolds;
    await build(one, tableSource({ 'task-001-a': { values: ['US-B'] } }), { memo, patterns: list });
    expect(aValues.some((v) => shared.has(v))).toBe(false);
    release();
    const done = await a;
    expect(done.capped).toEqual([]);
    expect(done.get('task-001-a')!.references.map((r) => r.value)).toEqual(aValues);
  });

  it('review round 3: testable — at most 256 code points, no line break; its fast path and boundaries', () => {
    const astral = '😀'; // one code point, two UTF-16 units
    const cases: [string, string, boolean][] = [
      ['ASCII 256', 'a'.repeat(256), true],
      ['ASCII 257', 'a'.repeat(257), false],
      ['128 astral (256 units)', astral.repeat(128), true],
      ['256 astral (512 units)', astral.repeat(256), true],
      ['257 astral (514 units)', astral.repeat(257), false],
      ['200 astral + 56 ASCII (256 code points)', astral.repeat(200) + 'a'.repeat(56), true],
      ['200 astral + 57 ASCII (257 code points)', astral.repeat(200) + 'a'.repeat(57), false],
      ['255 astral + aa (257 code points, 512 units)', astral.repeat(255) + 'aa', false],
      ['300 lone surrogates', '\ud83d'.repeat(300), false],
      ['513 ASCII units', 'a'.repeat(513), false],
      ['a line feed', 'US-1\nx', false],
      ['a carriage return', 'US-1\rx', false],
      ['empty', '', true],
    ];
    for (const [name, value, expected] of cases) expect(testable(value), name).toBe(expected);
  });

  it('serves the event loop between slices of about 20 ms', async () => {
    const matches = Array.from({ length: 30 }, (_, i) =>
      match(`task-0${String(i).padStart(2, '0')}-x`, 'task', 'draft'),
    );
    const table = Object.fromEntries(matches.map((m, i) => [m.id, { values: [`US-${i}`] }]));
    let pauses = 0;
    // 5 ms per clock read: a pause every two tests or so, 150 ms in all (within the budget).
    await build(matches, tableSource(table), {
      clock: ticking(5),
      pause: () => {
        pauses += 1;
        return Promise.resolve();
      },
    });
    expect(pauses).toBeGreaterThanOrEqual(10);
  });
});
