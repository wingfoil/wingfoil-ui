/**
 * The v0.1 project read routes of spec-004 §3 (task-012), assembled from the snapshot (task-010),
 * the CLI adapter and direct reads (task-005), the version range (task-006), the identity (task-009)
 * and the action descriptor (task-011):
 *
 * | Route | Body (`contracts/api/`) |
 * |-------|-------------------------|
 * | `GET /api/p/:pid` | `project.schema.json` — header: name, version and range state, capabilities, identity, role views, read-only reasons, repository status and conditions (v0.2, task-033: spec-010 §3, §7) |
 * | `GET /api/p/:pid/config` | `config.schema.json` — DNA, paths, workflows, resolved types, each section its read or its error; the effective `ui.yaml` (`ui`, v0.3, task-068: `ui-config.schema.json`, its echoed strings escaped), absent when `memory.yaml` cannot be read |
 * | `GET /api/p/:pid/elements[?archived=true]` | `elements.schema.json` — elements with marker and descriptor |
 * | `GET /api/p/:pid/elements/:eid` | `element.schema.json` — frontmatter, body, descriptor, required fields, type states; `:eid` a full or a short id (spec-011 §3: 404 and 409 `element.refusal.schema.json`) |
 * | `GET /api/p/:pid/elements/:eid/history` | `history.schema.json` — `memory history` |
 * | `GET /api/p/:pid/directives`, `/directives/:did` | `directives.schema.json`, `directive.schema.json` |
 * | `GET /api/p/:pid/docs` | `docs.schema.json` — the documentation index |
 * | `GET /api/p/:pid/files/tree?path=`, `/files/content?path=` | `file-tree.schema.json`, `file-content.schema.json` |
 * | `GET /api/p/:pid/today?view=` | `today.schema.json` — Requires you, Waiting on others, all-roles summary (v0.2, task-031) |
 * | `GET /api/p/:pid/events/memory?before=&limit=` | `memory-events.schema.json` — Memory events, newest first (v0.2, task-031) |
 *
 * Every read goes through the project's snapshot view — one CLI process per command and repository
 * state (REQ-PERF-05) — and answers `X-Repo-State`. An unknown `:pid` is 404 before anything is
 * read; an unknown `:eid`/`:did` is 404 (looked up in the CLI's lists, never a path built from it).
 * The element read resolves a short id too (spec-011 §3, task-057); history takes the full id only.
 * Element bodies and rows carry `shortId` (spec-011 §1), derived from `memory.yaml` here. Every text
 * a body takes from a tool or the repository is written by the rules of `serialise.ts` (spec-004 §5,
 * task-056): titles escaped, commit texts — history, Memory events, the descriptor's `rejection` —
 * through the sanitiser of tool messages after the descriptor matched the emails, keys and document
 * content as read.
 * A failed direct read is a 502 `read-error` of that element or directive only; an unreadable
 * `memory.yaml` degrades the type-dependent parts only; a failed `dna show` stays in the DNA
 * (S-27.1). A refused working-tree path is a 404 `not-found` with `detail.kind` (`outside`: the
 * "outside the repository" marker of REQ-SEC-06).
 */
import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from 'fastify';
import type {
  ActionDescriptor,
  ApiError,
  DirectiveDetail,
  DirectiveList,
  DocumentationIndex,
  DnaMember,
  DnaShow,
  ElementDetail,
  ElementList,
  ElementRef,
  ListedElement,
  MemoryMatch,
  MemoryYaml,
  ProjectConfig,
  ProjectEntry,
  ProjectHeader,
  ReadOnlyReason,
  RequiredField,
  StateMachine,
  Today,
  TodayRow,
  MemoryEventsPage,
  MissingReferences,
  Progress,
} from '@wingfoil-ui/contracts';
import { CliError, cliErrorEnvelope, type CliOutput } from '../cli/adapter.js';
import { evaluateCapabilities } from '../cli/capabilities.js';
import { mergeToolLines, type WarningParts } from '../cli/commands.js';
import { CliNotFoundError } from '../cli/discovery.js';
import { compareSemVer, parseSemVer, supportedRange, type DetectedVersion } from '../cli/version.js';
import { describeElement, heldOf, type CopyState, type DescriptorHolds } from '../descriptor/descriptor.js';
import { today } from '../descriptor/today.js';
import { GitReadError } from '../git/git.js';
import { repositoryStatus, type SyncStatus } from '../git/sync-status.js';
import { MEMORY_EVENTS_MAX_LIMIT, memoryDirectories, memoryEventsPage } from '../git/memory-log.js';
import { directivesForRoleView, identityView } from '../identity/identity.js';
import { identityOf } from '../identity/snapshot-identity.js';
import { ARCHIVED_QUERY } from '../presets/api.js';
import { ARCHIVED_STATES, LIMITS_SINCE } from '../presets/wingfoil.js';
import { DirectReadError } from '../reads/confine.js';
import { shortIdsOf, type ShortIds } from '../reads/short-id.js';
import { resolveStates } from '../reads/memory-yaml.js';
import { directivesInForce } from '../reads/project-reads.js';
import {
  documentationIndex,
  documentationScope,
  listDirectory,
  readWorkingTreeFile,
  WorkingTreeError,
  type DocumentationScope,
} from '../reads/working-tree.js';
import type { ElementEvents, ProjectSnapshot, SnapshotView } from '../snapshot/snapshot.js';
import { REPO_STATE_HEADER, repoStateHeader, type RepoState } from '../snapshot/state.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import { stripUserinfo, type StateStore } from '../state/store.js';
import { envelope } from './app.js';
import { resolveElementId } from './element-address.js';
import { uiConfigBody } from '../ui-config/body.js';
import { elementRef, progressBody } from '../project-state/bodies.js';
import { currentElement, scopeType } from '../project-state/current.js';
import { missingCategories } from '../project-state/missing.js';
import { naturalOrder } from '../project-state/order.js';
import type { UiCategory } from '../ui-config/types.js';
import {
  descriptorBody,
  directiveBody,
  directiveFrontmatterBody,
  dnaBody,
  frontmatterBody,
  historyBody,
  identityBody,
  matchBody,
  memoryEventBody,
  repositoryText,
  workflowsBody,
  toolTextSanitiser,
  type TextSanitiser,
} from './serialise.js';

/** Prefix of every route of this module. */
export const PROJECT_PATH = '/api/p/:pid';

/** What the routes need. */
export interface ProjectRoutesOptions {
  /** The project list: `:pid` → the project's folder. */
  store: StateStore;
  /** The snapshots of the open projects (the launcher's). */
  snapshots: Snapshots;
}

/** A read that failed in a way the API reports (spec-004 §5), with its HTTP status. */
interface Refusal {
  status: number;
  error: ApiError;
}

/** `file` of a direct read relative to the project: directive and `memory.yaml` paths are `.wingfoil/`'s. */
type ReadBase = '' | '.wingfoil/';

/**
 * The spec-004 §5 refusal of a read error, or `undefined` for an unexpected one. A
 * {@link DirectReadError} is logged as `{ kind, file }` only (its message quotes file values),
 * `outside` at warn level.
 */
function refusalOf(error: unknown, base: ReadBase, log: FastifyBaseLogger): Refusal | undefined {
  if (error instanceof CliError || error instanceof CliNotFoundError) {
    const { status, body } = cliErrorEnvelope(error);
    return { status, error: body.error };
  }
  if (error instanceof DirectReadError) {
    const file = `${base}${error.file}`;
    if (error.kind === 'outside') log.warn({ kind: error.kind, file }, 'direct read refused');
    else log.info({ kind: error.kind, file }, 'direct read failed');
    const reason = error.kind === 'outside' ? 'outside the project' : error.kind;
    // The page shows the file through the catalogue: a repository path, class (b) (task-072 D72-9).
    const shown = repositoryText(file);
    return {
      status: 502,
      error: {
        code: 'read-error',
        message: `Cannot read ${shown}: ${reason}`,
        detail: { file: shown, kind: error.kind },
      },
    };
  }
  if (error instanceof GitReadError) {
    // Git's message may quote configuration values and paths (review round 3 m1): the kind and the
    // exit only, as the repository check logs them (snapshots.ts); the body is the plain 500.
    log.error({ kind: 'git-read', ended: error.ended, exitCode: error.exitCode }, 'git read failed');
    return { status: 500, error: { code: 'internal', message: 'Internal error' } };
  }
  if (error instanceof WorkingTreeError) {
    if (error.kind === 'outside') log.warn({ kind: error.kind }, 'working-tree path refused');
    return { status: 404, error: { code: 'not-found', message: 'Not found', detail: { kind: error.kind } } };
  }
  return undefined;
}

/** The read, or its refusal; unexpected errors propagate (500 `internal`). */
async function settle<T>(
  read: Promise<T>,
  base: ReadBase,
  log: FastifyBaseLogger,
): Promise<{ ok: true; value: T } | { ok: false; refusal: Refusal }> {
  try {
    return { ok: true, value: await read };
  } catch (error) {
    const refusal = refusalOf(error, base, log);
    if (!refusal) throw error;
    return { ok: false, refusal };
  }
}

/** A refusal thrown through a handler, answered as its envelope. */
class Refused extends Error {
  constructor(readonly refusal: Refusal) {
    super(refusal.error.code);
  }
}

/** The value of a settled read, or throw its refusal. */
function valueOf<T>(settled: { ok: true; value: T } | { ok: false; refusal: Refusal }): T {
  if (!settled.ok) throw new Refused(settled.refusal);
  return settled.value;
}

const notFound = (): Refused => new Refused({ status: 404, error: { code: 'not-found', message: 'Not found' } });

/**
 * The label of the supported range in a `version-unsupported` reason: `<min> to <max>`, e.g.
 * `0.2.2 to 0.2.x` (decided by the user 2026-10-06).
 */
export function rangeLabel(): string {
  const { min, max } = supportedRange();
  return `${min} to ${max}`;
}

/** The team of the DNA, none when `dna show` failed (the identity then matches no member). */
function membersOf(dna: { ok: true; value: CliOutput<DnaShow> } | { ok: false }): DnaMember[] {
  return dna.ok ? dna.value.data.team.members : [];
}

/**
 * The descriptor inputs of a view (spec-003), or why there are none (an unreadable `memory.yaml`):
 * `describe(match, localChanges, events)` gives the descriptor of one element.
 */
type DescriptorInputs =
  | {
      ok: true;
      memoryYaml: MemoryYaml;
      describe(match: MemoryMatch, localChanges: boolean, events: ElementEvents): ActionDescriptor;
    }
  | { ok: false; refusal: Refusal };

/** The required fields of `type` and whether `frontmatter` lacks each (G-01.3). */
export function requiredFields(
  memoryYaml: MemoryYaml,
  type: string,
  frontmatter: Record<string, unknown>,
): RequiredField[] {
  return (memoryYaml.types[type]?.required ?? []).map((field) => {
    const value = frontmatter[field];
    const missing =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0);
    return { field, missing };
  });
}

/** The resolved states of `type` (spec-001 §4.1) for the panel's state machine; none for an undeclared type. */
function statesOf(memoryYaml: MemoryYaml, type: string): { states?: StateMachine } {
  const states = resolveStates(memoryYaml, type);
  return states ? { states } : {};
}

/** The reads of one request on one project. */
class ProjectRead {
  constructor(
    readonly entry: ProjectEntry,
    readonly root: string,
    readonly view: SnapshotView,
    readonly log: FastifyBaseLogger,
    private readonly store: StateStore,
    /** The sync status (spec-010 §3, task-033). */
    readonly sync: SyncStatus,
    private readonly snapshot: ProjectSnapshot,
  ) {}

  /**
   * The rule of tool messages and commit texts for this project (class (a), `serialise.ts`): the
   * CLI adapter's sanitiser — the project's and the repository's folders, the CLI's package folder,
   * the home directory —, or the same without the CLI's folder when no CLI resolves. Once per request.
   */
  toolText(): Promise<TextSanitiser> {
    this.sanitiser ??= this.snapshot.cli().then(
      (cli) => toolTextSanitiser({ ...this.snapshot.localRoots, ...wingfoilRoot(cli.resolved.packageDir) }),
      () => toolTextSanitiser(this.snapshot.localRoots),
    );
    return this.sanitiser;
  }

  private sanitiser: Promise<TextSanitiser> | undefined;

  settle<T>(read: Promise<T>, base: ReadBase = ''): ReturnType<typeof settle<T>> {
    return settle(read, base, this.log);
  }

  /** The descriptor inputs, once per state. */
  descriptorInputs(): Promise<DescriptorInputs> {
    return this.view.derived('descriptor inputs', async (): Promise<DescriptorInputs> => {
      const types = await this.settle(this.view.memoryTypes(), '.wingfoil/');
      if (!types.ok) return types;
      const [dna, detected] = await Promise.all([this.settle(this.view.dna()), this.view.detected()]);
      const members = membersOf(dna);
      const memoryYaml = types.value;
      const enablement = {
        identified: identityOf(this.view, members).kind === 'member',
        version: { supported: detected.inRange, range: rangeLabel() },
        // Rule 4 of spec-003 §6 (REQ-STATE-04, task-033): the copy of this state.
        copy: descriptorCopy(this.view.state),
      };
      const none: ReadonlySet<string> = new Set();
      const holds = await this.holds();
      const occupancy = await this.occupancy(memoryYaml, detected);
      return {
        ok: true,
        memoryYaml,
        // Rule 3 of spec-003 §6 looks only at the element itself.
        describe: (match, localChanges, events) =>
          describeElement(match, events.get(match.id) ?? [], {
            memoryYaml,
            members,
            enablement: { ...enablement, localChanges: localChanges ? new Set([match.id]) : none },
            ...(holds ? { holds } : {}),
            ...(occupancy ? { occupancy } : {}),
          }),
      };
    });
  }

  /**
   * Rule 5's count (spec-003 §6; task-073 D73-3): the non-archived elements of `memory search` by
   * type and status — the search every route already reads, cached for the state, so no process is
   * added — only for a WingFoil version that enforces `limits` ({@link LIMITS_SINCE}) and a
   * `memory.yaml` where some machine declares one; otherwise `undefined` (no limit applies).
   */
  private async occupancy(
    memoryYaml: MemoryYaml,
    detected: DetectedVersion,
  ): Promise<((type: string, state: string) => number) | undefined> {
    const version = detected.version === null ? undefined : parseSemVer(detected.version);
    if (!version || compareSemVer(version, parseSemVer(LIMITS_SINCE)!) < 0) return undefined;
    const machines = [memoryYaml.defaults?.states, ...Object.values(memoryYaml.types).map((t) => t.states)];
    if (!machines.some((m) => m?.limits !== undefined)) return undefined;
    const counts = new Map<string, number>();
    for (const { match } of (await this.view.elements()).matches) {
      const key = `${match.type}\0${match.status}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return (type, state) => counts.get(`${type}\0${state}`) ?? 0;
  }

  /**
   * The held gates of this state (spec-005 §4a, spec-003 §3; task-069 D69-4): the `holds` of the
   * effective `ui.yaml` (an ignored or absent file holds nothing → `undefined`), and the reference
   * index (spec-012 §1) built only when one of them is `when-references-done`. Called once per state
   * from {@link descriptorInputs}, after `memory.yaml` was read, and by `/progress`'s pending gates
   * (task-059 D59-6).
   */
  async holds(): Promise<DescriptorHolds | undefined> {
    const table = (await this.view.uiConfig()).holds.value;
    if (table.size === 0) return undefined;
    const counted = [...table.values()].some((states) => [...states.values()].includes('when-references-done'));
    const index = counted ? await this.view.referenceIndex() : undefined;
    return {
      condition: (type, state) => table.get(type)?.get(state),
      referencingNotDone: (id) => index?.referencingNotDone(id) ?? 0,
    };
  }

  /**
   * The Memory events (spec-002 §3), or none and why: a failed or refused `git log` degrades the
   * actors, `rejection` and `since` of the descriptors only (review round 1, finding 5). Not kept
   * for the state: the next request reads again.
   */
  async events(): Promise<{ events: ElementEvents; error?: ApiError }> {
    try {
      return { events: await this.view.events() };
    } catch (error) {
      this.log.warn({ kind: (error as Error).name }, 'memory events unavailable');
      return { events: new Map(), error: { code: 'internal', message: 'Memory events unavailable' } };
    }
  }

  /**
   * spec-006 §2: the stored name and remote follow the project on every open — the DNA name (kept
   * when the DNA has none) and `origin` without credentials. Written only when one differs; no CLI
   * work happens inside the store's transaction, and on a warm cache no process starts. Best-effort:
   * a failed `origin` read or state write leaves the entry as it is and is logged by kind only.
   */
  async refreshEntry(name: string): Promise<void> {
    let remote: string;
    try {
      remote = stripUserinfo(await this.view.origin());
    } catch (error) {
      this.log.warn({ kind: (error as Error).name }, 'origin unreadable: project entry not refreshed');
      return;
    }
    if (name === this.entry.name && remote === this.entry.remote) return;
    try {
      await this.store.update(this.entry.id, { name, remote });
    } catch (error) {
      // Best-effort: a state that cannot be written (read-only folder, full disk) never fails the
      // header; the kind only (the message may quote paths).
      this.log.warn({ kind: (error as Error).name }, 'project entry not refreshed: state not written');
    }
  }

  /**
   * The current element of `progress.scope` as an `ElementRef` (spec-012 §2, §3; task-059 D59-2), once
   * per content key; `null` when no scope applies or no element is current. Rejects as
   * {@link SnapshotView.referenceIndex} does (a failed `memory search`, an unreadable `memory.yaml`).
   */
  currentRef(): Promise<ElementRef | null> {
    return this.view.contentDerived('current element', async () => {
      const ui = await this.view.uiConfig();
      if (scopeType(ui) === null) return null;
      const [index, memoryYaml, list, shortIds] = await Promise.all([
        this.view.referenceIndex(),
        this.view.memoryTypes(),
        this.view.elements(),
        this.shortIds(),
      ]);
      const current = currentElement(index, memoryYaml, ui);
      const match = current && list.matches.find((m) => m.match.id === current.id)?.match;
      return current && match ? elementRef(current, match, shortIds) : null;
    });
  }

  /** The short ids of this state's elements (spec-011 §1): none when `memory.yaml` is unreadable. */
  shortIds(): Promise<ShortIds> {
    // The direct read only (no CLI process), once per state: the resolution needs no descriptor.
    return this.view.derived('short ids', async () => {
      const types = await this.settle(this.view.memoryTypes(), '.wingfoil/');
      return shortIdsOf(types.ok ? types.value : undefined);
    });
  }

  /**
   * The element read's `:eid` resolved (spec-011 §3): its full id, or a 409 `ambiguous-id` or 404
   * `not-found` thrown. The archived lists are read only when no live element has `eid` as full id.
   */
  async resolve(eid: string): Promise<string> {
    const { view } = this;
    const resolution = await resolveElementId(eid, {
      live: async () => (await view.elements()).matches.map((m) => m.match),
      retired: async () => {
        const matches: MemoryMatch[] = [];
        for (const status of ARCHIVED_STATES)
          matches.push(...(await view.archivedElements(status)).matches.map((m) => m.match));
        return matches;
      },
      shortIds: await this.shortIds(),
    });
    if (resolution === undefined) throw notFound();
    if ('ambiguous' in resolution) {
      throw new Refused({
        status: 409,
        error: { code: 'ambiguous-id', message: 'Ambiguous id', detail: resolution.ambiguous },
      });
    }
    return resolution.id;
  }

  /** The `memory search` match of `id`, then the archived ones; `undefined` when none. */
  async findMatch(id: string): Promise<{ match: MemoryMatch; localChanges: boolean } | undefined> {
    const found = (await this.view.elements()).matches.find((m) => m.match.id === id);
    if (found) return found;
    for (const status of ARCHIVED_STATES) {
      const archived = (await this.view.archivedElements(status)).matches.find((m) => m.match.id === id);
      if (archived) return archived;
    }
    return undefined;
  }

  /** The documentation scope: `paths.docs` minus the Memory directories (all of it when unknown). */
  documentationScope(): Promise<DocumentationScope> {
    return this.view.derived('documentation scope', async () => {
      const [paths, types] = await Promise.all([this.view.paths(), this.settle(this.view.memoryTypes(), '.wingfoil/')]);
      // Without memory.yaml the Memory directories are unknown: nothing is served (REQ-ARC-04).
      const memory = types.ok ? memoryDirectories(types.value) : ['.'];
      return documentationScope({
        docs: paths.data.docs ?? [],
        memoryDirectories: memory,
        governance: paths.data.governance ?? [],
      });
    });
  }
}

/** The CLI's package folder as a root of `redactLocalPaths`, when it has one. */
function wingfoilRoot(packageDir: string | undefined): { wingfoil?: string[] } {
  return packageDir === undefined ? {} : { wingfoil: [packageDir] };
}

/** `{ shortId }` of an element that has one, else nothing (the field is absent, spec-011 §5). */
function shortIdField(shortIds: ShortIds, element: { id: string; type: string }): { shortId?: string } {
  const shortId = shortIds(element);
  return shortId === undefined ? {} : { shortId };
}

/** The descriptor input of rule 4 (spec-003 §6) from a state's copy (spec-010 §1). */
function descriptorCopy(state: RepoState): CopyState {
  switch (state.copy) {
    case 'behind':
      return { state: 'behind', commits: state.behind };
    case 'diverged':
      return { state: 'diverged' };
    case 'detached':
      return { state: 'detached' };
    default:
      return { state: 'ok' };
  }
}

/** `GET /api/p/:pid`. */
async function header(read: ProjectRead): Promise<ProjectHeader> {
  const { view, entry } = read;
  const [detected, dna] = await Promise.all([view.detected(), read.settle(view.dna())]);
  const members = membersOf(dna);
  const ids = identityView(identityOf(view, members), entry.roleView);
  const range = supportedRange();
  const readOnly: ReadOnlyReason[] = [];
  if (ids.identity.kind !== 'member') readOnly.push({ code: 'not-in-team' });
  if (!detected.inRange) readOnly.push({ code: 'version-unsupported', range: rangeLabel() });
  const name = (dna.ok ? dna.value.data.project?.name : undefined) ?? entry.name;
  await read.refreshEntry(name);
  return {
    id: entry.id,
    // The project's name and the identity's names and email: class (b) (task-072 D72-3, D72-4),
    // after the identity was matched and the stored name refreshed on the raw values.
    name: repositoryText(name),
    wingfoil: wingfoilOf(detected),
    capabilities: evaluateCapabilities(detected, range),
    ...ids,
    identity: identityBody(ids.identity),
    readOnly,
    repository: repositoryStatus(view.state, read.sync.of(entry.id, view.state.copy)),
    // spec-001 §6, spec-010 §7 (RP-25).
    conditions: view.state.remotes.length > 0 ? ['has-remote'] : [],
    ...(dna.ok ? {} : { dnaError: dna.refusal.error }),
  };
}

/**
 * The header's version. Its `text` is the printed `--version` text as `detectVersion` passes it on:
 * through the adapter's sanitiser (review rounds 1 n1, 2 n7 — bounded, the project and CLI folders
 * redacted, control and bidi characters as visible escapes).
 */
function wingfoilOf(detected: DetectedVersion): ProjectHeader['wingfoil'] {
  const { text, version, state, inRange, source } = detected;
  return { text, version, state, inRange, source };
}

/** One `/config` section, its data through `body` (task-072 D72-2: the DNA and the workflows). */
function section<T>(
  settled: { ok: true; value: CliOutput<T> } | { ok: false; refusal: Refusal },
  body: (data: T) => T = (data) => data,
): { data: T; warnings?: string[] } | { error: ApiError } {
  if (!settled.ok) return { error: settled.refusal.error };
  const { warnings } = settled.value;
  const data = body(settled.value.data);
  return warnings.length > 0 ? { data, warnings } : { data };
}

/** `GET /api/p/:pid/config`. */
async function config(read: ProjectRead): Promise<ProjectConfig> {
  const { view } = read;
  const [dna, paths, workflows, types, ui] = await Promise.all([
    read.settle(view.dna()),
    read.settle(view.paths()),
    read.settle(view.workflows()),
    read.settle(view.memoryTypes(), '.wingfoil/'),
    // The effective ui.yaml (spec-012 §2, task-068): it needs memory.yaml, so it settles as the
    // types do; a refusal adds no section (the types carry the error).
    read.settle(view.uiConfig(), '.wingfoil/'),
  ]);
  const resolved = (yaml: MemoryYaml): MemoryYaml => ({
    ...yaml,
    types: Object.fromEntries(
      Object.entries(yaml.types).map(([name, def]) => [name, { ...def, states: resolveStates(yaml, name)! }]),
    ),
  });
  return {
    dna: section(dna, dnaBody),
    paths: section(paths),
    workflows: section(workflows, workflowsBody),
    types: types.ok ? { data: resolved(types.value) } : { error: types.refusal.error },
    ...(ui.ok ? { ui: uiConfigBody(ui.value, await currentOrNull(read)) } : {}),
  };
}

/**
 * `/config`'s `scope.current` (task-059 D59-2, Q6): the derived element, `null` when the reads it
 * needs fail — the other sections report those failures; `/progress` answers them.
 */
async function currentOrNull(read: ProjectRead): Promise<ElementRef | null> {
  const settled = await read.settle(read.currentRef(), '.wingfoil/');
  return settled.ok ? settled.value : null;
}

/**
 * The missing-reference flag of a state (spec-012 §5, task-059 D59-7): `requires` from the
 * effective `ui.yaml`; the reference index built only when it names a type (`shown`). Once per
 * content key.
 */
function missingOf(
  read: ProjectRead,
): Promise<{ references: MissingReferences; categories: ReadonlyMap<string, readonly UiCategory[]> }> {
  return read.view.contentDerived('missing references', async () => {
    const requires = (await read.view.uiConfig()).requires.value;
    if (requires.size === 0) return { references: { shown: false, unreadable: [], capped: [] }, categories: new Map() };
    const index = await read.view.referenceIndex();
    return {
      references: { shown: true, unreadable: naturalOrder(index.unreadable), capped: naturalOrder(index.capped) },
      categories: missingCategories(index, requires),
    };
  });
}

/** `GET /api/p/:pid/elements[?archived=true]`. */
async function elements(read: ProjectRead, archived: boolean): Promise<ElementList> {
  const { view } = read;
  const list = await view.elements();
  const matches = [...list.matches];
  const lists: WarningParts[] = [list.warningParts];
  if (archived) {
    for (const status of ARCHIVED_STATES) {
      const more = await view.archivedElements(status);
      matches.push(...more.matches);
      // The archived searches' warnings too — a dropped archived match included (task-070 D70-4).
      lists.push(more.warningParts);
    }
  }
  // Each text once (every search repeats the CLI's own warnings; the page keys the notice's rows by
  // text, review round 1 F4), under one cap and one count line (F2), the repeated stderr's cut counted
  // once (round 2 R2-F1).
  const warnings = mergeToolLines(lists);
  const inputs = await read.descriptorInputs();
  const events = inputs.ok ? await read.events() : undefined;
  const shortIds = await read.shortIds();
  const sanitise = await read.toolText();
  // spec-012 §5: only with a readable memory.yaml (the effective ui.yaml needs it); the listed
  // elements only — the archived ones are not indexed (TQ-3).
  const missing = inputs.ok ? await missingOf(read) : undefined;
  const live = new Set(list.matches.map((m) => m.match.path));
  const listed: ListedElement[] = matches.map(({ match, localChanges }) => {
    const categories = live.has(match.path) ? missing?.categories.get(match.id) : undefined;
    return {
      ...matchBody(match),
      ...shortIdField(shortIds, match),
      localChanges,
      ...(inputs.ok && events
        ? { descriptor: descriptorBody(inputs.describe(match, localChanges, events.events), sanitise) }
        : {}),
      ...(categories ? { missingCategories: [...categories] } : {}),
    };
  });
  return {
    elements: listed,
    warnings,
    ...(list.message !== undefined ? { message: list.message } : {}),
    ...(inputs.ok ? {} : { typesError: inputs.refusal.error }),
    ...(missing ? { missingReferences: missing.references } : {}),
    ...(events?.error ? { eventsError: events.error } : {}),
  };
}

/** `GET /api/p/:pid/elements/:eid`: `:eid` a full id or a short id (spec-011 §3). */
async function element(read: ProjectRead, eid: string): Promise<ElementDetail> {
  const id = await read.resolve(eid);
  const found = valueOf(await read.settle(read.view.element(id)));
  if (!found) throw notFound();
  const inputs = await read.descriptorInputs();
  const events = inputs.ok ? await read.events() : undefined;
  const { match, content, localChanges } = found;
  const sanitise = await read.toolText();
  return {
    element: { ...matchBody(match), ...shortIdField(await read.shortIds(), match), localChanges },
    // Document content (class (d), spec-004 §5): as written — but the reject's reason WingFoil
    // writes into it, which is commit text (class (a), review round 1).
    frontmatter: frontmatterBody(content.frontmatter, sanitise),
    body: content.body,
    ...(inputs.ok && events
      ? {
          descriptor: descriptorBody(inputs.describe(match, localChanges, events.events), sanitise),
          required: requiredFields(inputs.memoryYaml, match.type, content.frontmatter),
          ...statesOf(inputs.memoryYaml, match.type),
          ...(events.error ? { eventsError: events.error } : {}),
        }
      : {}),
  };
}

/**
 * `GET /api/p/:pid/directives`: one entry per directive id, the one in force (task-047 D47-1,
 * bug-025), in the CLI's order; `mine` on those entries.
 */
async function directives(read: ProjectRead): Promise<DirectiveList> {
  const { view, entry } = read;
  const [list, dna] = await Promise.all([view.directives(), read.settle(view.dna())]);
  const { roleView } = identityView(identityOf(view, membersOf(dna)), entry.roleView);
  const inForce = directivesInForce(list.data);
  const mine = new Set(directivesForRoleView(inForce, roleView));
  return {
    // `mine` on the raw entries; their name and title written as class (b) (task-072 D72-5).
    entries: inForce.map((e) => ({ ...directiveBody(e), mine: mine.has(e) })),
    warnings: list.data.warnings,
  };
}

/** `GET /api/p/:pid/directives/:did`. */
async function directive(read: ProjectRead, id: string): Promise<DirectiveDetail> {
  const found = valueOf(await read.settle(read.view.directive(id), '.wingfoil/'));
  if (!found) throw notFound();
  // The name and title (the page's heading) as class (b); the rest as written (task-072 D72-5).
  return {
    entry: directiveBody(found.entry),
    frontmatter: directiveFrontmatterBody(found.content.frontmatter),
    body: found.content.body,
  };
}

/** `GET /api/p/:pid/docs`. */
async function docs(read: ProjectRead): Promise<DocumentationIndex> {
  // Walked per request, not kept for the state: a git-ignored document does not move the state.
  const scope = await read.documentationScope();
  const paths = await read.view.paths();
  // A document's path is the address the page links to; what it shows is its label (task-072 D72-6).
  const documents = await documentationIndex(read.root, scope);
  return {
    roots: paths.data.docs ?? [],
    documents: documents.map(({ path }) => ({ path, label: repositoryText(path) })),
  };
}

const invalidRequest = (): Refused =>
  new Refused({ status: 400, error: { code: 'invalid-request', message: 'Invalid request' } });

/**
 * A failed Memory event read as spec-004 §5 `internal` (D31-3): logged by kind only, never a
 * partial answer; an unreadable `memory.yaml` stays its own `read-error`.
 */
async function eventsOrRefuse<T>(read: Promise<T>, log: FastifyBaseLogger): Promise<T> {
  try {
    return await read;
  } catch (error) {
    if (error instanceof DirectReadError) throw error;
    log.warn({ kind: (error as Error).name }, 'memory events unavailable');
    throw new Refused({ status: 500, error: { code: 'internal', message: 'Internal error' } });
  }
}

/**
 * `GET /api/p/:pid/today?view=` (spec-003 §5, spec-004 §3). `view` must be one of the member's
 * role views (an unidentified user has none), else 400 `invalid-request`, checked after the DNA
 * read and before the other reads; absent → the remembered role view. No partial Today (D31-3):
 * a failed `dna show` or `memory search` answers the CLI's refusal, an unreadable `memory.yaml`
 * `read-error`, a failed Memory event read `internal`.
 */
async function todayOf(read: ProjectRead, query: Record<string, unknown>): Promise<Today> {
  const { view, entry } = read;
  const requested = query['view'];
  if (requested !== undefined && typeof requested !== 'string') throw invalidRequest();
  const dna = valueOf(await read.settle(view.dna()));
  const ids = identityView(identityOf(view, dna.data.team.members), entry.roleView);
  if (requested !== undefined && !ids.roleViews.includes(requested)) throw invalidRequest();
  const inputs = await read.descriptorInputs();
  if (!inputs.ok) throw new Refused(inputs.refusal);
  const events = await eventsOrRefuse(view.events(), read.log);
  // Once per state: every role view and the summary place the same rows, described on the texts as
  // read (the email match, D56-4).
  const shortIds = shortIdsOf(inputs.memoryYaml);
  const described = await view.derived('today rows', async () =>
    (await view.elements()).matches.map(({ match, localChanges }): TodayRow => ({
      element: {
        id: match.id,
        ...shortIdField(shortIds, match),
        type: match.type,
        title: match.title,
        status: match.status,
        localChanges,
      },
      descriptor: inputs.describe(match, localChanges, events),
    })),
  );
  // The texts written per request, with this request's roots (review round 1: a memo built while the
  // CLI did not resolve would keep roots without its folder until the state changes).
  const sanitise = await read.toolText();
  const rows = described.map(({ element, descriptor }) => ({
    element: { ...element, title: repositoryText(element.title) },
    descriptor: descriptorBody(descriptor, sanitise),
  }));
  return today(rows, ids.identity, requested ?? ids.roleView);
}

/**
 * `GET /api/p/:pid/progress` (spec-012 §3, task-059): no query parameter (any → 400
 * `invalid-request`, after the project lookup); an unreadable `memory.yaml` → 502 `read-error`, a
 * failed `memory search` → its CLI envelope, never partial figures. Neither the DNA nor the Memory
 * events are read: their failure does not fail it. The body once per content key (D59-9).
 */
async function progressOf(read: ProjectRead, query: Record<string, unknown>): Promise<Progress> {
  if (Object.keys(query).length > 0) throw invalidRequest();
  const { view } = read;
  // The refusals in spec-012 §10's order: `memory.yaml` (502), then `memory search` (its envelope).
  valueOf(await read.settle(view.memoryTypes(), '.wingfoil/'));
  valueOf(await read.settle(view.uiConfig(), '.wingfoil/'));
  valueOf(await read.settle(view.elements()));
  return valueOf(
    await read.settle(
      view.contentDerived('progress body', async () => {
        const [index, memoryYaml, ui, list, holds, detected, shortIds] = await Promise.all([
          view.referenceIndex(),
          view.memoryTypes(),
          view.uiConfig(),
          view.elements(),
          read.holds(),
          view.detected(),
          read.shortIds(),
        ]);
        const matches = new Map(list.matches.map((m) => [m.match.id, m.match]));
        const capability = evaluateCapabilities(detected, supportedRange()).capabilities.find(
          (c) => c.id === WORKFLOW_POSITION,
        );
        return progressBody({
          index,
          ui,
          current: currentElement(index, memoryYaml, ui),
          held: (e) => heldOf(e.id, e.type, e.status, e.kind, holds) !== undefined,
          match: (id) => matches.get(id)!,
          shortIds,
          // `via: null` in v0.3: the capability is always read-only, with a reason (spec-001 §6).
          phaseReason: capability?.reason ?? { code: 'not-in-release' },
        });
      }),
      '.wingfoil/',
    ),
  );
}

/** The capability whose reason the phase figures carry (spec-012 §3, `contracts/capabilities.json`). */
const WORKFLOW_POSITION = 'workflow-position';

/** A `limit` of spec-004 §3: an integer from 1 to {@link MEMORY_EVENTS_MAX_LIMIT} (D31-2). */
const LIMIT = /^[1-9][0-9]*$/;

/**
 * `GET /api/p/:pid/events/memory?before=&limit=` (spec-004 §3, D31-1, D31-2): the events of the
 * cached project-wide parse (spec-002 §3), newest first; an invalid `limit` or a `before` that is
 * not an event's sha → 400 `invalid-request`.
 */
async function memoryEventsOf(read: ProjectRead, query: Record<string, unknown>): Promise<MemoryEventsPage> {
  const { before, limit } = query;
  if (before !== undefined && typeof before !== 'string') throw invalidRequest();
  if (
    limit !== undefined &&
    (typeof limit !== 'string' || !LIMIT.test(limit) || Number(limit) > MEMORY_EVENTS_MAX_LIMIT)
  ) {
    throw invalidRequest();
  }
  // An unreadable `memory.yaml` is its `read-error` (the Memory directories come from it).
  valueOf(await read.settle(read.view.memoryTypes(), '.wingfoil/'));
  const log = await eventsOrRefuse(read.view.eventLog(), read.log);
  const page = memoryEventsPage(log, {
    ...(before !== undefined ? { before } : {}),
    ...(limit !== undefined ? { limit: Number(limit) } : {}),
  });
  if (!page) throw invalidRequest();
  const sanitise = await read.toolText();
  return { ...page, events: page.events.map((e) => memoryEventBody(e, sanitise)) };
}

type Handler<P, Q> = (read: ProjectRead, params: P, query: Q) => Promise<unknown>;

/** Register the routes of this module. */
export function registerProjectRoutes(app: FastifyInstance, options: ProjectRoutesOptions): void {
  const { store, snapshots } = options;

  const route = <P extends object = object, Q extends object = object>(
    url: string,
    handler: Handler<P, Q>,
    querystring?: object,
  ): void => {
    app.get(url, {
      ...(querystring ? { schema: { querystring } } : {}),
      handler: async (request, reply): Promise<FastifyReply> => {
        const params = request.params as P & { pid: string };
        const entry = store.get(params.pid);
        if (entry === undefined) return reply.code(404).send(envelope('not-found', 'Not found'));
        try {
          const snapshot = await snapshots.open(entry.id, entry.path);
          const view = await snapshot.view();
          reply.header(REPO_STATE_HEADER, repoStateHeader(view.state));
          const read = new ProjectRead(entry, snapshot.root, view, request.log, store, snapshots.sync, snapshot);
          const body = await handler(read, params, request.query as Q);
          return reply.send(body);
        } catch (error) {
          const refusal = error instanceof Refused ? error.refusal : refusalOf(error, '', request.log);
          if (!refusal) throw error;
          return reply.code(refusal.status).send({ error: refusal.error });
        }
      },
    });
  };

  const pathQuery = (required: boolean) => ({
    type: 'object',
    properties: { path: { type: 'string' } },
    ...(required ? { required: ['path'] } : {}),
  });

  route(PROJECT_PATH, header);
  route(`${PROJECT_PATH}/config`, config);
  route<object, Record<string, string | undefined>>(
    `${PROJECT_PATH}/elements`,
    (read, _p, query) => elements(read, query[ARCHIVED_QUERY] === 'true'),
    { type: 'object', properties: { [ARCHIVED_QUERY]: { enum: ['true', 'false'] } } },
  );
  route<{ eid: string }>(`${PROJECT_PATH}/elements/:eid`, (read, params) => element(read, params.eid));
  route<{ eid: string }>(`${PROJECT_PATH}/elements/:eid/history`, async (read, params) => {
    if (!(await read.findMatch(params.eid))) throw notFound();
    // Commit texts (class (a), bug-027); the contract's fields only (task-048 D48-8).
    return historyBody((await read.view.history(params.eid)).data, await read.toolText());
  });
  route(`${PROJECT_PATH}/directives`, directives);
  route<{ did: string }>(`${PROJECT_PATH}/directives/:did`, (read, params) => directive(read, params.did));
  route(`${PROJECT_PATH}/docs`, docs);
  route<object, { path?: string }>(
    `${PROJECT_PATH}/files/tree`,
    async (read, _p, query) => {
      const tree = await listDirectory(read.root, query.path ?? '', await read.documentationScope());
      // An entry's name is shown, its path is the address (task-072 D72-7).
      return { ...tree, entries: tree.entries.map((e) => ({ ...e, name: repositoryText(e.name) })) };
    },
    pathQuery(false),
  );
  route<object, { path: string }>(
    `${PROJECT_PATH}/files/content`,
    async (read, _p, query) => {
      const file = await readWorkingTreeFile(read.root, query.path, await read.documentationScope());
      // The path is the address; the label is what the page shows (task-072 D72-6).
      return { ...file, label: repositoryText(file.path) };
    },
    pathQuery(true),
  );
  // task-031 (v0.2): query parameters checked in the handlers, after the project lookup (404 first).
  route<object, Record<string, unknown>>(`${PROJECT_PATH}/today`, (read, _p, query) => todayOf(read, query));
  route<object, Record<string, unknown>>(`${PROJECT_PATH}/events/memory`, (read, _p, query) =>
    memoryEventsOf(read, query),
  );
  // task-059 (v0.3): no query parameter, checked in the handler after the project lookup.
  route<object, Record<string, unknown>>(`${PROJECT_PATH}/progress`, (read, _p, query) => progressOf(read, query));
}
