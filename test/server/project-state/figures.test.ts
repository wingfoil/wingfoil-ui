// task-059 AC-1, AC-3, AC-6 (D59-1 … D59-7, D59-10; spec-005 §4, spec-012 §1, §3, §5, §9, §11) —
// the project-state module on the custom fixture's index (probe P1) and variations of it: the
// natural order, the half-up percent, the current element, the scope, each figure and each
// `Unavailable`/`ReadOnly` reason, the 10-entry cap, held gates, the missing-reference flag and
// the escape of titles and pattern reference ids.
import { describe, expect, it } from 'vitest';
import { currentElement, scopeType } from '../../../server/src/project-state/current.js';
import { elementRef, progressBody, type ProgressInputs } from '../../../server/src/project-state/bodies.js';
import {
  completionFigure,
  iteratedFigure,
  openDefectsFigure,
  pendingGatesFigure,
  type FigureInputs,
} from '../../../server/src/project-state/figures.js';
import { missingCategories } from '../../../server/src/project-state/missing.js';
import { naturalCompare, naturalOrder } from '../../../server/src/project-state/order.js';
import { meanOf, percentOf } from '../../../server/src/project-state/percent.js';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import { shortIdsOf } from '../../../server/src/reads/short-id.js';
import type { ReferenceIndex } from '../../../server/src/references/index.js';
import type { EffectiveUiConfig } from '../../../server/src/ui-config/types.js';
import { customPacks, kanban } from '../ui-config/samples.js';
import { CUSTOM, indexOf, matchesOf, uiOf, withRow, type Row } from './support.js';

const READ_ONLY = { code: 'not-in-release' } as const;

async function inputs(
  rows: readonly Row[] = CUSTOM,
  ui: EffectiveUiConfig = uiOf(),
  held: (id: string) => boolean = () => false,
): Promise<ProgressInputs & { index: ReferenceIndex }> {
  const memoryYaml = customPacks();
  const index = await indexOf(rows, ui, memoryYaml);
  const matches = new Map(matchesOf(rows).map((m) => [m.id, m]));
  return {
    index,
    ui,
    current: currentElement(index, memoryYaml, ui),
    held: (e) => held(e.id),
    match: (id) => matches.get(id)!,
    shortIds: shortIdsOf(memoryYaml),
    phaseReason: READ_ONLY,
  };
}

describe('natural order and percent (D59-1, D59-4)', () => {
  it('compares digit runs as numbers, other runs by code units, and is total', () => {
    expect(naturalOrder(['US-M-10', 'US-M-2', 'US-M-01', 'US-S-1', 'US-M-2'])).toEqual([
      'US-M-01',
      'US-M-2',
      'US-M-10',
      'US-S-1',
    ]);
    expect(naturalCompare('v0.9', 'v0.10')).toBeLessThan(0);
    expect(naturalCompare('a01', 'a1')).not.toBe(0);
    expect(naturalCompare('task-002', 'task-002')).toBe(0);
    expect(naturalCompare('9'.repeat(30), '1' + '0'.repeat(30))).toBeLessThan(0);
  });

  it('rounds half up in integers', () => {
    expect(percentOf(1, 8)).toBe(13);
    expect(percentOf(1, 2)).toBe(50);
    expect(percentOf(0, 1)).toBe(0);
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(2, 3)).toBe(67);
    expect(
      meanOf([
        { finished: 0, total: 1 },
        { finished: 1, total: 2 },
      ]),
    ).toEqual({ value: 0.25, percent: 25 });
    // An exact half after the mean: (1/4 + 0/1) / 2 = 12.5 % → 13.
    expect(
      meanOf([
        { finished: 1, total: 4 },
        { finished: 0, total: 1 },
      ]).percent,
    ).toBe(13);
    expect(
      meanOf([
        { finished: 1, total: 3 },
        { finished: 1, total: 3 },
        { finished: 1, total: 3 },
      ]).percent,
    ).toBe(33);
  });
});

describe('the current element (D59-2, spec-005 §4)', () => {
  it('T-12.1: minor-v0.1 in planning on the custom fixture', async () => {
    const i = await inputs();
    expect(i.current?.id).toBe('minor-v0.1');
    expect(scopeType(i.ui)).toBe('release');
  });

  it('T-12.4: the most advanced state wins (released is last, never current)', async () => {
    let rows = withRow(CUSTOM, 'minor-v0.1', { status: 'released' });
    rows = withRow(rows, 'minor-v0.2', {
      type: 'release',
      status: 'in-development',
      version: 'v0.2',
      values: ['v0.2'],
    });
    expect((await inputs(rows)).current?.id).toBe('minor-v0.2');
    rows = withRow(rows, 'minor-v0.1', { status: 'planning' });
    expect((await inputs(rows)).current?.id).toBe('minor-v0.2');
  });

  it('T-12.5: none when the only release is in its first state', async () => {
    const i = await inputs(withRow(CUSTOM, 'minor-v0.1', { status: 'draft' }));
    expect(i.current).toBeUndefined();
  });

  it('ties: the lowest version in natural order, no version after, then the id', async () => {
    const rel = (id: string, version?: string): Partial<Row> => ({
      type: 'release',
      status: 'planning',
      ...(version !== undefined ? { version, values: [version] } : {}),
      id,
    });
    let rows = withRow(CUSTOM, 'minor-v0.10', rel('minor-v0.10', 'v0.10'));
    rows = withRow(rows, 'minor-v0.1', rel('minor-v0.1', 'v0.9'));
    expect((await inputs(rows)).current?.id).toBe('minor-v0.1');
    rows = withRow(CUSTOM, 'minor-v0.1', rel('minor-v0.1'));
    rows = withRow(rows, 'minor-v0.3', rel('minor-v0.3', 'v0.3'));
    expect((await inputs(rows)).current?.id).toBe('minor-v0.3');
    rows = withRow(CUSTOM, 'minor-v0.1', rel('minor-v0.1'));
    rows = withRow(rows, 'minor-v0.0', rel('minor-v0.0'));
    expect((await inputs(rows)).current?.id).toBe('minor-v0.0');
  });

  it('a state off the sequence ranks below every state of it', async () => {
    let rows = withRow(CUSTOM, 'minor-v0.1', { status: 'planning' });
    rows = withRow(rows, 'minor-v0.2', { type: 'release', status: 'on-hold', version: 'v0.0' });
    expect((await inputs(rows)).current?.id).toBe('minor-v0.1');
  });

  it('flow mode or no scope: no current element, scope type null', async () => {
    const flow = uiOf(renderPreset('kanban'), kanban());
    expect(scopeType(flow)).toBeNull();
    expect(currentElement(await indexOf(CUSTOM, flow), customPacks(), flow)).toBeUndefined();
    const none = uiOf(null);
    expect(scopeType(none)).toBeNull();
  });
});

describe('the figures (spec-012 §3, §11 Figures on the fixtures)', () => {
  it('T-12.1, T-14.1: completion 25 %, US-M-01 1/2 50 %, US-S-01 0/1 0 %, over 2 references', async () => {
    expect(completionFigure(await inputs())).toEqual({
      state: 'shown',
      value: 0.25,
      percent: 25,
      references: [
        { id: 'US-M-01', done: 1, total: 2, percent: 50 },
        { id: 'US-S-01', done: 0, total: 1, percent: 0 },
      ],
      referencesCount: 2,
      ids: ['task-001-cli-adapter', 'task-002-memory-list', 'task-003-element-panel'],
    });
  });

  it('T-12.1, T-13.2: tasks 1/4 in scope, task-002 done', async () => {
    expect(iteratedFigure(await inputs())).toEqual({
      state: 'shown',
      type: 'task',
      done: 1,
      total: 4,
      ids: ['task-001-cli-adapter', 'task-002-memory-list', 'task-003-element-panel', 'task-004-themes'],
      doneIds: ['task-002-memory-list'],
    });
  });

  it('T-12.1: open bugs 1, project-wide', async () => {
    expect(openDefectsFigure(await inputs())).toEqual({
      state: 'shown',
      type: 'bug',
      count: 1,
      ids: ['bug-001-toast-overlap'],
    });
  });

  it('T-12.1, T-13.1: pending gates 3 in natural order; a held gate is not pending (spec-005 §4a)', async () => {
    expect(pendingGatesFigure(await inputs())).toEqual({
      state: 'shown',
      count: 3,
      ids: ['bug-001-toast-overlap', 'dl-002-use-fastify', 'task-001-cli-adapter'],
    });
    const held = await inputs(CUSTOM, uiOf(), (id) => id === 'dl-002-use-fastify');
    expect(pendingGatesFigure(held)).toMatchObject({
      count: 2,
      ids: ['bug-001-toast-overlap', 'task-001-cli-adapter'],
    });
  });

  it('T-12.6: no-linked-elements when the current release has no linked reference', async () => {
    let rows = withRow(CUSTOM, 'minor-v0.1', { status: 'released' });
    rows = withRow(rows, 'minor-v0.2', {
      type: 'release',
      status: 'in-development',
      version: 'v0.2',
      values: ['v0.2'],
    });
    const i = await inputs(rows);
    expect(i.current?.id).toBe('minor-v0.2');
    expect(completionFigure(i)).toEqual({ state: 'unavailable', reason: { code: 'no-linked-elements' } });
    expect(iteratedFigure(i)).toMatchObject({ done: 0, total: 0, ids: [], doneIds: [] });
  });

  it('T-12.5: no current element → every element in scope (project-wide figures)', async () => {
    const rows = withRow(withRow(CUSTOM, 'minor-v0.1', { status: 'draft' }), 'task-009-other', {
      status: 'in-progress',
      values: ['US-M-01'],
    });
    const i = await inputs(rows);
    expect(iteratedFigure(i)).toMatchObject({ total: 5 });
    expect(completionFigure(i)).toMatchObject({ references: [{ id: 'US-M-01', total: 3 }, { id: 'US-S-01' }] });
  });

  it('T-12.2: no-reference-categories without ui.yaml; Unavailable without iterates or defects', async () => {
    const none = uiOf(null);
    const i = await inputs(CUSTOM, none);
    expect(completionFigure(i)).toEqual({ state: 'unavailable', reason: { code: 'no-reference-categories' } });
    const neither = uiOf('version: 1\ntaxonomy: { categories: { task: requirement } }\n');
    const j = await inputs(CUSTOM, neither);
    expect(iteratedFigure(j)).toEqual({ state: 'unavailable', reason: { code: 'no-iterates-type' } });
    expect(openDefectsFigure(j)).toEqual({ state: 'unavailable', reason: { code: 'no-defects-type' } });
  });

  it('an element reference of a requirement-categorised type counts; an uncategorised one counts nowhere', async () => {
    const ui = uiOf('version: 1\ntaxonomy: { categories: { decision-log: requirement } }\n');
    const rows = withRow(
      withRow(CUSTOM, 'task-001-cli-adapter', { values: ['dl-002-use-fastify'] }),
      'task-002-memory-list',
      {
        values: ['adr-001-local-server'],
      },
    );
    const i = await inputs(rows, ui);
    expect(completionFigure(i)).toMatchObject({
      state: 'shown',
      references: [{ id: 'dl-002-use-fastify', done: 0, total: 1, percent: 0 }],
      referencesCount: 1,
    });
  });

  it('at most 10 references in natural order, referencesCount all of them', async () => {
    let rows: Row[] = withRow(CUSTOM, 'minor-v0.1', { status: 'draft' });
    for (let n = 1; n <= 12; n += 1) rows = withRow(rows, `task-1${n}`, { values: [`US-X-${n}`] });
    const c = completionFigure(await inputs(rows));
    expect(c.state).toBe('shown');
    if (c.state !== 'shown') return;
    expect(c.referencesCount).toBe(14);
    expect(c.references).toHaveLength(10);
    expect(c.references.map((r) => r.id).slice(0, 4)).toEqual(['US-M-01', 'US-S-01', 'US-X-1', 'US-X-2']);
  });

  it('an unreadable file links nothing and is in no scope, but counts for open defects and gates', async () => {
    let rows = withRow(CUSTOM, 'task-003-element-panel', { unreadable: true });
    rows = withRow(rows, 'bug-001-toast-overlap', { unreadable: true });
    const i = await inputs(rows);
    expect(completionFigure(i)).toMatchObject({
      references: [{ id: 'US-M-01', done: 1, total: 1 }, { id: 'US-S-01' }],
    });
    expect(iteratedFigure(i)).toMatchObject({ total: 3 });
    expect(openDefectsFigure(i)).toMatchObject({ count: 1 });
    expect(pendingGatesFigure(i)).toMatchObject({ count: 3 });
  });

  it('in scope by the current element id too, not only by its version', async () => {
    const rows = withRow(CUSTOM, 'task-009-by-id', { status: 'in-progress', values: ['minor-v0.1', 'US-S-01'] });
    expect(iteratedFigure(await inputs(rows))).toMatchObject({ total: 5 });
  });
});

describe('the missing-reference flag (spec-012 §5, M-03.1, M-04.3)', () => {
  it('M-03.1: exactly task-004-themes and adr-001-local-server miss a requirement', async () => {
    const index = await indexOf(CUSTOM);
    expect([...missingCategories(index, uiOf().requires.value)]).toEqual([
      ['adr-001-local-server', ['requirement']],
      ['task-004-themes', ['requirement']],
    ]);
  });

  it('M-04.3: none missing once both carry a requirement; unreadable files get no flag', async () => {
    let rows = withRow(CUSTOM, 'task-004-themes', { values: ['v0.1', 'US-X-08'] });
    rows = withRow(rows, 'adr-001-local-server', { unreadable: true });
    expect(missingCategories(await indexOf(rows), uiOf().requires.value).size).toBe(0);
  });

  it('in requires order; no flag without requires', async () => {
    const ui = uiOf('version: 1\ntaxonomy: { requires: { task: [feature, requirement] } }\n');
    const index = await indexOf(CUSTOM, ui);
    expect(missingCategories(index, ui.requires.value).get('task-004-themes')).toEqual(['feature', 'requirement']);
    expect(missingCategories(index, uiOf(null).requires.value).size).toBe(0);
  });
});

describe('the body (D59-10, K1)', () => {
  it('T-12.1: scope, current ElementRef with its short id and tone, ReadOnly phase figures', async () => {
    const body = progressBody(await inputs());
    expect(body.ui).toEqual({ source: 'file' });
    expect(body.mode).toBe('sequence');
    expect(body.scope).toEqual({
      type: 'release',
      current: { id: 'minor-v0.1', title: 'Minor v0.1', type: 'release', status: 'planning', tone: expect.any(String) },
      basis: 'derived',
    });
    expect(body.figures.phase).toEqual({ state: 'read-only', reason: READ_ONLY });
    expect(body.figures.phaseCompletion).toEqual({ state: 'read-only', reason: READ_ONLY });
    expect(body.unreadable).toEqual([]);
    expect(body.capped).toEqual([]);
  });

  it('T-12.5: scope type release, no current, basis null', async () => {
    const body = progressBody(await inputs(withRow(CUSTOM, 'minor-v0.1', { status: 'draft' })));
    expect(body.scope).toEqual({ type: 'release', current: null, basis: null });
  });

  it('AC-6: a bidi and a C1 control in a title and in a pattern reference come back escaped', async () => {
    let rows = withRow(CUSTOM, 'minor-v0.1', { title: 'Minor \u202e v0.1\u0085' });
    rows = withRow(rows, 'task-004-themes', { values: ['v0.1', 'US-\u202eX\u0085'] });
    const i = await inputs(rows);
    const body = progressBody(i);
    expect(body.scope.current?.title).toBe('Minor \\u202e v0.1\\x85');
    const completion = body.figures.completion;
    expect(completion.state === 'shown' && completion.references.map((r) => r.id)).toContain('US-\\u202eX\\x85');
    expect(elementRef(i.current!, { title: 'a​b' }, i.shortIds).title).toBe('a\\u200bb');
  });

  it('unreadable and capped lists in natural order', async () => {
    let rows = withRow(CUSTOM, 'task-004-themes', { unreadable: true });
    rows = withRow(rows, 'task-002-memory-list', { capped: true });
    const body = progressBody(await inputs(rows));
    expect(body.unreadable).toEqual(['task-004-themes']);
    expect(body.capped).toEqual(['task-002-memory-list']);
  });
});

/** Keeps the type import used where only the shape matters. */
export type { FigureInputs };
