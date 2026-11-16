/**
 * What *Use preset* is on Configuration › Taxonomy (task-079, AC-1; spec-005 §5; D79-2, D79-4; Q5 (a) of
 * W3-1): decided in the page from what the server already told it — the project header and the `ui`
 * section of `/config` — and re-checked by the server under its write lock (task-060).
 *
 * - **hidden** until both are read, without a `ui` section (`memory.yaml` unreadable: the write would
 *   answer `read-error`), when `.wingfoil/ui.yaml` exists (`source` `file` or `ignored`, C-02.3), or for
 *   a user not identified as one member (C-02.5; also after a failed `dna show`);
 * - **disabled** with the first reason of spec-003 §6 that holds — the WingFoil version out of range,
 *   then the copy behind (with the count), diverged or detached (the server's `blocksWrites`) — built
 *   as the descriptor's own `DisabledReason`, so the element footer's texts render it (C-02.4);
 * - **enabled** otherwise. The page never validates a preset (C-03.2 is the server's 422).
 */
import type { DisabledReason, ProjectHeader, UiConfig, UiPresetId } from '@wingfoil-ui/contracts';

/**
 * The shipped presets, in the order of the request schema's enum and of the server's table
 * (`@wingfoil-ui/contracts` exports types only; a unit test keeps the three equal, D79-4, Q1 (a)).
 */
export const PRESET_IDS = ['kanban', 'scrum', 'sw-life-cycle'] as const satisfies readonly UiPresetId[];

// Every preset id of the contract is listed (a compile-time check).
type Missing = Exclude<UiPresetId, (typeof PRESET_IDS)[number]>;
const everyPreset: [Missing] extends [never] ? true : never = true;
void everyPreset;

/** What *Use preset* is. */
export type PresetControl = { kind: 'hidden' } | { kind: 'disabled'; reason: DisabledReason } | { kind: 'enabled' };

/** The control for the project `header` and the served `ui` section (either not read yet: `undefined`). */
export function presetControl(header: ProjectHeader | undefined, ui: UiConfig | undefined): PresetControl {
  if (header === undefined || ui === undefined) return { kind: 'hidden' };
  if (ui.status.source !== 'none') return { kind: 'hidden' };
  if (header.identity.kind !== 'member' || header.dnaError !== undefined) return { kind: 'hidden' };
  const version = header.readOnly.find((r) => r.code === 'version-unsupported');
  if (version) return { kind: 'disabled', reason: version };
  switch (header.repository.copy) {
    case 'behind':
      return { kind: 'disabled', reason: { code: 'copy-behind', commits: header.repository.behind } };
    case 'diverged':
      return { kind: 'disabled', reason: { code: 'copy-diverged' } };
    case 'detached':
      return { kind: 'disabled', reason: { code: 'copy-detached' } };
    default:
      return { kind: 'enabled' };
  }
}
