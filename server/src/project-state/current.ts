/**
 * The current element of `progress.scope` (spec-005 §4, spec-012 §3, RP3-14 D2; task-059 D59-2):
 * the derivation of WingFoil 0.2.2 on every version in v0.3. Among the listed elements of the scope
 * type whose kind is not `first`, `last` or `archived`, the one in the most advanced state — the
 * highest index of its `status` in the type's `sequence`, a state off the sequence below every
 * state of it — ties broken by the lowest `version` in natural order (an element without one
 * after those with one), then by id in natural order. `flow` mode or no scope: none.
 */
import type { MemoryYaml } from '@wingfoil-ui/contracts';
import { ARCHIVED_KIND } from '../presets/descriptor.js';
import { resolveStates } from '../reads/memory-yaml.js';
import type { IndexedElement, ReferenceIndex } from '../references/index.js';
import type { EffectiveUiConfig } from '../ui-config/types.js';
import { naturalCompare } from './order.js';

/** Kinds that are never the current element (spec-005 §4). */
const NOT_CURRENT: ReadonlySet<string> = new Set(['first', 'last', ARCHIVED_KIND]);

/** The scope type that applies: `progress.scope.type` in `sequence` mode, else `null`. */
export function scopeType(ui: EffectiveUiConfig): string | null {
  throw new Error('not implemented (red)');
}

/** The current element of the scope, or `undefined` (none, or no scope applies). */
export function currentElement(
  index: ReferenceIndex,
  memoryYaml: MemoryYaml,
  ui: EffectiveUiConfig,
): IndexedElement | undefined {
  throw new Error('not implemented (red)');
}
