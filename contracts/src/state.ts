/**
 * Types of the local state file `state.json` (spec-006 §2), matching
 * `contracts/state/state.schema.json` (checked by `test/contracts/state-schema.test.ts`).
 */

/** One entry of the project list. */
export interface ProjectEntry {
  /** Opaque id: `p_` + 12 lower-case Crockford base32 characters (REQ-SEC-04). */
  id: string;
  /** Absolute realpath of the working directory at add time. */
  path: string;
  /** `dna.project.name`, refreshed on every successful open. */
  name: string;
  /** URL of `origin` without userinfo, or `""` (REQ-SEC-09). */
  remote: string;
  /** ISO 8601 UTC time of the add. */
  addedAt: string;
  /** Last role view chosen for this project; `""` = the shell's default (S-22.3). */
  roleView: string;
}

/** The whole file. */
export interface StateFile {
  /** Format version, `1` for spec-006. */
  version: number;
  /** The project list, in insertion order. */
  projects: ProjectEntry[];
  /** Reserved for the UI settings (v0.2); `{}` in v0.1. */
  settings: Record<string, unknown>;
  /** Reserved for the action log (REQ-SEC-10); `[]` in v0.1. */
  actionLog: unknown[];
}

/**
 * A warning about the local state for the shell, sent by `GET /api/server` as
 * `warnings: [{ key, args }]` (spec-006 §4): `key` is a web-catalogue key (spec-008 §5).
 */
export interface StateWarning {
  /** `state.corruptKept` (args `{ file }`) or `state.newerVersion` (no args). */
  key: 'state.corruptKept' | 'state.newerVersion';
  /** Arguments of the message. */
  args: Record<string, string>;
}
