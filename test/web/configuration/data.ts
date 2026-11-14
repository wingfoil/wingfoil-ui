/**
 * Fake `/config` answers of the Configuration tabs' component tests (task-064): the `ui` section of
 * spec-012 §2 inferred (no file), declared (a valid file) and ignored (a failure), and the page's
 * common answers. The names are the fixtures' (`test/` is outside the REQ-ARC-05 lint).
 */
import type { MemoryYaml, ProjectConfig, UiConfig } from '@wingfoil-ui/contracts';
import { BASE, BO, header, projectApi } from '../dna/data.js';
import type { FakeApi } from '../shell/render.js';

const failed = { error: { code: 'internal', message: 'x' } };

/** No `.wingfoil/ui.yaml`: every value inferred (spec-005 §3). */
export const UI_INFERRED: UiConfig = {
  status: { source: 'none' },
  taxonomy: {
    categories: [
      { type: 'task', category: 'work', origin: 'inferred' },
      { type: 'bug', category: 'defect', origin: 'inferred' },
      { type: 'story', category: null, origin: 'inferred' },
    ],
    patterns: { value: [], origin: 'inferred' },
    requires: { value: [], origin: 'inferred' },
  },
  progress: {
    mode: { value: 'flow', origin: 'inferred' },
    scope: { value: null, origin: 'inferred', current: null },
    phases: { value: [], origin: 'inferred' },
    iterates: { value: 'task', origin: 'inferred' },
    defects: { value: null, origin: 'inferred' },
  },
  holds: { value: [], origin: 'inferred' },
  artifacts: { value: [], origin: 'inferred' },
};

/** A valid file (the sw-life-cycle preset's shape, shortened). */
export const UI_DECLARED: UiConfig = {
  status: { source: 'file' },
  taxonomy: {
    categories: [
      { type: 'task', category: 'work', origin: 'declared' },
      { type: 'release', category: 'release', origin: 'declared' },
      { type: 'plan', category: null, origin: 'declared' },
    ],
    patterns: {
      value: [
        { match: '^(REQ|US)-', category: 'requirement' },
        { match: '^(P\\d|Journey)', category: 'feature' },
        { match: '^x\\u202e', category: 'feature' },
      ],
      origin: 'declared',
    },
    requires: { value: [{ type: 'task', categories: ['requirement', 'feature'] }], origin: 'declared' },
  },
  progress: {
    mode: { value: 'sequence', origin: 'declared' },
    scope: {
      value: { type: 'release' },
      origin: 'declared',
      current: { id: 'minor-v0.1', title: 'First release', type: 'release', status: 'in-progress', tone: 'active' },
    },
    phases: { value: ['plan', 'build', 'release'], origin: 'declared' },
    iterates: { value: 'task', origin: 'declared' },
    defects: { value: 'bug', origin: 'declared' },
  },
  holds: {
    value: [
      { type: 'release', state: 'releasing', approve: 'never' },
      { type: 'release-line', state: 'active', approve: 'when-references-done' },
    ],
    origin: 'declared',
  },
  artifacts: { value: [], origin: 'declared' },
};

/** An ignored file: the warning and every value inferred. */
export const UI_IGNORED: UiConfig = {
  ...UI_INFERRED,
  status: {
    source: 'ignored',
    warning: {
      code: 'ui-config-ignored',
      failure: 'Nested mappings are not allowed in compact mappings (line 3, column 7)',
    },
  },
};

const TYPES: MemoryYaml = { version: 1, types: {} } as unknown as MemoryYaml;

/** `GET /config` with `ui` (absent: `memory.yaml` unreadable, `types` failing). */
export function uiConfig(ui: UiConfig | undefined): ProjectConfig {
  return ui === undefined
    ? {
        dna: failed,
        paths: failed,
        workflows: failed,
        types: {
          error: {
            code: 'read-error',
            message: 'Cannot read',
            detail: { file: '.wingfoil/memory.yaml', kind: 'missing' },
          },
        },
      }
    : { dna: failed, paths: failed, workflows: failed, types: { data: TYPES }, ui };
}

/** The answers of a project page whose `/config` carries `ui`. */
export function uiApi(ui: UiConfig | undefined, over: FakeApi = {}): FakeApi {
  return projectApi({
    [BASE]: { status: 200, body: header(BO, 'r-dev') },
    [`${BASE}/config`]: { status: 200, body: uiConfig(ui) },
    ...over,
  });
}
