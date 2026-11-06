/**
 * The UI's own conventions as data (spec-005 §1, §3, §5; REQ-ARC-05: the only place where type
 * names may appear in code): the eight UI categories, the inference table used without a valid
 * `.wingfoil/ui.yaml`, and the three shipped presets (Kanban, Scrum, WingFoil `sw-life-cycle`),
 * rendered as YAML with no user text in them. The write of a preset is task-060's.
 */
import { stringify } from 'yaml';
import type { UiYaml } from '../ui-config/types.js';

/** The UI categories, in spec-005 §1's order. */
export const UI_CATEGORIES = [
  'work',
  'defect',
  'decision',
  'spec',
  'requirement',
  'feature',
  'release',
  'external',
] as const;

/** A UI category. */
export type UiCategory = (typeof UI_CATEGORIES)[number];

/** The category inferred from a type's name (spec-005 §3); any other type has none. */
export const INFERRED_CATEGORIES: Readonly<Record<string, UiCategory>> = Object.freeze({
  task: 'work',
  bug: 'defect',
  adr: 'decision',
  'decision-log': 'decision',
  'tech-spec': 'spec',
  release: 'release',
  'release-line': 'release',
  service: 'external',
});

/** The shipped presets. */
export const UI_PRESET_NAMES = ['kanban', 'scrum', 'sw-life-cycle'] as const;

/** A shipped preset's name (the `preset` of `POST /api/p/:pid/ui-config/preset`). */
export type UiPresetName = (typeof UI_PRESET_NAMES)[number];

/** A shipped preset. */
export interface UiPreset {
  /** The name shown and written in the commit subject. */
  label: string;
  /** The file's content (deeply frozen). */
  content: UiYaml;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) deepFreeze(v);
    Object.freeze(value);
  }
  return value;
}

/** The categories of the 7 categorised types of WingFoil's Kanban and Scrum templates. */
function templateCategories(): Record<string, UiCategory> {
  return {
    adr: 'decision',
    bug: 'defect',
    'decision-log': 'decision',
    release: 'release',
    'release-line': 'release',
    task: 'work',
    'tech-spec': 'spec',
  };
}

/** The phases of the templates' delivery workflows (`kanban-delivery`, `scrum-delivery`). */
const templatePhases = (): string[] => ['plan', 'build', 'review', 'deliver'];

/** The shipped presets (spec-005 §5): empty lists and maps written out, so every value is declared. */
export const UI_PRESETS: Readonly<Record<UiPresetName, UiPreset>> = deepFreeze({
  kanban: {
    label: 'Kanban',
    content: {
      version: 1,
      taxonomy: { categories: templateCategories(), patterns: [], requires: {} },
      progress: { mode: 'flow', phases: templatePhases(), iterates: 'task', defects: 'bug' },
      holds: {},
      artifacts: [],
    },
  },
  scrum: {
    label: 'Scrum',
    content: {
      version: 1,
      taxonomy: { categories: templateCategories(), patterns: [], requires: {} },
      progress: {
        mode: 'sequence',
        scope: { type: 'release' },
        phases: templatePhases(),
        iterates: 'task',
        defects: 'bug',
      },
      holds: {},
      artifacts: [],
    },
  },
  'sw-life-cycle': {
    label: 'WingFoil sw-life-cycle',
    content: {
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
        // The phases of the packs' `sprint` workflow (spec-005 §5).
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
    },
  },
});

/**
 * The preset as the text of `.wingfoil/ui.yaml`: no alias (`aliasDuplicateObjects: false` — the
 * reader refuses aliases, design probe P6), no tag.
 */
export function renderPreset(name: UiPresetName): string {
  return stringify(UI_PRESETS[name].content, { aliasDuplicateObjects: false });
}

/** The subject of the commit that writes the preset (spec-005 §5): `chore(ui): apply the <label> preset`. */
export function presetCommitSubject(name: UiPresetName): string {
  return `chore(ui): apply the ${UI_PRESETS[name].label} preset`;
}
