/**
 * The types of `.wingfoil/ui.yaml` (spec-005 §1) and of the effective configuration the server
 * derives from it on each repository state (spec-005 §2–§3, task-054 D54-1). These are the server's
 * internal shapes, consumed by the reference index and the descriptor's holds (task-055), the
 * `/config` section (the split task of task-054), the progress and traceability routes (task-059)
 * and the preset write (task-060); the API shapes live in `contracts/`.
 */
import type { HoldCondition as ContractHoldCondition, UiConfigStatus } from '@wingfoil-ui/contracts';
import type { UiCategory } from '../presets/ui-config.js';

export type { UiCategory } from '../presets/ui-config.js';

/** `progress.mode`. */
export type ProgressMode = 'sequence' | 'flow';

/** `holds.<type>.<state>.approve` (spec-005 §4a): the descriptor's `approveHeld.condition`. */
export type HoldCondition = ContractHoldCondition;

/** A `taxonomy.patterns` entry. */
export interface UiPatternEntry {
  match: string;
  category: UiCategory;
}

/** A valid `ui.yaml` (it passed the schema and the semantic checks). */
export interface UiYaml {
  version: 1;
  taxonomy?: {
    categories?: Record<string, UiCategory>;
    patterns?: UiPatternEntry[];
    requires?: Record<string, UiCategory[]>;
  };
  progress?: {
    mode?: ProgressMode;
    scope?: { type: string };
    phases?: string[];
    iterates?: string;
    defects?: string;
  };
  holds?: Record<string, Record<string, { approve: HoldCondition }>>;
  artifacts?: { path: string; phase: string }[];
}

/**
 * Where the effective `ui.yaml` comes from (spec-012 §2 `status`): `file` a valid file, `none` no
 * entry at `.wingfoil/ui.yaml`, `ignored` an entry that is not used — with the warning, whose
 * `failure` has already passed the sanitiser of tool messages (`redactLocalPaths`). The API type,
 * shared as is by `/config`, `/progress` and `/traceability` (task-068).
 */
export type { UiConfigStatus } from '@wingfoil-ui/contracts';
/** A value and its origin: written in a valid file, or inferred (spec-005 §2). */
export interface Valued<T> {
  value: T;
  origin: 'declared' | 'inferred';
}

/** A pattern of the effective configuration, compiled with the `u` flag. */
export interface UiPattern extends UiPatternEntry {
  regex: RegExp;
}

/**
 * The effective configuration of one repository state (spec-005 §2–§3): raw values (never
 * escaped — the API serialiser escapes what it echoes, spec-012 §9) with their origins. With no or
 * an ignored file every value is `inferred`; an ignored file holds nothing.
 */
export interface EffectiveUiConfig {
  status: UiConfigStatus;
  /** Every type `memory.yaml` declares, in its order → its category or `null` (no category). */
  categories: Valued<ReadonlyMap<string, UiCategory | null>>;
  /** In file order; the first that matches wins (spec-012 §1 rule 2). */
  patterns: Valued<readonly UiPattern[]>;
  requires: Valued<ReadonlyMap<string, readonly UiCategory[]>>;
  progress: {
    mode: Valued<ProgressMode>;
    /** A type only; the current element is derived (task-059). */
    scope: Valued<{ type: string } | null>;
    phases: Valued<readonly string[]>;
    iterates: Valued<string | null>;
    defects: Valued<string | null>;
  };
  /** Type → state → condition, as written; a state that is not a gate of its type has no effect. */
  holds: Valued<ReadonlyMap<string, ReadonlyMap<string, HoldCondition>>>;
  artifacts: Valued<readonly { path: string; phase: string }[]>;
}
