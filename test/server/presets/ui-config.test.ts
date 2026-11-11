// spec-005 §3, §5, AC-4/AC-6, task-054 D54-8 — the UI vocabulary, the inference table and the
// three presets as data: their exact contents, a rendering the reader accepts (no alias, no tag:
// design probe P6), and each passing the checks on its own template's `memory.yaml` on every matrix
// version; the sw-life-cycle preset refused on kanban. C-02.1, C-02.3, C-02.5 at the module level:
// the contents the write (task-060) commits.
import { describe, expect, it } from 'vitest';
import {
  INFERRED_CATEGORIES,
  PRESET_COMMIT_SUBJECTS,
  presetCommitSubject,
  renderPreset,
  UI_CATEGORIES,
  UI_PRESET_NAMES,
  UI_PRESETS,
} from '../../../server/src/presets/ui-config.js';
import { checkUiYaml } from '../../../server/src/ui-config/check.js';
import { parseUiYaml } from '../../../server/src/ui-config/parse.js';
import { MATRIX, sampleMemoryYaml } from '../ui-config/samples.js';

const KANBAN_CATEGORIES = {
  adr: 'decision',
  bug: 'defect',
  'decision-log': 'decision',
  release: 'release',
  'release-line': 'release',
  task: 'work',
  'tech-spec': 'spec',
};
const PHASES = ['plan', 'build', 'review', 'deliver'];

describe('the vocabulary and the inference table (spec-005 §1, §3)', () => {
  it('the 8 UI categories, in the spec order', () => {
    expect(UI_CATEGORIES).toEqual([
      'work',
      'defect',
      'decision',
      'spec',
      'requirement',
      'feature',
      'release',
      'external',
    ]);
  });

  it('infers by type name', () => {
    expect(INFERRED_CATEGORIES).toEqual({
      task: 'work',
      bug: 'defect',
      adr: 'decision',
      'decision-log': 'decision',
      'tech-spec': 'spec',
      release: 'release',
      'release-line': 'release',
      service: 'external',
    });
  });
});

describe('the presets (spec-005 §5)', () => {
  it('names and labels', () => {
    expect(UI_PRESET_NAMES).toEqual(['kanban', 'scrum', 'sw-life-cycle']);
    expect(UI_PRESET_NAMES.map((n) => UI_PRESETS[n].label)).toEqual(['Kanban', 'Scrum', 'WingFoil sw-life-cycle']);
    expect(presetCommitSubject('kanban')).toBe('chore(ui): apply the Kanban preset');
    expect(presetCommitSubject('sw-life-cycle')).toBe('chore(ui): apply the WingFoil sw-life-cycle preset');
  });

  it('C-02.1 (module level) — Kanban: the 7 categorised template types, empty lists and maps written out (every value declared), flow', () => {
    expect(UI_PRESETS.kanban.content).toEqual({
      version: 1,
      taxonomy: { categories: KANBAN_CATEGORIES, patterns: [], requires: {} },
      progress: { mode: 'flow', phases: PHASES, iterates: 'task', defects: 'bug' },
      holds: {},
      artifacts: [],
    });
  });

  it('Scrum: as Kanban, in sequence mode with the release scope', () => {
    expect(UI_PRESETS.scrum.content).toEqual({
      version: 1,
      taxonomy: { categories: KANBAN_CATEGORIES, patterns: [], requires: {} },
      progress: { mode: 'sequence', scope: { type: 'release' }, phases: PHASES, iterates: 'task', defects: 'bug' },
      holds: {},
      artifacts: [],
    });
  });

  it('WingFoil sw-life-cycle: ux-reference §6 with the packs’ sprint phases, artifacts at release, the two holds', () => {
    expect(UI_PRESETS['sw-life-cycle'].content).toEqual({
      version: 1,
      taxonomy: {
        categories: {
          task: 'work',
          bug: 'defect',
          adr: 'decision',
          'decision-log': 'decision',
          'tech-spec': 'spec',
          release: 'release',
          service: 'external',
        },
        patterns: [
          { match: '^(REQ|US)-', category: 'requirement' },
          { match: '^(P\\d|Journey)', category: 'feature' },
          { match: '^(minor|patch)-v|^rl-', category: 'release' },
        ],
        requires: { task: ['requirement'], adr: ['requirement'], 'tech-spec': ['requirement'] },
      },
      progress: {
        mode: 'sequence',
        scope: { type: 'release' },
        phases: [
          'sprint-planning',
          'development',
          'plan-release',
          'release',
          'sprint-review',
          'retrospective',
          'close',
        ],
        iterates: 'task',
        defects: 'bug',
      },
      holds: {
        release: { releasing: { approve: 'never' } },
        'release-line': { active: { approve: 'when-references-done' } },
      },
      artifacts: [
        { path: 'dist/wingfoil-{version}.tgz', phase: 'release' },
        { path: 'https://www.npmjs.com/package/wingfoil/v/{version}', phase: 'release' },
        { path: 'reports/{release}/e2e-smoke.md', phase: 'release' },
      ],
    });
  });

  it.each(UI_PRESET_NAMES)(
    'C-02.1, C-02.3, C-02.5 (module level) — %s renders to YAML the reader accepts, equal to its content (no alias, no tag)',
    (name) => {
      const text = renderPreset(name);
      expect(text).not.toMatch(/[&*!][a-z0-9]/);
      expect(parseUiYaml(text)).toEqual({ ok: true, data: UI_PRESETS[name].content });
    },
  );

  it('the presets are not shared objects: a change to one rendering leaves the others', () => {
    const a = UI_PRESETS.kanban.content.progress!.phases;
    const b = UI_PRESETS.scrum.content.progress!.phases;
    expect(a).not.toBe(b);
    expect(Object.isFrozen(UI_PRESETS.kanban.content)).toBe(true);
  });

  describe.each(MATRIX)('on WingFoil %s', (version) => {
    const check = (name: (typeof UI_PRESET_NAMES)[number], kind: 'kanban' | 'custom') => {
      const parsed = parseUiYaml(renderPreset(name));
      return checkUiYaml(parsed.ok ? parsed.data : undefined, sampleMemoryYaml(version, kind));
    };
    it('Kanban passes on the kanban template', () => {
      expect(check('kanban', 'kanban')).toMatchObject({ ok: true });
    });
    it('Scrum passes on the kanban template (the Scrum template declares the same types and states)', () => {
      expect(check('scrum', 'kanban')).toMatchObject({ ok: true });
    });
    it('WingFoil sw-life-cycle passes on the custom fixture and is refused on kanban (service)', () => {
      expect(check('sw-life-cycle', 'custom')).toMatchObject({ ok: true });
      expect(check('sw-life-cycle', 'kanban')).toEqual({
        ok: false,
        failure: 'type service is not declared in memory.yaml',
      });
    });
  });
});

describe('the preset write’s subjects and table (task-060 D60-12, D60-13)', () => {
  it('PRESET_COMMIT_SUBJECTS: the three subjects, in UI_PRESET_NAMES order', () => {
    expect(PRESET_COMMIT_SUBJECTS).toEqual([
      'chore(ui): apply the Kanban preset',
      'chore(ui): apply the Scrum preset',
      'chore(ui): apply the WingFoil sw-life-cycle preset',
    ]);
    expect(Object.isFrozen(PRESET_COMMIT_SUBJECTS)).toBe(true);
  });

  it('renderPreset and presetCommitSubject read another table when given one', () => {
    const presets = { ...UI_PRESETS, kanban: { label: 'Other', content: { version: 1 } as never } };
    expect(renderPreset('kanban', presets)).toBe('version: 1\n');
    expect(presetCommitSubject('kanban', presets)).toBe('chore(ui): apply the Other preset');
    expect(renderPreset('scrum', presets)).toBe(renderPreset('scrum'));
  });
});
