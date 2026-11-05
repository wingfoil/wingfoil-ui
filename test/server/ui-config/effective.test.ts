// spec-005 §2–§3 (amended 2026-11-05), spec-012 §2 `status`, AC-3 (origins), AC-4, task-054 D54-6,
// D54-7 — the effective configuration: inferred values on every fixture and version, declared
// values with their origins, an ignored file's warning (redacted and escaped), and the parse cache
// keyed by the content. Module-level parts of C-01.1, C-01.3, C-04.1, C-04.2, C-04.3, T-12.1,
// T-12.4, T-12.5 (the `/config` section and the current element are other tasks').
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { MemoryYaml } from '@wingfoil-ui/contracts';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import type { UiYamlEntry } from '../../../server/src/reads/ui-yaml.js';
import { effectiveUiConfig, UiYamlCache } from '../../../server/src/ui-config/effective.js';
import type { EffectiveUiConfig } from '../../../server/src/ui-config/types.js';
import { MATRIX, sampleMemoryYaml } from './samples.js';

const ROOT = ['', 'srv', 'projects', 'demo'].join('/');
const ROOTS = { project: [ROOT], home: null };

const text = (t: string): UiYamlEntry => ({
  kind: 'text',
  text: t,
  sha256: createHash('sha256').update(t).digest('hex'),
});

/** The categories as a plain object, with their origin. */
const categories = (e: EffectiveUiConfig) => ({
  origin: e.categories.origin,
  value: Object.fromEntries(e.categories.value),
});

/** Every origin of the configuration. */
const origins = (e: EffectiveUiConfig): string[] => [
  e.categories.origin,
  e.patterns.origin,
  e.requires.origin,
  e.progress.mode.origin,
  e.progress.scope.origin,
  e.progress.phases.origin,
  e.progress.iterates.origin,
  e.progress.defects.origin,
  e.holds.origin,
  e.artifacts.origin,
];

const KANBAN = {
  adr: 'decision',
  bug: 'defect',
  'decision-log': 'decision',
  release: 'release',
  'release-line': 'release',
  task: 'work',
  'tech-spec': 'spec',
};

/** The inferred values every fixture shares (spec-005 §3) beyond the categories. */
function expectInferredRest(e: EffectiveUiConfig): void {
  expect(e.patterns).toEqual({ value: [], origin: 'inferred' });
  expect(e.requires.origin).toBe('inferred');
  expect(e.requires.value.size).toBe(0);
  expect(e.progress.mode).toEqual({ value: 'flow', origin: 'inferred' });
  expect(e.progress.scope).toEqual({ value: null, origin: 'inferred' });
  expect(e.progress.phases).toEqual({ value: [], origin: 'inferred' });
  expect(e.holds.origin).toBe('inferred');
  expect(e.holds.value.size).toBe(0);
  expect(e.artifacts).toEqual({ value: [], origin: 'inferred' });
}

describe.each(MATRIX)('inferred values on WingFoil %s (AC-4)', (version) => {
  const none = (my: MemoryYaml) => effectiveUiConfig({ kind: 'absent' }, my, ROOTS);

  it('C-01.1 — kanban: task → work, bug → defect, every value inferred, no warning', () => {
    const my = sampleMemoryYaml(version, 'kanban');
    const e = none(my);
    expect(e.status).toEqual({ source: 'none' });
    const expected: Record<string, string | null> = { ...KANBAN };
    if ('plan' in my.types) expected['plan'] = null;
    expect(categories(e)).toEqual({ origin: 'inferred', value: expected });
    expect([...e.categories.value.keys()]).toEqual(Object.keys(my.types));
    expect(e.progress.iterates).toEqual({ value: 'task', origin: 'inferred' });
    expect(e.progress.defects).toEqual({ value: 'bug', origin: 'inferred' });
    expectInferredRest(e);
  });

  it('custom: service → external; plan (and sprint) with no category', () => {
    const my = sampleMemoryYaml(version, 'custom');
    const e = none(my);
    expect(e.categories.value.get('service')).toBe('external');
    expect(e.categories.value.get('plan')).toBeNull();
    if ('sprint' in my.types) expect(e.categories.value.get('sprint')).toBeNull();
    expect(e.progress.iterates.value).toBe('task');
    expect(e.progress.defects.value).toBe('bug');
    expectInferredRest(e);
  });

  it('C-01.3 — unknown: story and note have no category; no iterated or defect type', () => {
    const e = none(sampleMemoryYaml(version, 'unknown'));
    expect(categories(e)).toEqual({ origin: 'inferred', value: { story: null, note: null } });
    expect(e.progress.iterates).toEqual({ value: null, origin: 'inferred' });
    expect(e.progress.defects).toEqual({ value: null, origin: 'inferred' });
    expectInferredRest(e);
  });
});

describe('a file that is used', () => {
  const custom = sampleMemoryYaml(MATRIX[MATRIX.length - 1]!, 'custom');

  it('the sw-life-cycle preset on custom: every key declared; a type the map leaves out is null, declared', () => {
    const e = effectiveUiConfig(text(renderPreset('sw-life-cycle')), custom, ROOTS);
    expect(e.status).toEqual({ source: 'file' });
    expect(origins(e).every((o) => o === 'declared')).toBe(true);
    expect(e.categories.value.get('release-line')).toBeNull();
    expect(e.categories.value.get('service')).toBe('external');
    expect([...e.categories.value.keys()]).toEqual(Object.keys(custom.types));
    expect(e.patterns.value.map((p) => [p.match, p.category, p.regex.flags])).toEqual([
      ['^(REQ|US)-', 'requirement', 'u'],
      ['^(P\\d|Journey)', 'feature', 'u'],
      ['^(minor|patch)-v|^rl-', 'release', 'u'],
    ]);
    expect(e.patterns.value[0]!.regex.test('US-M-01')).toBe(true);
    expect(Object.fromEntries(e.requires.value)).toEqual({
      task: ['requirement'],
      adr: ['requirement'],
      'tech-spec': ['requirement'],
    });
    // T-12.1, T-12.4, T-12.5 (module level): the scope type, declared; the current element is derived elsewhere.
    expect(e.progress.mode).toEqual({ value: 'sequence', origin: 'declared' });
    expect(e.progress.scope).toEqual({ value: { type: 'release' }, origin: 'declared' });
    expect(e.progress.phases.value).toEqual([
      'sprint-planning',
      'development',
      'plan-release',
      'release',
      'sprint-review',
      'retrospective',
      'close',
    ]);
    // S-24.5, S-24.6 (module level): the holds.
    expect(e.holds.value.get('release')?.get('releasing')).toBe('never');
    expect(e.holds.value.get('release-line')?.get('active')).toBe('when-references-done');
    expect(e.artifacts.value).toHaveLength(3);
  });

  it('keys the file omits are inferred; iterates and defects follow the effective categories', () => {
    const e = effectiveUiConfig(text('version: 1\ntaxonomy:\n  categories: { bug: work }\n'), custom, ROOTS);
    expect(e.status).toEqual({ source: 'file' });
    expect(e.categories.origin).toBe('declared');
    expect(e.categories.value.get('task')).toBeNull();
    expect(e.progress.iterates).toEqual({ value: 'bug', origin: 'inferred' });
    expect(e.progress.defects).toEqual({ value: null, origin: 'inferred' });
    expect(e.patterns.origin).toBe('inferred');
    expect(e.progress.mode).toEqual({ value: 'flow', origin: 'inferred' });
  });

  it('two types of one category: no inferred iterated type', () => {
    const e = effectiveUiConfig(
      text('version: 1\ntaxonomy:\n  categories: { bug: work, task: work }\n'),
      custom,
      ROOTS,
    );
    expect(e.progress.iterates).toEqual({ value: null, origin: 'inferred' });
  });
});

describe('a file that is ignored (spec-005 §2, spec-012 §2 status)', () => {
  const kanban = sampleMemoryYaml(MATRIX[MATRIX.length - 1]!, 'kanban');

  it('C-04.1 — progress.mode spiral: ignored with the failure, inferred values (flow, no scope)', () => {
    const e = effectiveUiConfig(
      text('version: 1\nprogress:\n  mode: spiral\n  scope: { type: release }\n'),
      kanban,
      ROOTS,
    );
    expect(e.status).toEqual({
      source: 'ignored',
      warning: { code: 'ui-config-ignored', failure: 'progress.mode must be sequence or flow (found spiral)' },
    });
    expect(e.progress.mode).toEqual({ value: 'flow', origin: 'inferred' });
    expect(e.progress.scope).toEqual({ value: null, origin: 'inferred' });
    expect(origins(e).every((o) => o === 'inferred')).toBe(true);
  });

  it('C-04.2 — unparsable YAML: the engine message with its line, every value inferred', () => {
    const e = effectiveUiConfig(text('taxonomy:\n  categories: [unclosed\n'), kanban, ROOTS);
    expect(e.status.source).toBe('ignored');
    expect(e.status.warning?.failure).toMatch(/ at line \d+, column \d+$/);
    expect(origins(e).every((o) => o === 'inferred')).toBe(true);
    expect(e.categories.value.get('task')).toBe('work');
  });

  it('a refused entry, a schema failure and a semantic failure are ignored the same way', () => {
    for (const [entry, failure] of [
      [{ kind: 'refused', failure: 'not a regular file' }, 'not a regular file'],
      [text('version: 1\npermissions: {}\n'), 'unknown key permissions'],
      [text(renderPreset('sw-life-cycle')), 'type service is not declared in memory.yaml'],
    ] as const) {
      const e = effectiveUiConfig(entry, kanban, ROOTS);
      expect(e.status).toEqual({ source: 'ignored', warning: { code: 'ui-config-ignored', failure } });
      expect(e.holds.value.size).toBe(0); // an ignored file holds nothing (spec-005 §4a)
    }
  });

  it('C-04.3 (module level) — one status object, the shape /progress and /traceability carry', () => {
    const e = effectiveUiConfig(text('version: 1\nprogress: { mode: spiral }\n'), kanban, ROOTS);
    expect(Object.keys(e.status).sort()).toEqual(['source', 'warning']);
    expect(Object.keys(e.status.warning!).sort()).toEqual(['code', 'failure']);
  });

  it('the failure quotes the file: local folders redacted, controls escaped (spec-012 §2)', () => {
    const e = effectiveUiConfig(text(`version: 1\nprogress: { mode: "${ROOT}/x‮" }\n`), kanban, ROOTS);
    expect(e.status.warning?.failure).toBe('progress.mode must be sequence or flow (found <project>/x\\u202e)');
  });
});

describe('the parse cache (D54-7)', () => {
  it('parses one content once, whatever the states; another content is parsed again', () => {
    const kanban = sampleMemoryYaml(MATRIX[MATRIX.length - 1]!, 'kanban');
    const cache = new UiYamlCache();
    const a = text('version: 1\n');
    effectiveUiConfig(a, kanban, ROOTS, cache);
    effectiveUiConfig({ ...a }, kanban, ROOTS, cache);
    expect(cache.parses).toBe(1);
    effectiveUiConfig(text('version: 1\nartifacts: []\n'), kanban, ROOTS, cache);
    expect(cache.parses).toBe(2);
    // The semantic checks run against each project: a cached parse still meets the new memory.yaml.
    const sw = text(renderPreset('sw-life-cycle'));
    expect(
      effectiveUiConfig(sw, sampleMemoryYaml(MATRIX[MATRIX.length - 1]!, 'custom'), ROOTS, cache).status.source,
    ).toBe('file');
    expect(effectiveUiConfig(sw, kanban, ROOTS, cache).status.source).toBe('ignored');
    expect(cache.parses).toBe(3);
  });
});
