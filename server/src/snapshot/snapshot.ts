/**
 * The snapshot of one project (adr-001 D6, REQ-STATE-01/02, REQ-PERF-05): the last observed
 * repository state and the reads cached for it.
 *
 * - **State.** {@link ProjectSnapshot.check} reads git (2 processes: status, `user.email`);
 *   concurrent checks are coalesced (one running, at most one queued). A read request never
 *   checks: it uses the last state, moved only by the repository watcher and the periodic check
 *   (`snapshots.ts`) — so reopening a view with no change starts no process (S-26.3). Writes
 *   (spec-004 §4 rows 7–9) must not trust it: they read git fresh, under the write lock.
 * - **Cache.** A {@link SnapshotView} is bound to one state; its reads are memoised per
 *   `<CLI generation>:<HEAD>.<status hash>:<user.email>` and shared by every caller of that key:
 *   one CLI process per command and state. CLI refusals, unreadable output and direct-read errors
 *   are kept for the state (they would answer the same); timeouts and process failures are not.
 * - **CLI.** `discoverCli` runs once per CLI generation; {@link ProjectSnapshot.cliChanged}
 *   (`node_modules/wingfoil` changed) starts a new one (task-004 hand-over).
 * - **Marker.** An element carries *local changes* when its file is in the working-tree status
 *   (REQ-STATE-01).
 */
import type { DirectivesList, DnaPaths, DnaShow, MemoryMatch, MemoryYaml, WorkflowList } from '@wingfoil-ui/contracts';
import { CliOutputError, CliRefusedError, type CliOutput, type WingfoilCli } from '../cli/adapter.js';
import type { CliCommandOutputs } from '../cli/commands.js';
import { CliNotFoundError, type ResolvedCli } from '../cli/discovery.js';
import type { GitReads } from '../git/git.js';
import { DirectReadError, type ReadFs } from '../reads/confine.js';
import {
  directiveInForce,
  ProjectReads,
  type ArchivedStatus,
  type DirectiveRead,
  type ElementRead,
} from '../reads/project-reads.js';
import { repoState, sameState, type RepoState } from './state.js';

/** Options of {@link ProjectSnapshot}. */
export interface ProjectSnapshotOptions {
  /** Opaque project id (the `pid` of the `repo` event). */
  pid: string;
  /** Project root (realpath). */
  root: string;
  /** The project folder relative to the repository's top level (`GitLayout.prefix`). */
  prefix: string;
  git: GitReads;
  /** Resolves the project's CLI (`discoverCli`), once per CLI generation. */
  discover: () => Promise<ResolvedCli>;
  /** The adapter for a resolved CLI. */
  cli: (resolved: ResolvedCli) => WingfoilCli;
  /** Read port of the direct reads (default: the local file system). */
  fs?: ReadFs;
  /** Called when a check finds a new state, or the CLI changed (not for the first state). */
  onChange?: (state: RepoState) => void;
}

/** A `memory search` match with its marker. */
export interface MarkedElement {
  match: MemoryMatch;
  /** The element's file is in the working-tree status (REQ-STATE-01). */
  localChanges: boolean;
}

/** A `memory search` result with the markers. */
export interface ElementList {
  matches: MarkedElement[];
  /** The CLI's warnings (stderr lines). */
  warnings: string[];
  /** The CLI's message when nothing matched. */
  message?: string;
}

/** An element read with its marker. */
export interface MarkedElementRead extends ElementRead {
  localChanges: boolean;
}

interface Generation {
  id: number;
  tools: Promise<{ cli: WingfoilCli; reads: ProjectReads }>;
}

/** Errors a repeated read in the same state would raise again: kept for the state. */
function deterministic(error: unknown): boolean {
  return (
    error instanceof CliRefusedError ||
    error instanceof CliOutputError ||
    error instanceof DirectReadError ||
    error instanceof CliNotFoundError
  );
}

/** The snapshot of one project. */
export class ProjectSnapshot {
  /** Opaque project id. */
  readonly pid: string;
  /** Project root. */
  readonly root: string;
  private last: RepoState | undefined;
  private running: Promise<RepoState> | undefined;
  private queued: Promise<RepoState> | undefined;
  private generationId = 0;
  private generation: Generation | undefined;
  private memo: { key: string; values: Map<string, Promise<unknown>> } | undefined;

  constructor(private readonly options: ProjectSnapshotOptions) {
    this.pid = options.pid;
    this.root = options.root;
  }

  /** The last observed state, or `undefined` before the first check. */
  current(): RepoState | undefined {
    return this.last;
  }

  /** The last observed state; the first call checks. */
  state(): Promise<RepoState> {
    return this.last ? Promise.resolve(this.last) : this.check();
  }

  /**
   * Read git now and move to the state found; publishes it (`onChange`) when it differs from the
   * previous one. A check asked while one runs is queued once, so a change made during the
   * running check is not missed.
   */
  check(): Promise<RepoState> {
    if (this.queued) return this.queued;
    if (this.running) {
      const start = (): Promise<RepoState> => {
        // Running from now on: a check asked meanwhile queues the next one.
        this.queued = undefined;
        return this.runCheck();
      };
      this.queued = this.running.then(start, start);
      return this.queued;
    }
    return this.runCheck();
  }

  /** The project's CLI may have changed: the next view resolves it again and reads afresh. */
  cliChanged(): void {
    this.generationId += 1;
    if (this.last) this.options.onChange?.(this.last);
  }

  /** A view bound to the last observed state (the first call checks). */
  async view(): Promise<SnapshotView> {
    const state = await this.state();
    const generation = this.generationId;
    const key = `${generation}:${state.key}:${state.email ?? ''}`;
    if (this.memo?.key !== key) this.memo = { key, values: new Map() };
    const values = this.memo.values;
    const memo = <T>(name: string, read: (tools: Awaited<Generation['tools']>) => Promise<T>): Promise<T> => {
      let value = values.get(name) as Promise<T> | undefined;
      if (!value) {
        value = this.tools(generation).then(read);
        values.set(name, value);
        value.catch((error: unknown) => {
          if (!deterministic(error) && values.get(name) === value) values.delete(name);
        });
      }
      return value;
    };
    return new SnapshotView(state, memo);
  }

  private runCheck(): Promise<RepoState> {
    const run = (async () => {
      const [status, email] = await Promise.all([this.options.git.status(), this.options.git.email()]);
      const next = repoState(status, email, this.options.prefix);
      const previous = this.last;
      this.last = next;
      if (previous && !sameState(previous, next)) this.options.onChange?.(next);
      return next;
    })();
    this.running = run;
    const clear = (): void => {
      if (this.running === run) this.running = undefined;
    };
    void run.then(clear, clear);
    return run;
  }

  private tools(id: number): Generation['tools'] {
    if (this.generation?.id !== id) {
      const tools = this.options.discover().then((resolved) => {
        const cli = this.options.cli(resolved);
        const reads = new ProjectReads({
          root: this.options.root,
          cli,
          ...(this.options.fs ? { fs: this.options.fs } : {}),
        });
        return { cli, reads };
      });
      const generation: Generation = { id, tools };
      this.generation = generation;
      // A discovery that failed for another reason than "no CLI" is retried by the next read.
      tools.catch((error: unknown) => {
        if (!(error instanceof CliNotFoundError) && this.generation === generation) this.generation = undefined;
      });
    }
    return this.generation.tools;
  }
}

type Memo = <T>(name: string, read: (tools: { cli: WingfoilCli; reads: ProjectReads }) => Promise<T>) => Promise<T>;

/**
 * The reads of one project in one repository state, cached (REQ-PERF-05). Build it with
 * {@link ProjectSnapshot.view}; every method of every view of the same state shares one result.
 */
export class SnapshotView {
  /** @internal */
  constructor(
    /** The state this view reads; its `key` is the `X-Repo-State` header (spec-004 §5). */
    readonly state: RepoState,
    private readonly memo: Memo,
  ) {}

  /** True when the file at `path` (relative to the project root) has local changes (REQ-STATE-01). */
  hasLocalChanges(path: string): boolean {
    return this.state.changed.has(path);
  }

  /** `wingfoil --version`, as text. */
  version(): Promise<string> {
    return this.memo('--version', ({ cli }) => cli.version());
  }

  /** `dna show`. */
  dna(): Promise<CliOutput<DnaShow>> {
    return this.memo('dna show', ({ reads }) => reads.dna());
  }

  /** `paths`. */
  paths(): Promise<CliOutput<DnaPaths>> {
    return this.memo('paths', ({ reads }) => reads.paths());
  }

  /** `workflow list`. */
  workflows(): Promise<CliOutput<WorkflowList>> {
    return this.memo('workflow list', ({ reads }) => reads.workflows());
  }

  /** `directives list`. */
  directives(): Promise<CliOutput<DirectivesList>> {
    return this.memo('directives list', ({ reads }) => reads.directives());
  }

  /** `memory search` (the elements that are not archived), each with its marker. */
  async elements(): Promise<ElementList> {
    return this.mark(await this.search());
  }

  /** `memory search --status <status>`, each with its marker. */
  async archivedElements(status: ArchivedStatus): Promise<ElementList> {
    return this.mark(await this.archived(status));
  }

  /** `memory history <id>`. */
  history(id: string): Promise<CliOutput<CliCommandOutputs['memory history']>> {
    return this.memo(`memory history\0${id}`, ({ reads }) => reads.history(id));
  }

  /** The type definitions (`.wingfoil/memory.yaml`, direct read). */
  memoryTypes(): Promise<MemoryYaml> {
    return this.memo('memory.yaml', ({ reads }) => reads.memoryTypes());
  }

  /**
   * The element `id`, looked up in the cached `memory search`, then in the archived lists (each
   * run at most once per state); its file read once per state. `undefined` when the CLI lists no
   * element with that id.
   */
  async element(id: string): Promise<MarkedElementRead | undefined> {
    let match = (await this.search()).data.matches.find((m) => m.id === id);
    for (const status of ['deprecated', 'superseded'] as const) {
      match ??= (await this.archived(status)).data.matches.find((m) => m.id === id);
    }
    if (!match) return undefined;
    const found = match;
    const content = await this.memo(`element\0${found.path}`, ({ reads }) => reads.elementFromMatch(found));
    return { match: found, content, localChanges: this.hasLocalChanges(found.path) };
  }

  /** The directive `id` (the one in force when several files declare it), from the cached list. */
  async directive(id: string): Promise<DirectiveRead | undefined> {
    const entry = directiveInForce((await this.directives()).data, id);
    if (!entry) return undefined;
    const content = await this.memo(`directive\0${entry.path}`, ({ reads }) => reads.directiveFromEntry(entry));
    return { entry, content };
  }

  private search(): Promise<CliOutput<CliCommandOutputs['memory search']>> {
    return this.memo('memory search', ({ reads }) => reads.elements());
  }

  private archived(status: ArchivedStatus): Promise<CliOutput<CliCommandOutputs['memory search']>> {
    return this.memo(`memory search --status ${status}`, ({ reads }) => reads.archivedElements(status));
  }

  private mark(output: CliOutput<CliCommandOutputs['memory search']>): ElementList {
    const { matches, message } = output.data;
    return {
      matches: matches.map((match) => ({ match, localChanges: this.hasLocalChanges(match.path) })),
      warnings: output.warnings,
      ...(message !== undefined ? { message } : {}),
    };
  }
}
