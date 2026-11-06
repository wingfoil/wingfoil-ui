// task-068 AC-1 (D68-1, D68-2; spec-012 §2, §7) — `contracts/api/ui-config.schema.json`, the `ui`
// section of `GET /api/p/:pid/config`, and `config.schema.json`'s optional `ui`: the bodies the
// serialiser builds for the three sources and the sw-life-cycle preset pass; an unknown key at
// each level, a warning that does not match the source, an unknown category, origin or condition
// fail.
import { Ajv } from 'ajv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderPreset } from '../../server/src/presets/ui-config.js';
import { uiConfigBody } from '../../server/src/ui-config/body.js';
import { effectiveUiConfig } from '../../server/src/ui-config/effective.js';
import { REPO_ROOT } from '../harness/cli.js';
import { customPacks, kanban } from '../server/ui-config/samples.js';

const ajv = new Ajv({ allErrors: true });
for (const dir of ['api', 'cli', 'files']) {
  for (const f of readdirSync(path.join(REPO_ROOT, 'contracts', dir))) {
    ajv.addSchema(JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', dir, f), 'utf8')) as object);
  }
}
const ID = 'https://wingfoil-ui.local/contracts/api/';
const ui = ajv.getSchema(`${ID}ui-config.schema.json`)!;
const config = ajv.getSchema(`${ID}config.schema.json`)!;
const ROOTS = { home: null };
const text = (t: string) => ({ kind: 'text' as const, text: t, sha256: String(t.length) });

const bodies = {
  none: () => uiConfigBody(effectiveUiConfig({ kind: 'absent' }, kanban(), ROOTS)),
  ignored: () => uiConfigBody(effectiveUiConfig(text('version: 1\nprogress: { mode: spiral }\n'), kanban(), ROOTS)),
  file: () => uiConfigBody(effectiveUiConfig(text(renderPreset('kanban')), kanban(), ROOTS)),
  'sw-life-cycle': () => uiConfigBody(effectiveUiConfig(text(renderPreset('sw-life-cycle')), customPacks(), ROOTS)),
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- bodies mutated into invalid shapes
type Json = any;
const clone = (b: unknown): Json => JSON.parse(JSON.stringify(b));
const valid = (body: unknown): boolean => ui(body) as boolean;

describe('contracts/api/ui-config.schema.json', () => {
  it('is draft-07 with the definitions of spec-012 §7', () => {
    const schema = ui.schema as Record<string, Json>;
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#');
    expect(Object.keys(schema['definitions']).sort()).toEqual(['category', 'elementRef', 'origin', 'status']);
    expect(schema['definitions'].category.enum).toEqual([
      'work',
      'defect',
      'decision',
      'spec',
      'requirement',
      'feature',
      'release',
      'external',
    ]);
    expect(schema['definitions'].origin.enum).toEqual(['declared', 'inferred', 'derived']);
  });

  it('compiles in Ajv strict mode', () => {
    const read = (f: string) => JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'api', f), 'utf8')) as object;
    const strict = new Ajv({ strict: true }).addSchema(read('descriptor.schema.json'));
    expect(() => strict.compile(read('ui-config.schema.json'))).not.toThrow();
  });

  it.each(Object.entries(bodies))('accepts the body of %s', (_label, make) => {
    expect(valid(make()), JSON.stringify(ui.errors)).toBe(true);
  });

  it('accepts a current element, with and without a short id', () => {
    const body = clone(bodies['sw-life-cycle']());
    const current = { id: 'minor-v0.1', title: 'v0.1', type: 'release', status: 'planning', tone: 'active' };
    body.progress.scope.current = current;
    expect(valid(body)).toBe(true);
    body.progress.scope.current = { ...current, shortId: 'minor-v0.1' };
    expect(valid(body)).toBe(true);
    body.progress.scope.current = { ...current, tone: 'loud' };
    expect(valid(body)).toBe(false);
  });

  it.each<[string, (b: Json) => void]>([
    ['an unknown key at the root', (b) => (b.permissions = {})],
    ['an unknown key in taxonomy', (b) => (b.taxonomy.extra = 1)],
    ['an unknown key in a category row', (b) => (b.taxonomy.categories[0].extra = 1)],
    ['an unknown key in progress.mode', (b) => (b.progress.mode.extra = 1)],
    ['an unknown key in progress.scope', (b) => (b.progress.scope.id = 'x')],
    ['an unknown key in holds', (b) => (b.holds.extra = 1)],
    ['an unknown key in status', (b) => (b.status.extra = 1)],
    ['a missing key', (b) => delete b.artifacts],
    ['an unknown category', (b) => (b.taxonomy.categories[0].category = 'epic')],
    ['an unknown origin', (b) => (b.progress.mode.origin = 'guessed')],
    ['an unknown mode', (b) => (b.progress.mode.value = 'spiral')],
    ['a warning with source file', (b) => (b.status.warning = { code: 'ui-config-ignored', failure: 'x' })],
  ])('rejects %s', (_label, mutate) => {
    const body = clone(bodies.file());
    mutate(body);
    expect(valid(body)).toBe(false);
  });

  it.each<[string, (b: Json) => void]>([
    ['ignored without a warning', (b) => delete b.status.warning],
    ['another warning code', (b) => (b.status.warning.code = 'other')],
    ['an empty failure', (b) => (b.status.warning.failure = '')],
  ])('rejects %s', (_label, mutate) => {
    const body = clone(bodies.ignored());
    mutate(body);
    expect(valid(body)).toBe(false);
  });

  it('rejects an unknown hold condition', () => {
    const body = clone(bodies['sw-life-cycle']());
    body.holds.value[0].approve = 'always';
    expect(valid(body)).toBe(false);
  });
});

describe('contracts/api/config.schema.json — the optional ui', () => {
  const error = { code: 'cli-output', message: 'Unexpected output' };
  const sections = { dna: { error }, paths: { error }, workflows: { error }, types: { error } };

  it('accepts a body without ui (memory.yaml unreadable) and with one', () => {
    expect(config(sections), JSON.stringify(config.errors)).toBe(true);
    expect(config({ ...sections, ui: bodies.none() }), JSON.stringify(config.errors)).toBe(true);
  });

  it('rejects a ui that is not the section', () => {
    expect(config({ ...sections, ui: { status: { source: 'none' } } })).toBe(false);
  });
});
