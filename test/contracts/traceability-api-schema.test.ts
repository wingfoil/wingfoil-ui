// task-074 AC-1 (D74-6, D74-7; spec-012 §4, §7) — `contracts/api/traceability.schema.json` and the
// factored `elements.schema.json` `definitions.row` and `progress.schema.json`
// `definitions.completion`: the schema compiles in Ajv strict mode, the bodies the module builds on
// the custom fixture's index pass (both scopes, no current element, no ui.yaml, Q2's null percent),
// an unknown key, a bad status, a percent above 100, a bad `applied` fail, and the element item names
// every row key but `missingCategories`, so a key added to the row fails here until it is named.
import { Ajv } from 'ajv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { traceabilityParts } from '../../server/src/project-state/bodies.js';
import { currentElement } from '../../server/src/project-state/current.js';
import { missingCategories } from '../../server/src/project-state/missing.js';
import { shortIdsOf } from '../../server/src/reads/short-id.js';
import { REPO_ROOT } from '../harness/cli.js';
import { CUSTOM, indexOf, matchesOf, uiOf, withRow } from '../server/project-state/support.js';
import { customPacks } from '../server/ui-config/samples.js';

const API = path.join(REPO_ROOT, 'contracts', 'api');
const read = (f: string) => JSON.parse(readFileSync(path.join(API, f), 'utf8')) as Json;
const ajv = new Ajv({ allErrors: true });
for (const dir of ['api', 'cli', 'files']) {
  for (const f of readdirSync(path.join(REPO_ROOT, 'contracts', dir))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', dir, f), 'utf8')) as object);
  }
}
const ID = 'https://wingfoil-ui.local/contracts/api/';
const traceability = ajv.getSchema(`${ID}traceability.schema.json`)!;
const progress = ajv.getSchema(`${ID}progress.schema.json`)!;
const elements = ajv.getSchema(`${ID}elements.schema.json`)!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bodies mutated into invalid shapes
type Json = any;
const clone = (b: unknown): Json => JSON.parse(JSON.stringify(b));

/** A body of the module with a minimal `/elements` row per named element. */
async function body(rows = CUSTOM, text?: string | null, asked: 'current' | 'project' = 'current'): Promise<Json> {
  const ui = uiOf(text);
  const memoryYaml = customPacks();
  const index = await indexOf(rows, ui, memoryYaml);
  const matches = new Map(matchesOf(rows).map((m) => [m.id, m]));
  const parts = traceabilityParts({
    index,
    ui,
    current: currentElement(index, memoryYaml, ui),
    asked,
    missing: missingCategories(index, ui.requires.value),
    match: (id) => matches.get(id)!,
    shortIds: shortIdsOf(memoryYaml),
    phaseReason: { code: 'needs-version', minVersion: '0.3.0' },
  });
  return {
    ...parts.body,
    elements: parts.elements.map(({ id, finished, inScope }) => ({
      ...matches.get(id)!,
      localChanges: false,
      done: finished,
      inScope,
    })),
  };
}

describe('contracts/api/traceability.schema.json', () => {
  it('compiles in Ajv strict mode', () => {
    const strict = new Ajv({ strict: true });
    for (const f of readdirSync(API)) if (f !== 'traceability.schema.json') strict.addSchema(read(f));
    expect(() => strict.compile(read('traceability.schema.json'))).not.toThrow();
  });

  it('the bodies of the module pass: both scopes, no current element, no ui.yaml, a null coverage percent', async () => {
    for (const b of [
      await body(),
      await body(CUSTOM, undefined, 'project'),
      await body(withRow(CUSTOM, 'minor-v0.1', { status: 'draft' })),
      await body(CUSTOM, null),
      await body(CUSTOM, 'version: 1\ntaxonomy: { categories: { adr: requirement } }\n', 'project'),
      await body(CUSTOM, 'version: 1\ntaxonomy: { requires: { tech-spec: [requirement] } }\n'),
      await body(withRow(CUSTOM, 'task-004-themes', { unreadable: true, capped: true })),
    ]) {
      expect(traceability(b), JSON.stringify(traceability.errors)).toBe(true);
    }
    const eventsError = { ...(await body()), eventsError: { code: 'internal', message: 'Memory events unavailable' } };
    expect(traceability(eventsError)).toBe(true);
  });

  it('refuses an unknown key, a bad status, a percent above 100, a bad applied, a missingCategories row', async () => {
    const ok = await body();
    const cases: ((b: Json) => void)[] = [
      (b) => (b.extra = 1),
      (b) => (b.figures.extra = 1),
      (b) => (b.references[0].extra = 1),
      (b) => (b.references[0].status = 'done'),
      (b) => (b.references[0].percent = 101),
      (b) => (b.references[0].category = 'bogus'),
      (b) => (b.figures.coverage = { state: 'unavailable', reason: { code: 'bogus' } }),
      (b) => (b.figures.coverage.percent = 101),
      (b) => (b.scope.applied = 'release'),
      (b) => (b.missing[0].categories = []),
      (b) => (b.elements[0].missingCategories = ['requirement']),
      (b) => (b.elements[0].extra = 1),
      (b) => delete b.elements[0].inScope,
      (b) => delete b.figures.coverage,
    ];
    for (const mutate of cases) {
      const b = clone(ok);
      mutate(b);
      expect(traceability(b), mutate.toString()).toBe(false);
    }
  });

  it('the element item names every /elements row key but missingCategories, plus done and inScope', () => {
    const row = read('elements.schema.json').definitions.row;
    const item = read('traceability.schema.json').properties.elements.items;
    const keys = Object.keys(row.properties).filter((k) => k !== 'missingCategories');
    expect(Object.keys(item.properties)).toEqual([...keys, 'done', 'inScope']);
    expect(item.required).toEqual([...row.required, 'done', 'inScope']);
  });
});

describe('the factored definitions (D74-6, D74-7)', () => {
  it('elements.schema.json items is definitions.row; progress.schema.json completion is definitions.completion', () => {
    expect(read('elements.schema.json').properties.elements.items).toEqual({ $ref: '#/definitions/row' });
    expect(read('progress.schema.json').properties.figures.properties.completion).toEqual({
      $ref: '#/definitions/completion',
    });
    const list = {
      elements: [{ path: 'p', id: 'a', title: 't', type: 'task', status: 's', tags: [], localChanges: false }],
      warnings: [],
    };
    expect(elements(list)).toBe(true);
    expect(elements({ ...list, elements: [{ ...list.elements[0], extra: 1 }] })).toBe(false);
    expect(progress({})).toBe(false);
  });
});
