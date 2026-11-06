// task-068 AC-1 (D68-3; spec-012 §2, §9 K1; spec-004 §5) — `uiConfigBody`, the `/config` `ui`
// section built from the effective configuration: every key with its origin, the declared types
// in `memory.yaml`'s order, and every string echoed from `ui.yaml` (or `memory.yaml`'s type names)
// through the character escape of repository texts; the enum values and the already-redacted
// `failure` passed unchanged.
import { describe, expect, it } from 'vitest';
import { neutralise } from '../../../server/src/git/redact.js';
import { ECHOED_UI_FIELDS, uiConfigBody } from '../../../server/src/ui-config/body.js';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import { effectiveUiConfig } from '../../../server/src/ui-config/effective.js';
import type { EffectiveUiConfig, UiCategory } from '../../../server/src/ui-config/types.js';
import { customPacks, kanban } from './samples.js';

const ROOTS = { project: ['/nowhere/project'], home: null };
const text = (t: string) => ({ kind: 'text' as const, text: t, sha256: t.length.toString(16) });

/** A value holding a bidi control (U+202E), a C1 control (U+0085) and a backslash. */
const hostile = (name: string) => `${name}\u202e\u0085\\`;
/** {@link hostile} as the escape writes it. */
const escaped = (name: string) => `${name}\\u202e\\x85\\\\`;

/** An effective configuration whose every echoed string is {@link hostile}. */
function hostileConfig(): EffectiveUiConfig {
  const t = hostile('t');
  const declared = <T>(value: T) => ({ value, origin: 'declared' as const });
  return {
    status: { source: 'file' },
    categories: declared(new Map<string, UiCategory | null>([[t, 'work']])),
    patterns: declared([{ match: hostile('^m'), category: 'requirement', regex: /x/u }]),
    requires: declared(new Map([[t, ['requirement'] as UiCategory[]]])),
    progress: {
      mode: declared('sequence'),
      scope: declared({ type: t }),
      phases: declared([hostile('ph')]),
      iterates: declared(t),
      defects: declared(t),
    },
    holds: declared(new Map([[t, new Map([[hostile('s'), 'never' as const]])]])),
    artifacts: declared([{ path: hostile('p'), phase: hostile('ph') }]),
  };
}

describe('uiConfigBody — the /config ui section', () => {
  it('no file → status none, every value inferred, the inferred categories in memory.yaml order', () => {
    const body = uiConfigBody(effectiveUiConfig({ kind: 'absent' }, kanban(), ROOTS));
    expect(body.status).toEqual({ source: 'none' });
    expect(body.taxonomy.categories.map((c) => c.type)).toEqual(Object.keys(kanban().types));
    expect(body.taxonomy.categories.find((c) => c.type === 'task')).toEqual({
      type: 'task',
      category: 'work',
      origin: 'inferred',
    });
    expect(body.taxonomy.patterns).toEqual({ value: [], origin: 'inferred' });
    expect(body.taxonomy.requires).toEqual({ value: [], origin: 'inferred' });
    expect(body.progress.mode).toEqual({ value: 'flow', origin: 'inferred' });
    expect(body.progress.scope).toEqual({ value: null, origin: 'inferred', current: null });
    expect(body.progress.iterates).toEqual({ value: 'task', origin: 'inferred' });
    expect(body.holds).toEqual({ value: [], origin: 'inferred' });
    expect(body.artifacts).toEqual({ value: [], origin: 'inferred' });
  });

  it('the sw-life-cycle preset on the custom fixture → every key declared, as spec-005 §5', () => {
    const effective = effectiveUiConfig(text(renderPreset('sw-life-cycle')), customPacks(), ROOTS);
    const body = uiConfigBody(effective);
    expect(body.status).toEqual({ source: 'file' });
    expect(body.taxonomy.categories.every((c) => c.origin === 'declared')).toBe(true);
    expect(body.progress.scope).toEqual({ value: { type: 'release' }, origin: 'declared', current: null });
    expect(body.progress.mode).toEqual({ value: 'sequence', origin: 'declared' });
    // Q4-b (the approver, 2026-11-06): a pattern comes back as written, its backslashes untouched.
    expect(body.taxonomy.patterns.value).toEqual(
      effective.patterns.value.map(({ match, category }) => ({ match, category })),
    );
    expect(body.taxonomy.patterns.value.map((p) => p.match)).toContain('^(P\\d|Journey)');
    expect(body.holds).toEqual({
      value: [
        { type: 'release', state: 'releasing', approve: 'never' },
        { type: 'release-line', state: 'active', approve: 'when-references-done' },
      ],
      origin: 'declared',
    });
    expect(body.artifacts.value).toHaveLength(3);
  });

  it('an ignored file → its warning as the effective configuration redacted it, not escaped twice', () => {
    const effective = effectiveUiConfig(text('version: 1\nprogress: { mode: "a\\\\b" }\n'), kanban(), ROOTS);
    expect(effective.status.warning?.failure).toBe('progress.mode must be sequence or flow (found a\\\\b)');
    const body = uiConfigBody(effective);
    expect(body.status).toEqual(effective.status);
    expect(body.taxonomy.categories.every((c) => c.origin === 'inferred')).toBe(true);
  });

  it('K1: each echoed string with a bidi and a C1 control comes back escaped, the enums unchanged', () => {
    const body = uiConfigBody(hostileConfig());
    const t = escaped('t');
    expect(body.taxonomy.categories).toEqual([{ type: t, category: 'work', origin: 'declared' }]);
    // Q4-b: in a pattern the controls are escaped and the backslash is kept as written (a visible
    // `\u202e` is the same regular expression as the raw character); every other field doubles it.
    expect(body.taxonomy.patterns.value).toEqual([{ match: '^m\\u202e\\x85\\', category: 'requirement' }]);
    expect(body.taxonomy.patterns.value[0]!.match).not.toBe(neutralise(hostile('^m')));
    expect(body.taxonomy.requires.value).toEqual([{ type: t, categories: ['requirement'] }]);
    expect(body.progress.scope.value).toEqual({ type: t });
    expect(body.progress.phases.value).toEqual([escaped('ph')]);
    expect(body.progress.iterates.value).toBe(t);
    expect(body.progress.defects.value).toBe(t);
    expect(body.progress.mode.value).toBe('sequence');
    expect(body.holds.value).toEqual([{ type: t, state: escaped('s'), approve: 'never' }]);
    expect(body.artifacts.value).toEqual([{ path: escaped('p'), phase: escaped('ph') }]);
    // Nothing of the raw controls is left anywhere in the body.
    expect(JSON.stringify(body)).not.toMatch(/[\u202e\u0085]/u);
  });

  it('ECHOED_UI_FIELDS lists every escaped field (the list task-056 sweeps)', () => {
    expect([...ECHOED_UI_FIELDS].sort()).toEqual(
      [
        'artifacts.value[].path',
        'artifacts.value[].phase',
        'holds.value[].state',
        'holds.value[].type',
        'progress.defects.value',
        'progress.iterates.value',
        'progress.phases.value[]',
        'progress.scope.value.type',
        'taxonomy.categories[].type',
        'taxonomy.patterns.value[].match',
        'taxonomy.requires.value[].type',
      ].sort(),
    );
  });

  it('the current element of scope is passed as given (task-059 builds it)', () => {
    const current = { id: 'minor-v0.1', title: 'v0.1', type: 'release', status: 'planning', tone: 'active' as const };
    expect(uiConfigBody(hostileConfig(), current).progress.scope.current).toBe(current);
  });
});
