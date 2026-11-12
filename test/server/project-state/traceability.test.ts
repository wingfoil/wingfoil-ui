// task-074 AC-1, AC-4, AC-6 (D74-2, D74-4, Q1 … Q3; spec-012 §1, §4, §9) — the Traceability rows,
// the coverage figure and the body without its element rows, on the custom fixture's index (task-059
// probe P1) and variations of it: rows of every category by kind and key, the `current` omission, the
// `no-elements` rows of `project`, the status codes, natural order and the element-first tie,
// `percent: null`, coverage and `no-requires`, `inScope` (Q1), the escape of titles and values.
import type { TraceabilityScope } from '@wingfoil-ui/contracts';
import { describe, expect, it } from 'vitest';
import { traceabilityParts, type TraceabilityInputs } from '../../../server/src/project-state/bodies.js';
import { currentElement } from '../../../server/src/project-state/current.js';
import { coverageFigure } from '../../../server/src/project-state/figures.js';
import { missingCategories } from '../../../server/src/project-state/missing.js';
import { traceabilityRows } from '../../../server/src/project-state/traceability.js';
import { shortIdsOf } from '../../../server/src/reads/short-id.js';
import type { EffectiveUiConfig } from '../../../server/src/ui-config/types.js';
import { customPacks } from '../ui-config/samples.js';
import { CUSTOM, indexOf, matchesOf, uiOf, withRow, type Row } from './support.js';

const DL_001 = 'dl-001-initialise-wingfoil-before-inception';

async function inputs(
  rows: readonly Row[] = CUSTOM,
  asked: TraceabilityScope = 'current',
  ui: EffectiveUiConfig = uiOf(),
): Promise<TraceabilityInputs> {
  const memoryYaml = customPacks();
  const index = await indexOf(rows, ui, memoryYaml);
  const matches = new Map(matchesOf(rows).map((m) => [m.id, m]));
  return {
    index,
    ui,
    current: currentElement(index, memoryYaml, ui),
    asked,
    missing: missingCategories(index, ui.requires.value),
    match: (id) => matches.get(id)!,
    shortIds: shortIdsOf(memoryYaml),
    phaseReason: { code: 'not-in-release' },
  };
}

async function rowsOf(rows: readonly Row[] = CUSTOM, asked: TraceabilityScope = 'current', ui = uiOf()) {
  const i = await inputs(rows, asked, ui);
  const applied = asked === 'current' && i.current ? 'current' : 'project';
  return traceabilityRows({
    index: i.index,
    ui: i.ui,
    current: applied === 'current' ? i.current : undefined,
    applied,
  });
}

describe('the rows (D74-2, spec-012 §4)', () => {
  it('R-01.1, R-01.9 the custom fixture with the preset: US-M-01 50 % · 1/2, US-S-01 0 % · 0/1, both requirement', async () => {
    expect(await rowsOf()).toEqual([
      {
        id: 'US-M-01',
        category: 'requirement',
        element: false,
        linked: ['task-002-memory-list', 'task-003-element-panel'],
        done: 1,
        total: 2,
        percent: 50,
        status: 'in-progress',
      },
      {
        id: 'US-S-01',
        category: 'requirement',
        element: false,
        linked: ['task-001-cli-adapter'],
        done: 0,
        total: 1,
        percent: 0,
        status: 'not-started',
      },
    ]);
  });

  it('R-01.3 no row is completed on the fixture; a row whose linked elements are all done is', async () => {
    expect((await rowsOf()).filter((r) => r.status === 'completed')).toEqual([]);
    const rows = withRow(CUSTOM, 'task-003-element-panel', { status: 'done' });
    expect((await rowsOf(rows)).find((r) => r.id === 'US-M-01')).toMatchObject({
      done: 2,
      total: 2,
      percent: 100,
      status: 'completed',
    });
  });

  it('R-01.5 with current a reference with no in-scope linked element is omitted; with project it is a row', async () => {
    const rows = withRow(CUSTOM, DL_001, { values: ['', 'US-S-09'] });
    expect((await rowsOf(rows)).map((r) => r.id)).toEqual(['US-M-01', 'US-S-01']);
    const project = await rowsOf(rows, 'project');
    expect(project.map((r) => r.id)).toEqual(['US-M-01', 'US-S-01', 'US-S-09']);
    // dl-001 is `ready`, the last state of its sequence: done.
    expect(project[2]).toMatchObject({ linked: [DL_001], element: false, done: 1, status: 'completed' });
  });

  it('R-01.7 an element reference is a row of its target type’s category, element true', async () => {
    const rows = withRow(CUSTOM, 'task-001-cli-adapter', { values: ['v0.1', 'n/a', '', 'US-S-01', DL_001] });
    const row = (await rowsOf(rows)).find((r) => r.id === DL_001);
    expect(row).toEqual({
      id: DL_001,
      category: 'decision',
      element: true,
      linked: ['task-001-cli-adapter'],
      done: 0,
      total: 1,
      percent: 0,
      status: 'not-started',
    });
    // Without ui.yaml: the inferred categories only, no pattern rows (R-01.7's note).
    const plain = await rowsOf(rows, 'current', uiOf(null));
    expect(plain.map((r) => [r.id, r.category, r.element])).toEqual([[DL_001, 'decision', true]]);
  });

  it('every category is a row (TQ-1 (b)); an uncategorised reference is none', async () => {
    const rows = withRow(CUSTOM, 'task-004-themes', { values: ['v0.1', 'minor-v9', 'zzz-1'] });
    const found = (await rowsOf(rows)).find((r) => r.id === 'minor-v9');
    expect(found).toMatchObject({ category: 'release', element: false, linked: ['task-004-themes'] });
    expect((await rowsOf(rows)).some((r) => r.id === 'zzz-1')).toBe(false);
  });

  it('review round 1 F-1: an element reference whose target type has no category is no row (spec-012 §1)', async () => {
    // Only `adr` categorised: `task` and `decision-log` have none.
    const ui = uiOf(
      'version: 1\ntaxonomy: { categories: { adr: requirement } }\nprogress: { mode: sequence, scope: { type: release } }\n',
    );
    const rows = withRow(CUSTOM, 'task-001-cli-adapter', { values: ['v0.1', DL_001, 'adr-001-local-server'] });
    const i = await inputs(rows, 'current', ui);
    const task001 = i.index.get('task-001-cli-adapter')!;
    // The index makes the element reference, with no category …
    expect(task001.references).toContainEqual(expect.objectContaining({ kind: 'element', id: DL_001, category: null }));
    // … and the rows leave it out, in both scopes; the categorised one is a row.
    for (const asked of ['current', 'project'] as const) {
      const got = await rowsOf(rows, asked, ui);
      expect(got.some((r) => r.id === DL_001)).toBe(false);
      expect(got.find((r) => r.id === 'adr-001-local-server')).toMatchObject({
        element: true,
        linked: ['task-001-cli-adapter'],
      });
    }
  });

  it('project: a requirement or feature element no element references is a no-elements row', async () => {
    const ui = uiOf(
      'version: 1\ntaxonomy: { categories: { adr: requirement }, patterns: [{ match: "^US-", category: requirement }] }\nprogress: { mode: sequence, scope: { type: release } }\n',
    );
    const project = await rowsOf(CUSTOM, 'project', ui);
    expect(project.find((r) => r.id === 'adr-001-local-server')).toEqual({
      id: 'adr-001-local-server',
      category: 'requirement',
      element: true,
      linked: [],
      done: 0,
      total: 0,
      percent: null,
      status: 'no-elements',
    });
    // Referenced, it is an ordinary element row; with current, no no-elements row at all.
    const referenced = withRow(CUSTOM, 'task-004-themes', { values: ['v0.1', 'adr-001-local-server'] });
    expect((await rowsOf(referenced, 'project', ui)).find((r) => r.id === 'adr-001-local-server')).toMatchObject({
      linked: ['task-004-themes'],
      status: 'not-started',
    });
    expect((await rowsOf(CUSTOM, 'current', ui)).some((r) => r.status === 'no-elements')).toBe(false);
  });

  it('natural order of rows and of linked; an element row before a pattern row of the same id (Q3 (a))', async () => {
    const rows = [
      ...CUSTOM,
      { id: 'US-M-10', type: 'task', status: 'backlog', values: ['v0.1', 'US-M-10', 'US-M-2'] },
      { id: 'task-010-z', type: 'task', status: 'backlog', values: ['v0.1', 'US-M-10', 'US-M-01'] },
    ];
    const got = await rowsOf(rows);
    expect(got.map((r) => [r.id, r.element])).toEqual([
      ['US-M-01', false],
      ['US-M-2', false],
      // task-010-z's value names the element US-M-10 (rule 1); US-M-10's own id is rule 2.
      ['US-M-10', true],
      ['US-M-10', false],
      ['US-S-01', false],
    ]);
    expect(got[0]!.linked).toEqual(['task-002-memory-list', 'task-003-element-panel', 'task-010-z']);
    expect(got[2]).toMatchObject({ category: 'work', linked: ['task-010-z'] });
    expect(got[3]).toMatchObject({ category: 'requirement', linked: ['US-M-10'] });
  });

  it('an unreadable element links nothing', async () => {
    const rows = withRow(CUSTOM, 'task-001-cli-adapter', { unreadable: true });
    expect((await rowsOf(rows, 'project')).some((r) => r.id === 'US-S-01')).toBe(false);
  });
});

describe('coverage (D74-4, Q2 (a))', () => {
  it('R-01.1 3/5 on the fixture (task-004 and adr-001 missing a requirement)', async () => {
    const i = await inputs();
    expect(coverageFigure(i.index, i.ui.requires.value, i.missing)).toEqual({
      state: 'shown',
      carrying: 3,
      total: 5,
      percent: 60,
    });
  });

  it('no-requires without requires; percent null when no element of a required type is listed', async () => {
    const plain = uiOf(null);
    const i = await inputs(CUSTOM, 'current', plain);
    expect(coverageFigure(i.index, plain.requires.value, i.missing)).toEqual({
      state: 'unavailable',
      reason: { code: 'no-requires' },
    });
    const ui = uiOf('version: 1\ntaxonomy: { requires: { tech-spec: [requirement] } }\n');
    const j = await inputs(CUSTOM, 'current', ui);
    expect(coverageFigure(j.index, ui.requires.value, j.missing)).toEqual({
      state: 'shown',
      carrying: 0,
      total: 0,
      percent: null,
    });
  });

  it('an unreadable element is left out of coverage', async () => {
    const i = await inputs(withRow(CUSTOM, 'task-004-themes', { unreadable: true }));
    expect(coverageFigure(i.index, i.ui.requires.value, i.missing)).toMatchObject({ carrying: 3, total: 4 });
  });
});

describe('the body without its rows (D74-4, Q1 (a), K1)', () => {
  it('R-01.1, R-01.8 current: applied current, completion 25 %, coverage 3/5, missing task-004 and adr-001', async () => {
    const { body, elements } = traceabilityParts(await inputs());
    expect(body.scope).toMatchObject({ type: 'release', applied: 'current', current: { id: 'minor-v0.1' } });
    expect(body.patterns).toBe(true);
    expect(body.figures.completion).toMatchObject({ state: 'shown', percent: 25 });
    expect(body.figures.coverage).toEqual({ state: 'shown', carrying: 3, total: 5, percent: 60 });
    expect(body.figures.phaseCompletion).toEqual({ state: 'read-only', reason: { code: 'not-in-release' } });
    expect(body.figures.referencesWithoutElements).toBe(0);
    expect(body.missing).toEqual([
      { id: 'adr-001-local-server', categories: ['requirement'] },
      { id: 'task-004-themes', categories: ['requirement'] },
    ]);
    expect(elements).toEqual([
      { id: 'adr-001-local-server', finished: false, inScope: false },
      { id: 'task-001-cli-adapter', finished: false, inScope: true },
      { id: 'task-002-memory-list', finished: true, inScope: true },
      { id: 'task-003-element-panel', finished: false, inScope: true },
      { id: 'task-004-themes', finished: false, inScope: true },
    ]);
    expect(body.unreadable).toEqual([]);
    expect(body.capped).toEqual([]);
  });

  it('project with a current element: applied project, whole-project completion, inScope still the current scope (Q1 (a))', async () => {
    const rows = withRow(CUSTOM, DL_001, { values: ['', 'US-S-09'] });
    const { body, elements } = traceabilityParts(await inputs(rows, 'project'));
    expect(body.scope).toMatchObject({ applied: 'project', current: { id: 'minor-v0.1' } });
    expect(body.references.map((r) => r.id)).toEqual(['US-M-01', 'US-S-01', 'US-S-09']);
    expect(elements.find((e) => e.id === DL_001)).toEqual({ id: DL_001, finished: true, inScope: false });
    expect(body.figures.completion).toMatchObject({ referencesCount: 3 });
  });

  it('no current element: applied project and every element in scope', async () => {
    const rows = withRow(CUSTOM, 'minor-v0.1', { status: 'draft' });
    const { body, elements } = traceabilityParts(await inputs(rows));
    expect(body.scope).toMatchObject({ applied: 'project', current: null });
    expect(elements.every((e) => e.inScope)).toBe(true);
  });

  it('referencesWithoutElements counts the no-elements rows', async () => {
    const ui = uiOf('version: 1\ntaxonomy: { categories: { adr: requirement } }\n');
    const { body } = traceabilityParts(await inputs(CUSTOM, 'project', ui));
    expect(body.figures.referencesWithoutElements).toBe(1);
    expect(body.patterns).toBe(false);
  });

  it('K1 the current title and a pattern value are escaped; ids as listed', async () => {
    const rows = withRow(withRow(CUSTOM, 'minor-v0.1', { title: 'Minor ‮ v0.1\u0085' }), 'task-004-themes', {
      values: ['v0.1', 'US-‮X\u0085'],
    });
    const { body } = traceabilityParts(await inputs(rows));
    expect(body.scope.current?.title).toBe('Minor \\u202e v0.1\\x85');
    expect(body.references.map((r) => r.id)).toContain('US-\\u202eX\\x85');
    expect(JSON.stringify(body)).not.toMatch(/[‮\u0085]/);
  });

  it('unreadable and capped from the index, in natural order', async () => {
    const rows = withRow(withRow(CUSTOM, 'task-004-themes', { unreadable: true }), 'task-001-cli-adapter', {
      capped: true,
    });
    const { body } = traceabilityParts(await inputs(rows));
    expect(body.unreadable).toEqual(['task-004-themes']);
    expect(body.capped).toEqual(['task-001-cli-adapter']);
  });
});
