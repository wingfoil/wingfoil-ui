// task-059 AC-1, AC-3 (D59-6, D59-7; spec-012 §3, §5, §7) — `contracts/api/progress.schema.json`
// and the amended `elements.schema.json` and `project.schema.json`: the schema compiles in Ajv
// strict mode, the bodies the module builds on the custom fixture's index pass (each figure state),
// an unknown key, a figure state that does not match its fields, an unknown reason code and a
// percent above 100 fail; the capability reason is one definition shared by the header.
import { Ajv } from 'ajv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { progressBody } from '../../server/src/project-state/bodies.js';
import { currentElement } from '../../server/src/project-state/current.js';
import { shortIdsOf } from '../../server/src/reads/short-id.js';
import { REPO_ROOT } from '../harness/cli.js';
import { CUSTOM, indexOf, matchesOf, uiOf, withRow } from '../server/project-state/support.js';
import { customPacks } from '../server/ui-config/samples.js';

const ajv = new Ajv({ allErrors: true });
for (const dir of ['api', 'cli', 'files']) {
  for (const f of readdirSync(path.join(REPO_ROOT, 'contracts', dir))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', dir, f), 'utf8')) as object);
  }
}
const ID = 'https://wingfoil-ui.local/contracts/api/';
const progress = ajv.getSchema(`${ID}progress.schema.json`)!;
const elements = ajv.getSchema(`${ID}elements.schema.json`)!;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bodies mutated into invalid shapes
type Json = any;
const clone = (b: unknown): Json => JSON.parse(JSON.stringify(b));

async function body(rows = CUSTOM, text?: string | null): Promise<Json> {
  const ui = uiOf(text);
  const index = await indexOf(rows, ui);
  const matches = new Map(matchesOf(rows).map((m) => [m.id, m]));
  return progressBody({
    index,
    ui,
    current: currentElement(index, customPacks(), ui),
    held: () => false,
    match: (id) => matches.get(id)!,
    shortIds: shortIdsOf(customPacks()),
    phaseReason: { code: 'needs-version', minVersion: '0.3.0' },
  });
}

describe('contracts/api/progress.schema.json', () => {
  it('compiles in Ajv strict mode', () => {
    const read = (f: string) => JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'api', f), 'utf8')) as object;
    const strict = new Ajv({ strict: true });
    for (const f of ['descriptor.schema.json', 'error.schema.json', 'ui-config.schema.json', 'project.schema.json']) {
      strict.addSchema(read(f));
    }
    expect(() => strict.compile(read('progress.schema.json'))).not.toThrow();
  });

  it('the bodies of the module pass: shown figures, unavailable ones, no current element, no ui.yaml', async () => {
    for (const b of [
      await body(),
      await body(withRow(CUSTOM, 'minor-v0.1', { status: 'draft' })),
      await body(CUSTOM, null),
      await body(withRow(CUSTOM, 'task-004-themes', { unreadable: true, capped: true })),
    ]) {
      expect(progress(b), JSON.stringify(progress.errors)).toBe(true);
    }
  });

  it('refuses an unknown key, a mismatched state, an unknown reason, a percent above 100', async () => {
    const ok = await body();
    const cases: ((b: Json) => void)[] = [
      (b) => (b.extra = 1),
      (b) => (b.figures.extra = 1),
      (b) => (b.figures.completion.state = 'unavailable'),
      (b) => (b.figures.iterated = { state: 'unavailable', reason: { code: 'bogus' } }),
      (b) => (b.figures.completion.percent = 101),
      (b) => (b.figures.phase.reason = { code: 'bogus' }),
      (b) => (b.scope.basis = 'workflow-status'),
      (b) => (b.figures.completion.references[0].extra = 1),
    ];
    for (const mutate of cases) {
      const b = clone(ok);
      mutate(b);
      expect(progress(b), mutate.toString()).toBe(false);
    }
  });

  it('the capability reason is one definition of project.schema.json', () => {
    const project = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'api', 'project.schema.json'), 'utf8'));
    expect(project.definitions.capabilityReason.oneOf).toHaveLength(4);
    expect(project.properties.capabilities.properties.capabilities.items.properties.reason).toEqual({
      $ref: '#/definitions/capabilityReason',
    });
  });
});

describe('contracts/api/elements.schema.json — the missing-reference flag (§5)', () => {
  const list = (extra: Json, row: Json = {}) => ({
    elements: [{ path: 'p', id: 'a', title: 't', type: 'task', status: 's', tags: [], localChanges: false, ...row }],
    warnings: [],
    ...extra,
  });
  it('accepts missingCategories and missingReferences; refuses an empty list, an unknown category or key', () => {
    expect(
      elements(
        list(
          { missingReferences: { shown: true, unreadable: [], capped: [] } },
          { missingCategories: ['requirement'] },
        ),
      ),
    ).toBe(true);
    expect(elements(list({}, { missingCategories: [] }))).toBe(false);
    expect(elements(list({}, { missingCategories: ['bogus'] }))).toBe(false);
    expect(elements(list({ missingReferences: { shown: true, unreadable: [], capped: [], x: 1 } }))).toBe(false);
    expect(elements(list({ missingReferences: { shown: true } }))).toBe(false);
  });
});
