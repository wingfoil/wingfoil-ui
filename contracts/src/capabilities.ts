/**
 * Types of `contracts/matrix.json` (the support matrix, adr-001 D4) and of
 * `contracts/capabilities.json` (the capability table, spec-001 §6), which matches
 * `contracts/capabilities.schema.json`.
 */

/** The support matrix `contracts/matrix.json`. */
export interface SupportMatrix {
  /** Lowest supported version, declared (not the lowest listed); at most every listed version. */
  min: string;
  /** The version the fixtures and this repository pin. */
  pinned: string;
  /** Every contract-tested version. */
  versions: readonly string[];
}

/** One row of the capability table. */
export interface Capability {
  /** Stable kebab-case id (web catalogue key `capability.<id>`). */
  id: string;
  /** English name (README, logs); the UI shows the catalogue message. */
  name: string;
  /** Lowest WingFoil version that provides it, or `null` when no released version does. */
  minVersion: string | null;
  /** How the server provides it at `minVersion`, `null` when it does not yet. */
  via: string | null;
  /** What replaces the current source in a later WingFoil. */
  replacedBy?: string;
  /** Project-condition ids that must all hold for it to apply (none in v0.1). */
  conditions: readonly string[];
}

/** The capability table `contracts/capabilities.json`. */
export interface CapabilityTable {
  capabilities: Capability[];
}
