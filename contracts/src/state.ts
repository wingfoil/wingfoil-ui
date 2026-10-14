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
  /**
   * The UI settings as stored (v0.2; `{}` in v0.1): any key, any value — a missing or invalid key
   * reads as its default ({@link UiSettings}), spec-006 §2.
   */
  settings: Record<string, unknown>;
  /** The action log (REQ-SEC-10, v0.2), oldest first; `[]` in v0.1. */
  actionLog: ActionLogEntry[];
}

/** One entry of the action log (spec-006 §2): a commit of a governed write from the UI. */
export interface ActionLogEntry {
  /** Full commit hash (SHA-1 or SHA-256, lower-case hexadecimal). */
  sha: string;
  /** ISO 8601 UTC time the commit was logged. */
  at: string;
}

/** The theme setting (spec-009 §1). */
export type UiTheme = 'system' | 'light' | 'dark';

/**
 * The UI settings (spec-006 §2, REQ-STATE-09), matching `contracts/api/settings.schema.json`: the
 * body of `GET /api/settings` and of `PUT /api/settings` (the whole object, RP-28).
 */
export interface UiSettings {
  /** Fetch every `fetchIntervalSeconds` (default `true`). */
  autoFetch: boolean;
  /** Interval of the scheduler's ticks, integer 15–3600 (default 60). */
  fetchIntervalSeconds: number;
  /** Fast-forward after a successful automatic fetch (default `false`). */
  autoUpdate: boolean;
  /** Push after each governed write from the UI (default `false`). */
  autoPush: boolean;
  /** Overrides `prefers-color-scheme` (default `system`). */
  theme: UiTheme;
  /** Stored and shown; takes effect from WingFoil 0.3 (default `true`, RP-15). */
  confirmAgentLaunch: boolean;
  /** Most entries kept in the action log, integer 100–100 000 (default 5 000). */
  actionLogCap: number;
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
