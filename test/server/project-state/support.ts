// The custom fixture's elements as the reference index sees them (probe P1 of task-059's design:
// the custom fixture with the sw-life-cycle preset, pinned CLI), for the unit tests of
// `server/src/project-state/`: the matches, the values of each file and the effective
// configuration of the preset, with helpers to vary them.
import type { MemoryMatch, MemoryYaml } from '@wingfoil-ui/contracts';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import { DirectReadError } from '../../../server/src/reads/confine.js';
import { buildReferenceIndex, PatternMemo } from '../../../server/src/references/build.js';
import type { FileValues, ReferenceIndex } from '../../../server/src/references/index.js';
import { effectiveUiConfig } from '../../../server/src/ui-config/effective.js';
import type { EffectiveUiConfig } from '../../../server/src/ui-config/types.js';
import { customPacks } from '../ui-config/samples.js';

/** One element of the table: its match fields and its values (`unreadable`: the read fails). */
export interface Row {
  id: string;
  type: string;
  status: string;
  title?: string;
  values?: string[];
  version?: string | undefined;
  unreadable?: boolean;
  capped?: boolean;
}

/** The custom fixture (P1): ids, types, states and the values of each file. */
export const CUSTOM: readonly Row[] = [
  { id: 'adr-001-local-server', type: 'adr', status: 'draft', values: [''] },
  { id: 'bug-001-toast-overlap', type: 'bug', status: 'open', values: ['medium', ''] },
  { id: 'dl-001-initialise-wingfoil-before-inception', type: 'decision-log', status: 'ready', values: [''] },
  { id: 'dl-002-use-fastify', type: 'decision-log', status: 'in-discussion', values: [''] },
  {
    id: 'minor-v0.1',
    type: 'release',
    status: 'planning',
    title: 'Minor v0.1',
    values: ['minor', '', 'v0.1', 'S', 'S1', 'M1', 'docs/03_backlog/04_backlog/by-release/v0.1.json', 'v1'],
    version: 'v0.1',
  },
  { id: 'task-001-cli-adapter', type: 'task', status: 'in-review', values: ['v0.1', 'n/a', '', 'US-S-01'] },
  { id: 'task-002-memory-list', type: 'task', status: 'done', values: ['v0.1', 'n/a', '', 'US-M-01'] },
  { id: 'task-003-element-panel', type: 'task', status: 'backlog', values: ['v0.1', 'n/a', '', 'US-M-01'] },
  { id: 'task-004-themes', type: 'task', status: 'backlog', values: ['v0.1', 'n/a', ''] },
];

/** The rows of `rows` as `memory search` matches. */
export const matchesOf = (rows: readonly Row[]): MemoryMatch[] =>
  rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    title: r.title ?? r.id,
    path: `docs/${r.id}.md`,
    tags: [],
  }));

/** The effective configuration of `text` (default: the sw-life-cycle preset), none for `null`. */
export function uiOf(
  text: string | null = renderPreset('sw-life-cycle'),
  memoryYaml: MemoryYaml = customPacks(),
): EffectiveUiConfig {
  const entry =
    text === null ? ({ kind: 'absent' } as const) : ({ kind: 'text', text, sha256: String(text.length) } as const);
  return effectiveUiConfig(entry, memoryYaml, { home: null });
}

/** The index of `rows` under `ui`. */
export function indexOf(
  rows: readonly Row[],
  ui: EffectiveUiConfig = uiOf(),
  memoryYaml: MemoryYaml = customPacks(),
): Promise<ReferenceIndex> {
  const byId = new Map(rows.map((r) => [r.id, r]));
  return buildReferenceIndex({
    matches: matchesOf(rows),
    memoryYaml,
    categories: ui.categories.value,
    patterns: ui.patterns.value,
    memo: new PatternMemo(),
    source: {
      values: (m) => {
        const r = byId.get(m.id)!;
        if (r.unreadable) return Promise.reject(new DirectReadError('shape', m.path, 'x'));
        const file: FileValues = {
          values: r.values ?? [],
          capped: r.capped ?? false,
          ...(r.version !== undefined ? { version: r.version } : {}),
        };
        return Promise.resolve(file);
      },
    },
  });
}

/** `rows` with the row `id` changed by `patch` (or added when absent). */
export function withRow(rows: readonly Row[], id: string, patch: Partial<Row>): Row[] {
  const found = rows.some((r) => r.id === id);
  if (!found) return [...rows, { id, type: 'task', status: 'draft', ...patch }];
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}
