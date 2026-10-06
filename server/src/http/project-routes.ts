/**
 * The v0.1 project read routes of spec-004 §3 (task-012), assembled from the snapshot (task-010),
 * the CLI adapter and direct reads (task-005), the version range (task-006), the identity (task-009)
 * and the action descriptor (task-011):
 *
 * | Route | Body (`contracts/api/`) |
 * |-------|-------------------------|
 * | `GET /api/p/:pid` | `project.schema.json` — header: name, version and range state, capabilities, identity, role views, read-only reasons, repository status |
 * | `GET /api/p/:pid/config` | `config.schema.json` — DNA, paths, workflows, resolved types; each section its read or its error |
 * | `GET /api/p/:pid/elements[?archived=true]` | `elements.schema.json` — elements with marker and descriptor |
 * | `GET /api/p/:pid/elements/:eid` | `element.schema.json` — frontmatter, body, descriptor, required fields |
 * | `GET /api/p/:pid/elements/:eid/history` | `history.schema.json` — `memory history` |
 * | `GET /api/p/:pid/directives`, `/directives/:did` | `directives.schema.json`, `directive.schema.json` |
 * | `GET /api/p/:pid/docs` | `docs.schema.json` — the documentation index |
 * | `GET /api/p/:pid/files/tree?path=`, `/files/content?path=` | `file-tree.schema.json`, `file-content.schema.json` |
 *
 * Every read goes through the project's snapshot view — one CLI process per command and repository
 * state (REQ-PERF-05) — and answers `X-Repo-State`. An unknown `:pid` is 404 before anything is
 * read; an unknown `:eid`/`:did` is 404 (looked up in the CLI's lists, never a path built from it).
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
  ListedElement,
  MemoryMatch,
  MemoryYaml,
  ProjectConfig,
  ProjectEntry,
  ProjectHeader,
  ReadOnlyReason,
  RequiredField,
} from '@wingfoil-ui/contracts';
import { CliError, cliErrorEnvelope, type CliOutput } from '../cli/adapter.js';
import { evaluateCapabilities } from '../cli/capabilities.js';
import { CliNotFoundError } from '../cli/discovery.js';
import { supportedRange, type DetectedVersion } from '../cli/version.js';
import { describeElement } from '../descriptor/descriptor.js';
import { memoryDirectories } from '../git/memory-log.js';
import { directivesForRoleView, identityView } from '../identity/identity.js';
import { identityOf } from '../identity/snapshot-identity.js';
import { ARCHIVED_QUERY } from '../presets/api.js';
import { ARCHIVED_STATES } from '../presets/wingfoil.js';
import { DirectReadError } from '../reads/confine.js';
import { resolveStates } from '../reads/memory-yaml.js';
import {
  documentationIndex,
  documentationScope,
  listDirectory,
  readWorkingTreeFile,
  WorkingTreeError,
  type DocumentationScope,
} from '../reads/working-tree.js';
import type { SnapshotView } from '../snapshot/snapshot.js';
import { REPO_STATE_HEADER, repoStateHeader } from '../snapshot/state.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import type { StateStore } from '../state/store.js';
import { envelope } from './app.js';

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
    return {
      status: 502,
      error: { code: 'read-error', message: `Cannot read ${file}: ${reason}`, detail: { file, kind: error.kind } },
    };
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

/** The label of the supported range in a `version-unsupported` reason, e.g. `0.2.2–0.2.x`. */
export function rangeLabel(): string {
  const { min, max } = supportedRange();
  return `${min}–${max}`;
}

/** The team of the DNA, none when `dna show` failed (the identity then matches no member). */
function membersOf(dna: { ok: true; value: CliOutput<DnaShow> } | { ok: false }): DnaMember[] {
  return dna.ok ? dna.value.data.team.members : [];
}

/**
 * The descriptor inputs of a view (spec-003), or why there are none (an unreadable `memory.yaml`):
 * `describe(match, localChanges)` gives the descriptor of one element.
 */
type DescriptorInputs =
  | {
      ok: true;
      memoryYaml: MemoryYaml;
      describe(match: MemoryMatch, localChanges: boolean): ActionDescriptor;
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

/** The reads of one request on one project. */
class ProjectRead {
  constructor(
    readonly entry: ProjectEntry,
    readonly root: string,
    readonly view: SnapshotView,
    private readonly log: FastifyBaseLogger,
  ) {}

  settle<T>(read: Promise<T>, base: ReadBase = ''): ReturnType<typeof settle<T>> {
    return settle(read, base, this.log);
  }

  /** The descriptor inputs, once per state. */
  descriptorInputs(): Promise<DescriptorInputs> {
    return this.view.derived('descriptor inputs', async (): Promise<DescriptorInputs> => {
      const types = await this.settle(this.view.memoryTypes(), '.wingfoil/');
      if (!types.ok) return types;
      const [events, dna, detected] = await Promise.all([
        this.view.events(),
        this.settle(this.view.dna()),
        this.view.detected(),
      ]);
      const members = membersOf(dna);
      const memoryYaml = types.value;
      const enablement = {
        identified: identityOf(this.view, members).kind === 'member',
        version: { supported: detected.inRange, range: rangeLabel() },
      };
      const none: ReadonlySet<string> = new Set();
      return {
        ok: true,
        memoryYaml,
        // Rule 3 of spec-003 §6 looks only at the element itself.
        describe: (match, localChanges) =>
          describeElement(match, events.get(match.id) ?? [], {
            memoryYaml,
            members,
            enablement: { ...enablement, localChanges: localChanges ? new Set([match.id]) : none },
          }),
      };
    });
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
      return documentationScope({ docs: paths.data.docs ?? [], memoryDirectories: memory });
    });
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
  return {
    id: entry.id,
    name: (dna.ok ? dna.value.data.project?.name : undefined) ?? entry.name,
    wingfoil: wingfoilOf(detected),
    capabilities: evaluateCapabilities(detected, range),
    ...ids,
    readOnly,
    repository: { state: view.state.key, head: view.state.head, localChanges: view.state.changed.size },
    ...(dna.ok ? {} : { dnaError: dna.refusal.error }),
  };
}

function wingfoilOf(detected: DetectedVersion): ProjectHeader['wingfoil'] {
  const { text, version, state, inRange, source } = detected;
  return { text, version, state, inRange, source };
}

/** One `/config` section. */
function section<T>(
  settled: { ok: true; value: CliOutput<T> } | { ok: false; refusal: Refusal },
): { data: T; warnings?: string[] } | { error: ApiError } {
  if (!settled.ok) return { error: settled.refusal.error };
  const { data, warnings } = settled.value;
  return warnings.length > 0 ? { data, warnings } : { data };
}

/** `GET /api/p/:pid/config`. */
async function config(read: ProjectRead): Promise<ProjectConfig> {
  const { view } = read;
  const [dna, paths, workflows, types] = await Promise.all([
    read.settle(view.dna()),
    read.settle(view.paths()),
    read.settle(view.workflows()),
    read.settle(view.memoryTypes(), '.wingfoil/'),
  ]);
  const resolved = (yaml: MemoryYaml): MemoryYaml => ({
    ...yaml,
    types: Object.fromEntries(
      Object.entries(yaml.types).map(([name, def]) => [name, { ...def, states: resolveStates(yaml, name)! }]),
    ),
  });
  return {
    dna: section(dna),
    paths: section(paths),
    workflows: section(workflows),
    types: types.ok ? { data: resolved(types.value) } : { error: types.refusal.error },
  };
}

/** `GET /api/p/:pid/elements[?archived=true]`. */
function elements(read: ProjectRead, archived: boolean): Promise<ElementList> {
  const { view } = read;
  return view.derived(`elements ${String(archived)}`, async () => {
    const list = await view.elements();
    const matches = [...list.matches];
    if (archived) {
      for (const status of ARCHIVED_STATES) matches.push(...(await view.archivedElements(status)).matches);
    }
    const inputs = await read.descriptorInputs();
    const listed: ListedElement[] = matches.map(({ match, localChanges }) => ({
      ...match,
      localChanges,
      ...(inputs.ok ? { descriptor: inputs.describe(match, localChanges) } : {}),
    }));
    return {
      elements: listed,
      warnings: list.warnings,
      ...(list.message !== undefined ? { message: list.message } : {}),
      ...(inputs.ok ? {} : { typesError: inputs.refusal.error }),
    };
  });
}

/** `GET /api/p/:pid/elements/:eid`. */
async function element(read: ProjectRead, id: string): Promise<ElementDetail> {
  const found = valueOf(await read.settle(read.view.element(id)));
  if (!found) throw notFound();
  const inputs = await read.descriptorInputs();
  const { match, content, localChanges } = found;
  return {
    element: { ...match, localChanges },
    frontmatter: content.frontmatter,
    body: content.body,
    ...(inputs.ok
      ? {
          descriptor: inputs.describe(match, localChanges),
          required: requiredFields(inputs.memoryYaml, match.type, content.frontmatter),
        }
      : {}),
  };
}

/** `GET /api/p/:pid/directives`. */
async function directives(read: ProjectRead): Promise<DirectiveList> {
  const { view, entry } = read;
  const [list, dna] = await Promise.all([view.directives(), read.settle(view.dna())]);
  const { roleView } = identityView(identityOf(view, membersOf(dna)), entry.roleView);
  const mine = new Set(directivesForRoleView(list.data.entries, roleView));
  return {
    entries: list.data.entries.map((e) => ({ ...e, mine: mine.has(e) })),
    warnings: list.data.warnings,
  };
}

/** `GET /api/p/:pid/directives/:did`. */
async function directive(read: ProjectRead, id: string): Promise<DirectiveDetail> {
  const found = valueOf(await read.settle(read.view.directive(id), '.wingfoil/'));
  if (!found) throw notFound();
  return { entry: found.entry, frontmatter: found.content.frontmatter, body: found.content.body };
}

/** `GET /api/p/:pid/docs`. */
function docs(read: ProjectRead): Promise<DocumentationIndex> {
  return read.view.derived('docs', async () => {
    const scope = await read.documentationScope();
    const paths = await read.view.paths();
    return { roots: paths.data.docs ?? [], documents: await documentationIndex(read.root, scope) };
  });
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
          const read = new ProjectRead(entry, snapshot.root, view, request.log);
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
    return (await read.view.history(params.eid)).data;
  });
  route(`${PROJECT_PATH}/directives`, directives);
  route<{ did: string }>(`${PROJECT_PATH}/directives/:did`, (read, params) => directive(read, params.did));
  route(`${PROJECT_PATH}/docs`, docs);
  route<object, { path?: string }>(
    `${PROJECT_PATH}/files/tree`,
    (read, _p, query) => listDirectory(read.root, query.path ?? ''),
    pathQuery(false),
  );
  route<object, { path: string }>(
    `${PROJECT_PATH}/files/content`,
    async (read, _p, query) => readWorkingTreeFile(read.root, query.path, await read.documentationScope()),
    pathQuery(true),
  );
}
