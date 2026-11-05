// spec-005 §1 (amended 2026-11-05), spec-001 §5, REQ-ARC-07, AC-1, task-054 D54-4 —
// `contracts/files/ui-yaml.schema.json`: the UI's own shape (not a CLI capture), unknown keys an
// error at every level (so `permissions` is refused), the closed values, and the three shipped
// presets accepted.
import { Ajv } from 'ajv';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { renderPreset, UI_PRESET_NAMES } from '../../server/src/presets/ui-config.js';
import { REPO_ROOT } from '../harness/cli.js';

const schema = JSON.parse(
  readFileSync(path.join(REPO_ROOT, 'contracts', 'files', 'ui-yaml.schema.json'), 'utf8'),
) as Record<string, unknown>;
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);
const valid = (data: unknown): boolean => validate(data) as boolean;

describe('contracts/files/ui-yaml.schema.json', () => {
  it('is draft-07 and names the file version, not a WingFoil capture', () => {
    expect(schema['$schema']).toBe('http://json-schema.org/draft-07/schema#');
    expect(schema['$comment']).toBe('ui.yaml version 1');
  });

  it.each(UI_PRESET_NAMES)('accepts the %s preset', (name) => {
    expect(valid(parse(renderPreset(name)))).toBe(true);
  });

  it('accepts the minimal file', () => {
    expect(valid({ version: 1 })).toBe(true);
  });

  it.each<[string, unknown]>([
    ['permissions (REQ-ARC-07)', { version: 1, permissions: { approve: ['approver'] } }],
    ['an unknown category', { version: 1, taxonomy: { categories: { task: 'chore' } } }],
    ['an unknown category in a pattern', { version: 1, taxonomy: { patterns: [{ match: '^a', category: 'chore' }] } }],
    ['an unknown category in requires', { version: 1, taxonomy: { requires: { task: ['chore'] } } }],
    ['an unknown approve value', { version: 1, holds: { release: { releasing: { approve: 'sometimes' } } } }],
    ['progress.scope.id (a type only)', { version: 1, progress: { scope: { type: 'release', id: 'minor-v0.1' } } }],
    ['an unknown key at the top', { version: 1, colours: {} }],
    ['an unknown key in taxonomy', { version: 1, taxonomy: { aliases: {} } }],
    ['an unknown key in progress', { version: 1, progress: { speed: 1 } }],
    [
      'an unknown key in a pattern',
      { version: 1, taxonomy: { patterns: [{ match: '^a', category: 'work', flags: 'i' }] } },
    ],
    ['an unknown key in a hold', { version: 1, holds: { release: { releasing: { approve: 'never', by: 'x' } } } }],
    ['an unknown key in an artifact', { version: 1, artifacts: [{ path: 'a', phase: 'b', kind: 'c' }] }],
    ['no version', {}],
    ['version 2', { version: 2 }],
    ['an unknown mode', { version: 1, progress: { mode: 'spiral' } }],
    [
      '33 patterns',
      { version: 1, taxonomy: { patterns: Array.from({ length: 33 }, () => ({ match: '^a', category: 'work' })) } },
    ],
    [
      'a match of 201 characters',
      { version: 1, taxonomy: { patterns: [{ match: `^${'a'.repeat(200)}`, category: 'work' }] } },
    ],
    ['an absolute artifact path', { version: 1, artifacts: [{ path: '/x', phase: 'release' }] }],
    ['an artifact path with ..', { version: 1, artifacts: [{ path: 'a/../b', phase: 'release' }] }],
    ['an artifact path with an empty segment', { version: 1, artifacts: [{ path: 'a//b', phase: 'release' }] }],
    ['an artifact phase of 101 characters', { version: 1, artifacts: [{ path: 'a', phase: 'p'.repeat(101) }] }],
  ])('rejects %s', (_label, data) => {
    expect(valid(data)).toBe(false);
  });
});
