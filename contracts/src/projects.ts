/**
 * Types of the project-list bodies (spec-004 §3, spec-006 §2–§3), matching the schemas of
 * `contracts/api/` (`projects.item.schema.json`, `projects.*.schema.json`; checked by
 * `test/contracts/api-projects-schema.test.ts`).
 */

/**
 * Whether a listed project can be opened, computed on every read of the list (spec-006 §2):
 * `folder-not-found` (S-19.1), `not-wingfoil` (`.wingfoil/` removed since the add) or
 * `cli-not-found` (S-10.2).
 */
export type Availability = 'ok' | 'folder-not-found' | 'not-wingfoil' | 'cli-not-found';

/** One entry of `GET /api/projects`; also the answer of a successful add or clone (201). */
export interface ProjectListItem {
  /** Opaque project id (REQ-SEC-04). */
  id: string;
  /** `dna.project.name` read at add time, else the folder's base name. */
  name: string;
  /** Realpath of the working directory at add time. */
  path: string;
  /** URL of `origin` without userinfo, or `""`. */
  remote: string;
  availability: Availability;
  /** The install command, with `cli-not-found` only. */
  command?: string;
}

/**
 * The `code` of a refused add or clone (422, spec-006 §3; `contracts/api/projects.refusal.schema.json`).
 * `directory-inside-project` and `inside-state-dir` refuse a clone target inside a listed project or
 * the local state directory (decided by the user 2026-10-06).
 */
export type ProjectRefusalCode =
  | 'folder-not-found'
  | 'not-wingfoil'
  | 'already-listed'
  | 'directory-not-empty'
  | 'directory-inside-project'
  | 'inside-state-dir'
  | 'cli-not-found'
  | 'state-dir-inside-project'
  | 'git-refused';

/** The envelope of a refused add or clone (spec-004 §5); `detail` holds the catalogue arguments. */
export interface ProjectRefusalBody {
  error: { code: ProjectRefusalCode; message: string; detail?: Record<string, unknown> };
}

/** Body of `GET /api/projects`. */
export interface ProjectListResponse {
  /** In insertion order (S-17.1). */
  projects: ProjectListItem[];
}

/** Body of `POST /api/projects`. */
export interface ProjectAddRequest {
  /** Absolute path of the folder holding `.wingfoil/`, or one starting with `~`. */
  path: string;
}

/** Body of `POST /api/projects/clone`. */
export interface CloneRequest {
  /** The remote, as git accepts it (must not start with `-`). */
  url: string;
  /** New or empty working directory (absolute, or starting with `~`); default `~/projects/<repo>`. */
  directory?: string;
}
