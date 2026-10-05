/**
 * Types of the consumed WingFoil CLI output (spec-001 §3), matching `contracts/cli/*.schema.json`
 * (captured from wingfoil 0.2.2). Only the fields the UI reads are declared; a newer CLI may add
 * others.
 */

/** A member of `dna.team.members`. */
export interface DnaMember {
  name: string;
  /** Optional in WingFoil 0.2.2. */
  email?: string;
  roles: string[];
}

/** A role of `dna.team.roles`. */
export interface DnaRole {
  name: string;
  description?: string;
}

/** An agent of `dna.team.agents`. */
export interface DnaAgent {
  name: string;
  executes_as: string[];
  /** Optional in WingFoil 0.2.2. */
  approval_authority?: boolean;
}

/** A module of `dna.modules`. */
export interface DnaModule {
  name: string;
  description?: string;
  /** Folder of the module, e.g. `server/`. */
  path?: string;
}

/** A technology of `dna.stacks.technologies`. */
export interface DnaTechnology {
  name: string;
  category?: string;
  version?: string;
  notes?: string;
}

/** A methodology of `dna.stacks.methodologies`. */
export interface DnaMethodology {
  name: string;
  /** Life-cycle phase it applies to, e.g. `delivery`. */
  phase?: string;
}

/** Path categories: `{<category>: string[]}` (`wingfoil paths`, `dna.paths`). */
export type DnaPaths = Record<string, string[]>;

/**
 * `wingfoil dna show`: the whole `dna.yaml`. As in WingFoil 0.2.2's `dist/dna/schema.js`, the
 * project, each of its fields and both stack lists are optional: a consumer shows their absence.
 */
export interface DnaShow {
  version: number;
  project?: { name?: string; description?: string; methodology?: string };
  modules: DnaModule[];
  stacks: { technologies?: DnaTechnology[]; methodologies?: DnaMethodology[] };
  team: { members: DnaMember[]; roles: DnaRole[]; agents?: DnaAgent[] };
  paths: DnaPaths;
}

/** Frontmatter of a directive (`directives list`, and the directive file, spec-001 §4.3). */
export interface DirectiveFrontmatter {
  id: string;
  name: string;
  type: string;
  kind: string;
  title: string;
  /** Absent when the file declares none. */
  tags?: string[];
  ref?: string[];
}

/** One entry of `wingfoil directives list`. */
export interface DirectiveEntry {
  /** Path relative to `.wingfoil/`, e.g. `directives/custom/determinism.md`. */
  path: string;
  frontmatter: DirectiveFrontmatter;
  /** Roles the directive is bound to in `roles.yaml`. */
  roles: string[];
  global: boolean;
  /** Human-readable binding, e.g. `developer, qa` or `global (all roles)`. */
  assignment: string;
}

/** `wingfoil directives list`. */
export interface DirectivesList {
  entries: DirectiveEntry[];
  /** E.g. a directive id defined by two files, and which one is in force. */
  warnings: string[];
}

/** One phase of a workflow (`workflow list`). */
export interface WorkflowPhase {
  name: string;
  description?: string;
  role?: string;
  optional: boolean;
  actions?: string[];
  produces?: string[];
  checks?: { pre?: unknown[]; post?: unknown[] };
  approval?: { by_role: string };
  fallback?: { step?: string; set_state?: string };
  include?: string;
  iterate_over?: string;
  where?: Record<string, unknown>;
}

/** One workflow (`workflow list`). */
export interface Workflow {
  name: string;
  /** `main` or `sub`. */
  kind: string;
  /** Optional in WingFoil 0.2.2. */
  description?: string;
  /** A number (`1`, `1.4`); absent in the Kanban and Scrum template workflows. */
  version?: number;
  /** Element type the workflow iterates over. */
  element?: string;
  phases: WorkflowPhase[];
}

/** `wingfoil workflow list`. */
export interface WorkflowList {
  /** `version` is optional in WingFoil 0.2.2. */
  manifest: { version?: number; include: string[] };
  workflows: Workflow[];
}

/** One element of `memory search`. */
export interface MemoryMatch {
  /** Path relative to the project root. */
  path: string;
  id: string;
  title: string;
  type: string;
  status: string;
  tags: string[];
}

/** `wingfoil memory search` (archived elements only with `--status`, W-19). */
export interface MemorySearch {
  query: string;
  matches: MemoryMatch[];
  /** Present when `matches` is empty. */
  message?: string;
}

/** Operation of a history entry; `null` for a commit that is not a WingFoil verb. */
export type HistoryOperation = 'add' | 'submit' | 'approve' | 'reject' | 'deprecate' | null;

/** One entry of `memory history`. */
export interface HistoryEntry {
  sha: string;
  /** `Name <email>`. */
  author: string;
  /** ISO 8601 with offset. */
  timestamp: string;
  operation: HistoryOperation;
  from: string | null;
  to: string | null;
  /** `Name <email> (role)`. */
  approver: string | null;
  reason: string | null;
  subject: string;
}

/** `wingfoil memory history <id>`. */
export interface MemoryHistory {
  id: string;
  path: string;
  entries: HistoryEntry[];
}

/** `wingfoil memory submit <id>` and `memory approve <id>`. */
export interface MemoryTransition {
  id: string;
  path: string;
  from: string;
  to: string;
}

/** `wingfoil memory reject <id>`. */
export interface MemoryRejection extends MemoryTransition {
  reason: string;
}

/** `wingfoil memory add`. */
export interface MemoryAdded {
  id: string;
  path: string;
}
