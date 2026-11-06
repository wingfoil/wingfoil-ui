/**
 * The `ui` section of `GET /api/p/:pid/config` (`contracts/api/ui-config.schema.json`, spec-012
 * §2; task-068): the effective `.wingfoil/ui.yaml` configuration of a repository state, each value
 * with its origin, and the file's status with its warning. Every string echoed from the file (and
 * the type names of `memory.yaml`) arrives with control and bidi characters escaped (spec-012 §9).
 */
import type { Tone } from './descriptor.js';

/** The eight UI categories (spec-005 §1). */
export type UiCategory = 'work' | 'defect' | 'decision' | 'spec' | 'requirement' | 'feature' | 'release' | 'external';

/** Where a value comes from: written in a valid file, inferred, or derived (the current element of `scope`). */
export type UiOrigin = 'declared' | 'inferred' | 'derived';

/** A value and its origin. */
export interface UiValued<T> {
  value: T;
  origin: UiOrigin;
}

/**
 * The file's status: `file` a valid file, `none` no entry at `.wingfoil/ui.yaml`, `ignored` an
 * entry that is not used — with the warning naming its first failure (local folders redacted,
 * controls escaped). With `none` and `ignored` every value is `inferred`.
 */
export interface UiConfigStatus {
  source: 'file' | 'none' | 'ignored';
  warning?: { code: 'ui-config-ignored'; failure: string };
}

/** A reference to an element (spec-012 §2): `shortId` as spec-011 §1, `tone` as spec-003 §7. */
export interface ElementRef {
  id: string;
  shortId?: string;
  title: string;
  type: string;
  status: string;
  tone: Tone;
}

/** The `ui` section of `/config`. */
export interface UiConfig {
  status: UiConfigStatus;
  taxonomy: {
    /** One row per type `memory.yaml` declares, in its order; `null`: no category. */
    categories: { type: string; category: UiCategory | null; origin: UiOrigin }[];
    /** In file order; the first that matches wins. */
    patterns: UiValued<{ match: string; category: UiCategory }[]>;
    requires: UiValued<{ type: string; categories: UiCategory[] }[]>;
  };
  progress: {
    mode: UiValued<'sequence' | 'flow'>;
    /** The scope type; `current` the element derived for it (task-059), `null` until then. */
    scope: UiValued<{ type: string } | null> & { current: ElementRef | null };
    phases: UiValued<string[]>;
    iterates: UiValued<string | null>;
    defects: UiValued<string | null>;
  };
  holds: UiValued<{ type: string; state: string; approve: 'never' | 'when-references-done' }[]>;
  artifacts: UiValued<{ path: string; phase: string }[]>;
}
