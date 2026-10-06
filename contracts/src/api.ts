/**
 * Types of the HTTP API bodies (spec-004 §3), matching the schemas of `contracts/api/` (checked by
 * `test/contracts/api-identity-schema.test.ts` and `test/server/http/project-routes.test.ts`).
 */
import type { DirectiveEntry, DirectiveFrontmatter, DnaPaths, DnaShow, MemoryMatch, WorkflowList } from './cli.js';
import type { ActionDescriptor } from './descriptor.js';
import type { ElementFrontmatter, MemoryYaml } from './files.js';

/**
 * Who the user is in a project (REQ-STATE-05): the effective `git config user.email` matched,
 * case-insensitively, against `dna.team.members[].email`. Every kind but `member` is read-only.
 */
export type Identity =
  | {
      /** The email matches exactly one member. */
      kind: 'member';
      /** The effective `user.email`, trimmed, as git gives it. */
      email: string;
      /** The member's `name`. */
      name: string;
      /** The member's roles, in DNA order, without duplicates. */
      roles: string[];
    }
  | {
      /** The email matches no member (S-13.1, S-13.3). */
      kind: 'not-in-team';
      /** The effective `user.email`, trimmed, as git gives it. */
      email: string;
    }
  | {
      /** Neither the repository nor the global git configuration sets `user.email` (S-14.1). */
      kind: 'no-identity';
    }
  | {
      /** The email matches several members (S-15.1). */
      kind: 'ambiguous';
      /** The effective `user.email`, trimmed, as git gives it. */
      email: string;
      /** The names of the matching members, in DNA order (at least two). */
      members: string[];
    };

/** The identity part of `GET /api/p/:pid` (`contracts/api/identity.schema.json`). */
export interface IdentityView {
  identity: Identity;
  /**
   * The role views offered (REQ-STATE-06): the member's roles, in DNA order; `[]` without a member.
   * The selector is shown only when there are several.
   */
  roleViews: string[];
  /**
   * The current role view: the remembered one (spec-006 `roleView`) when the member still holds
   * it, else the first role; `null` without a member or roles.
   */
  roleView: string | null;
}

/** Body of `PUT /api/p/:pid/role-view` (`contracts/api/role-view.request.schema.json`). */
export interface RoleViewRequest {
  /** One of the member's roles. */
  role: string;
}

// --- The v0.1 read routes (spec-004 §3; task-012) -------------------------------------------------

/** The `error` of the spec-004 §5 envelope `{ error: { code, message, detail? } }`. */
export interface ApiError {
  code: string;
  message: string;
  detail?: unknown;
}

/** The supported WingFoil range as the API sends it (adr-001 D3): lowest version and release line. */
export interface ApiRange {
  /** E.g. `0.2.2`. */
  min: string;
  /** E.g. `0.2.x`. */
  max: string;
}

/** One entry of the capability table (`contracts/capabilities.json`). */
export interface ApiCapability {
  id: string;
  name: string;
  /** `null`: in no released WingFoil version (always read-only). */
  minVersion: string | null;
  /** The source of the capability (a CLI verb, a direct read…), `null` when none. */
  via: string | null;
  replacedBy?: string;
  conditions: string[];
}

/** `GET /api/server` (`contracts/api/server.schema.json`). */
export interface ServerInfo {
  /** The WingFoil UI package version. */
  version: string;
  range: ApiRange;
  capabilities: ApiCapability[];
  /** Shell warnings about the local state (spec-006 §4): web-catalogue keys and arguments. */
  warnings: { key: string; args: Record<string, string> }[];
}

/** The project's WingFoil version against the range (task-006 `DetectedVersion`). */
export interface ApiWingfoilVersion {
  /** What `--version` answered, or `null` when it gave no usable line. */
  text: string | null;
  /** The semantic version, or `null` when unrecognised. */
  version: string | null;
  state: 'in-range' | 'below' | 'above' | 'pre-release' | 'unrecognised';
  inRange: boolean;
  /** `path` → "(from PATH)" (S-08.2). */
  source: 'project' | 'path';
}

/** Why a capability is read-only for the project: a catalogue code and its arguments. */
export type ApiCapabilityReason =
  | { code: 'unsupported-version'; range: ApiRange }
  | { code: 'not-released' }
  | { code: 'needs-version'; minVersion: string };

/** The capabilities of a project (task-006 `evaluateCapabilities`). */
export interface ApiCapabilities {
  capabilities: { id: string; state: 'enabled' | 'read-only' | 'hidden'; reason?: ApiCapabilityReason }[];
  /** The version notice: empty → every capability of this release is available. */
  missing: { id: string; minVersion: string }[];
}

/** Why the whole project is read-only (codes of spec-003 §6 `DisabledReason`). */
export type ReadOnlyReason = { code: 'not-in-team' } | { code: 'version-unsupported'; range: string };

/** `GET /api/p/:pid` — the project header (`contracts/api/project.schema.json`). */
export interface ProjectHeader extends IdentityView {
  id: string;
  /** `dna.project.name`, else the name in the project list. */
  name: string;
  wingfoil: ApiWingfoilVersion;
  capabilities: ApiCapabilities;
  /** Empty when the user may act; otherwise every reason, identity first. */
  readOnly: ReadOnlyReason[];
  repository: {
    /** The `X-Repo-State` value. */
    state: string;
    /** HEAD commit (40 zeros before the first commit). */
    head: string;
    /** Number of entries of the working-tree status (files with local changes). */
    localChanges: number;
  };
  /** Present when `dna show` failed: the identity is then matched against no member (S-27.1). */
  dnaError?: ApiError;
}

/** One section of `GET /config`: the read, or its error (a failure stays in its section). */
export type ConfigSection<T> = { data: T; warnings?: string[] } | { error: ApiError };

/** `GET /api/p/:pid/config` (`contracts/api/config.schema.json`). */
export interface ProjectConfig {
  dna: ConfigSection<DnaShow>;
  paths: ConfigSection<DnaPaths>;
  workflows: ConfigSection<WorkflowList>;
  /** `memory.yaml` with every type's `states` resolved (spec-001 §4.1). */
  types: ConfigSection<MemoryYaml>;
}

/** One element of the list: its `memory search` match, marker and descriptor. */
export interface ListedElement extends MemoryMatch {
  /** The element file has uncommitted changes (REQ-STATE-01). */
  localChanges: boolean;
  /** Absent when `memory.yaml` cannot be read (`typesError`). */
  descriptor?: ActionDescriptor;
}

/** `GET /api/p/:pid/elements[?archived=true]` (`contracts/api/elements.schema.json`). */
export interface ElementList {
  elements: ListedElement[];
  /** The CLI's warnings. */
  warnings: string[];
  /** The CLI's message when nothing matched. */
  message?: string;
  /** Why the descriptors are missing (an unreadable `memory.yaml`, spec-004 §5). */
  typesError?: ApiError;
}

/** A required field of the element's type (`template.frontmatter.required`, G-01.3). */
export interface RequiredField {
  field: string;
  /** Absent, `null`, empty text or an empty list in the frontmatter. */
  missing: boolean;
}

/** `GET /api/p/:pid/elements/:eid` (`contracts/api/element.schema.json`). */
export interface ElementDetail {
  element: MemoryMatch & { localChanges: boolean };
  frontmatter: ElementFrontmatter;
  /** Markdown body. */
  body: string;
  /** Absent when `memory.yaml` cannot be read. */
  descriptor?: ActionDescriptor;
  /** Absent when `memory.yaml` cannot be read. */
  required?: RequiredField[];
}

/** `GET /api/p/:pid/directives` (`contracts/api/directives.schema.json`). */
export interface DirectiveList {
  /** Each entry with `mine`: bound to the current role view or global ("only mine", S-22.1). */
  entries: (DirectiveEntry & { mine: boolean })[];
  warnings: string[];
}

/** `GET /api/p/:pid/directives/:did` (`contracts/api/directive.schema.json`). */
export interface DirectiveDetail {
  entry: DirectiveEntry;
  frontmatter: DirectiveFrontmatter;
  /** Markdown body. */
  body: string;
}

/** `GET /api/p/:pid/docs` (`contracts/api/docs.schema.json`). */
export interface DocumentationIndex {
  /** `paths.docs`. */
  roots: string[];
  /** Markdown files under the roots, without Memory and plan files, sorted by path. */
  documents: { path: string }[];
}

/** `GET /api/p/:pid/files/tree?path=` (`contracts/api/file-tree.schema.json`). */
export interface FileTree {
  /** The directory, relative to the project root (`""` for the root). */
  path: string;
  entries: { name: string; path: string; kind: 'file' | 'directory' | 'symlink' | 'other' }[];
}

/** `GET /api/p/:pid/files/content?path=` (`contracts/api/file-content.schema.json`). */
export interface FileContent {
  path: string;
  /** Bytes. */
  size: number;
  /** UTF-8 text. */
  content: string;
}
