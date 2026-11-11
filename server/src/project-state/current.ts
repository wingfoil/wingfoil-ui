/**
 * The current element of `progress.scope` (spec-005 §4, spec-012 §3, RP3-14 D2; task-059 D59-2):
 * the derivation of WingFoil 0.2.2 on every version in v0.3. Among the listed elements of the scope
 * type whose kind is not `first`, `last` or `archived`, the one in the most advanced state — the
 * highest index of its `status` in the type's `sequence`, a state off the sequence below every
 * state of it — ties broken by the lowest `version` in natural order (an element without one
 * after those with one — an empty one is none), then by id in natural order. `flow` mode or no scope: none.
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
  return ui.progress.mode.value === 'sequence' ? (ui.progress.scope.value?.type ?? null) : null;
}

/** The current element of the scope, or `undefined` (none, or no scope applies). */
export function currentElement(
  index: ReferenceIndex,
  memoryYaml: MemoryYaml,
  ui: EffectiveUiConfig,
): IndexedElement | undefined {
  const type = scopeType(ui);
  if (type === null) return undefined;
  const sequence = resolveStates(memoryYaml, type)?.sequence ?? [];
  const rank = (e: IndexedElement): number => sequence.indexOf(e.status);
  const candidates = index.elements.filter((e) => e.type === type && !NOT_CURRENT.has(e.kind));
  // An empty `version` is no version (review round 1 F-2), as in the scope rule of the index.
  const version = (e: IndexedElement): string | undefined => e.version || undefined;
  candidates.sort((a, b) => {
    const r = rank(b) - rank(a);
    if (r !== 0) return r;
    const [x, y] = [version(a), version(b)];
    if (x !== undefined && y !== undefined) {
      const v = naturalCompare(x, y);
      if (v !== 0) return v;
    } else if (x !== y) {
      return x === undefined ? 1 : -1;
    }
    return naturalCompare(a.id, b.id);
  });
  return candidates[0];
}
