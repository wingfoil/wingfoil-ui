/**
 * Types of the project-list bodies (spec-004 §3, spec-006 §2–§3), matching the schemas of
 * `contracts/api/` (`project.schema.json`, `projects.*.schema.json`; checked by
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
