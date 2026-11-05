// spec-005 §1 (amended 2026-11-05), AC-1/AC-2, task-054 D54-4/D54-5 — `checkUiYaml`: the schema's
// first failure in the texts of the amended §1 table, then the semantic checks in their order
// (types, states, patterns), the first failure reported as written. C-03.1, C-03.2 at the module
// level (the 422 is task-060's, the toast task-064's).
import { describe, expect, it } from 'vitest';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import { checkUiYaml } from '../../../server/src/ui-config/check.js';
import { parseUiYaml } from '../../../server/src/ui-config/parse.js';
import { customPacks, kanban } from './samples.js';

const failure = (data: unknown, memoryYaml = customPacks()): string | undefined => {
  const checked = checkUiYaml(data, memoryYaml);
  return checked.ok ? undefined : checked.failure;
};

describe('checkUiYaml — the schema (first failure)', () => {
  it.each<[unknown, string]>([
    [null, 'ui.yaml must be a mapping'],
    ['text', 'ui.yaml must be a mapping'],
    [[1], 'ui.yaml must be a mapping'],
    [{}, 'missing required key version'],
    [{ version: 2 }, 'version must be 1 (found 2)'],
    [{ version: '1' }, 'version must be 1 (found 1)'],
    [{ version: 1, permissions: {} }, 'unknown key permissions'],
    [{ version: 1, progress: { mode: 'spiral' } }, 'progress.mode must be sequence or flow (found spiral)'],
    [{ version: 1, progress: { mode: 3 } }, 'progress.mode must be sequence or flow (found 3)'],
    [{ version: 1, progress: { scope: { type: 'release', id: 'minor-v0.1' } } }, 'unknown key progress.scope.id'],
    [{ version: 1, progress: { scope: {} } }, 'missing required key progress.scope.type'],
    [{ version: 1, progress: { phases: 'plan' } }, 'progress.phases must be a list (found plan)'],
    [{ version: 1, progress: { iterates: ['task'] } }, 'progress.iterates must be a string (found a list)'],
    [{ version: 1, taxonomy: [] }, 'taxonomy must be a mapping (found a list)'],
    [{ version: 1, taxonomy: { permissions: {} } }, 'unknown key taxonomy.permissions'],
    [
      { version: 1, taxonomy: { categories: { task: 'chore' } } },
      'taxonomy.categories.task must be one of work, defect, decision, spec, requirement, feature, release, external (found chore)',
    ],
    [
      { version: 1, taxonomy: { patterns: [{ match: '', category: 'work' }] } },
      'taxonomy.patterns[0].match must be 1 to 200 characters',
    ],
    [
      { version: 1, taxonomy: { patterns: [{ match: `^${'a'.repeat(200)}`, category: 'work' }] } },
      'taxonomy.patterns[0].match must be 1 to 200 characters',
    ],
    [{ version: 1, taxonomy: { patterns: [{ match: '^a' }] } }, 'missing required key taxonomy.patterns[0].category'],
    [
      { version: 1, taxonomy: { patterns: Array.from({ length: 33 }, () => ({ match: '^a', category: 'work' })) } },
      'taxonomy.patterns must have at most 32 entries',
    ],
    [
      { version: 1, taxonomy: { requires: { task: ['work', 'chore'] } } },
      'taxonomy.requires.task[1] must be one of work, defect, decision, spec, requirement, feature, release, external (found chore)',
    ],
    [
      { version: 1, holds: { release: { releasing: { approve: 'sometimes' } } } },
      'holds.release.releasing.approve must be never or when-references-done (found sometimes)',
    ],
    [{ version: 1, holds: { release: { releasing: {} } } }, 'missing required key holds.release.releasing.approve'],
    [
      { version: 1, holds: { release: { releasing: { approve: 'never', by: 'x' } } } },
      'unknown key holds.release.releasing.by',
    ],
    [
      { version: 1, artifacts: [{ path: '/etc/passwd', phase: 'release' }] },
      'artifacts[0].path must be a repository path or an https:// URL',
    ],
    [
      { version: 1, artifacts: [{ path: 'a/../../b', phase: 'release' }] },
      'artifacts[0].path must be a repository path or an https:// URL',
    ],
    [
      { version: 1, artifacts: [{ path: 'a\\b', phase: 'release' }] },
      'artifacts[0].path must be a repository path or an https:// URL',
    ],
    [
      { version: 1, artifacts: [{ path: 'http://x', phase: 'release' }] },
      'artifacts[0].path must be a repository path or an https:// URL',
    ],
    [
      { version: 1, artifacts: [{ path: 'https://a b', phase: 'release' }] },
      'artifacts[0].path must be a repository path or an https:// URL',
    ],
    [
      { version: 1, artifacts: [{ path: 'a\u0007', phase: 'release' }] },
      'artifacts[0].path must be a repository path or an https:// URL',
    ],
    [
      { version: 1, artifacts: [{ path: 'x'.repeat(501), phase: 'release' }] },
      'artifacts[0].path must be 1 to 500 characters',
    ],
    [{ version: 1, artifacts: [{ path: 'dist/x', phase: '' }] }, 'artifacts[0].phase must be 1 to 100 characters'],
    [{ version: 1, '<<': {} }, 'unknown key <<'],
  ])('%j → %s', (data, text) => {
    expect(failure(data)).toBe(text);
  });

  it('accepts the admitted artifact paths', () => {
    for (const path of [
      'dist/wingfoil-{version}.tgz',
      'https://www.npmjs.com/package/wingfoil/v/{version}',
      'a..b/c',
      '..x',
      'reports/{release}/e2e.md',
    ]) {
      expect(failure({ version: 1, artifacts: [{ path, phase: 'release' }] }), path).toBeUndefined();
    }
  });

  it('C-03.1 — a Kanban preset without version: "missing required key version"', () => {
    const parsed = parseUiYaml(renderPreset('kanban').replace(/^version: 1\n/m, ''));
    expect(parsed.ok).toBe(true);
    expect(failure(parsed.ok ? parsed.data : undefined, kanban())).toBe('missing required key version');
  });
});

describe('checkUiYaml — the semantic checks, in order', () => {
  it.each<[unknown, string]>([
    [{ version: 1, taxonomy: { categories: { story: 'work' } } }, 'type story is not declared in memory.yaml'],
    [{ version: 1, taxonomy: { requires: { story: ['requirement'] } } }, 'type story is not declared in memory.yaml'],
    [{ version: 1, progress: { scope: { type: 'story' } } }, 'type story is not declared in memory.yaml'],
    [{ version: 1, progress: { iterates: 'story' } }, 'type story is not declared in memory.yaml'],
    [{ version: 1, progress: { defects: 'story' } }, 'type story is not declared in memory.yaml'],
    [{ version: 1, holds: { story: { open: { approve: 'never' } } } }, 'type story is not declared in memory.yaml'],
    [
      { version: 1, holds: { release: { shipped: { approve: 'never' } } } },
      'state shipped is not declared for release',
    ],
    [
      {
        version: 1,
        taxonomy: {
          patterns: [
            { match: '^a', category: 'work' },
            { match: 'b', category: 'work' },
          ],
        },
      },
      'taxonomy.patterns[1].match: must start with ^',
    ],
    [
      { version: 1, taxonomy: { patterns: [{ match: '^(', category: 'work' }] } },
      'taxonomy.patterns[0].match: does not compile: Invalid regular expression: /^(/u: Unterminated group',
    ],
  ])('%j → %s', (data, text) => {
    expect(failure(data)).toBe(text);
  });

  it('reports the first failure in the order of the keys: categories, requires, scope, iterates, defects, holds, patterns', () => {
    const all = {
      version: 1,
      taxonomy: {
        categories: { a1: 'work' },
        requires: { a2: ['work'] },
        patterns: [{ match: 'x', category: 'work' }],
      },
      progress: { scope: { type: 'a3' }, iterates: 'a4', defects: 'a5' },
      holds: { a6: { s: { approve: 'never' } }, release: { s7: { approve: 'never' } } },
    };
    expect(failure(all)).toBe('type a1 is not declared in memory.yaml');
    delete (all.taxonomy.categories as Record<string, string>)['a1'];
    expect(failure(all)).toBe('type a2 is not declared in memory.yaml');
    delete (all.taxonomy.requires as Record<string, string[]>)['a2'];
    expect(failure(all)).toBe('type a3 is not declared in memory.yaml');
    all.progress.scope.type = 'release';
    expect(failure(all)).toBe('type a4 is not declared in memory.yaml');
    all.progress.iterates = 'task';
    expect(failure(all)).toBe('type a5 is not declared in memory.yaml');
    all.progress.defects = 'bug';
    expect(failure(all)).toBe('type a6 is not declared in memory.yaml');
    delete (all.holds as Record<string, unknown>)['a6'];
    expect(failure(all)).toBe('state s7 is not declared for release');
    all.holds.release = { releasing: { approve: 'never' } } as never;
    expect(failure(all)).toBe('taxonomy.patterns[0].match: must start with ^');
    all.taxonomy.patterns[0]!.match = '^x';
    expect(checkUiYaml(all, customPacks())).toMatchObject({ ok: true, value: all });
  });

  it('a hold on a declared state that is not a gate passes (it has no effect, spec-005 §1 check 2)', () => {
    expect(failure({ version: 1, holds: { task: { done: { approve: 'never' } } } })).toBeUndefined();
    expect(failure({ version: 1, holds: { task: { deprecated: { approve: 'never' } } } })).toBeUndefined();
  });

  it('C-03.2 — the sw-life-cycle preset on the kanban fixture: "type service is not declared in memory.yaml"', () => {
    const parsed = parseUiYaml(renderPreset('sw-life-cycle'));
    expect(failure(parsed.ok ? parsed.data : undefined, kanban())).toBe('type service is not declared in memory.yaml');
  });

  it('S-24.5, S-24.6 — the holds of the sw-life-cycle preset are parsed and pass on the custom fixture', () => {
    const parsed = parseUiYaml(renderPreset('sw-life-cycle'));
    const checked = checkUiYaml(parsed.ok ? parsed.data : undefined, customPacks());
    expect(checked.ok && checked.value.holds).toEqual({
      release: { releasing: { approve: 'never' } },
      'release-line': { active: { approve: 'when-references-done' } },
    });
  });
});
