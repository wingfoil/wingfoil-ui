/**
 * The snapshot of one project (adr-001 D6, REQ-STATE-01/02, REQ-PERF-05): the last observed
 * repository state and the reads cached for it.
 *
 * - **State.** {@link ProjectSnapshot.check} reads git (3–4 processes: status, `user.email`,
 *   `git remote`, and `branch.<b>.remote` when an upstream is printed — spec-010 §1, task-033 D33-7);
 *   concurrent checks are coalesced (one running, at most one queued). A read request never
 *   checks: it uses the last state, moved only by the repository watcher and the periodic check
 *   (`snapshots.ts`) — so reopening a view with no change starts no process (S-26.3). Writes
 *   (spec-004 §4 rows 7–9) must not trust it: they read git fresh, under the write lock.
 * - **Cache.** A {@link SnapshotView} is bound to one state; its reads are memoised per
 *   `<CLI generation>:<HEAD>.<working-tree hash>:<user.email>` (the state's `contentKey`: a fetch
 *   that moves only a tracking ref re-runs no CLI read, task-033 D33-6), its derived values (the
 *   descriptors, which hold the copy) per full state key, and shared by every caller of that key:
 *   one CLI process per command and state. CLI refusals, unreadable output and direct-read errors
 *   are kept for the state (they would answer the same); timeouts and process failures are not.
 * - **CLI.** `discoverCli` runs once per CLI generation; {@link ProjectSnapshot.cliChanged}
 *   (`node_modules/wingfoil` changed) starts a new one (task-004 hand-over).
 * - **Marker.** An element carries *local changes* when its file is in the working-tree status
 *   (REQ-STATE-01).
 * - **Events.** The project-wide Memory events (spec-002 §3, one `git log -p`) are cached per HEAD
 *   and set of Memory directories (spec-002 §4: the working tree does not change them).
 * - **Version.** The detected CLI version comes from the registry's {@link VersionCache}: one
 *   `--version` per CLI resolution (adr-001 D3).
 */
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import type { DirectivesList, DnaPaths, DnaShow, MemoryMatch, MemoryYaml, WorkflowList } from '@wingfoil-ui/contracts';
import { CliOutputError, CliRefusedError, type CliOutput, type WingfoilCli } from '../cli/adapter.js';
import type { CliCommandOutputs } from '../cli/commands.js';
import { CliNotFoundError, type ResolvedCli } from '../cli/discovery.js';
import type { DetectedVersion } from '../cli/version.js';
import { VersionCache } from '../cli/version.js';
import { GitReadError, UNBORN_HEAD, type CommitSummary, type GitReads } from '../git/git.js';
import {
  eventsByElement,
  memoryDirectories,
  MemoryLogFormatError,
  parseMemoryLog,
  type MemoryEvent,
} from '../git/memory-log.js';
import { ARCHIVED_STATES } from '../presets/wingfoil.js';
import { DirectReadError, type ReadFs } from '../reads/confine.js';
import {
  directiveInForce,
  ProjectReads,
  type ArchivedStatus,
  type DirectiveRead,
  type ElementRead,
} from '../reads/project-reads.js';
import { combinedHash, Fingerprinter } from './fingerprint.js';
import { repoState, sameState, type RepoState } from './state.js';

/** git's markers of an operation in progress, in the worktree's git directory (task-034 D34-3). */
export const OPERATION_MARKERS: readonly string[] = [
  'rebase-apply',
  'rebase-merge',
  'MERGE_HEAD',
  'CHERRY_PICK_HEAD',
  'REVERT_HEAD',
  'sequencer',
  'BISECT_LOG',
];

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
  /** The detected versions, shared by the server (default: one of its own). */
  versions?: VersionCache;
  /** Where parse warnings of the Memory events go (`{ pid, sha }` only). */
  logger?: { warn(object: object, message: string): void };
  /**
   * The repository's git common directory (realpath): the key of the write lock (task-032, D32-2).
   * Default: the project root.
   */
  commonDir?: string;
  /** The git directory (absolute), for the redaction of git's messages (task-033 D33-5). */
  gitDir?: string;
}

/** The Memory events of each element, oldest first (spec-002 §3). */
export type ElementEvents = ReadonlyMap<string, readonly MemoryEvent[]>;

/** The parsed Memory events of one HEAD: newest first as git lists them, and per element. */
interface MemoryEvents {
  all: readonly MemoryEvent[];
  byElement: ElementEvents;
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
    error instanceof CliNotFoundError ||
    sameForHead(error)
  );
}

/** Failures of the Memory event read that the same HEAD would give again (review round 3, M2). */
function sameForHead(error: unknown): boolean {
  return error instanceof MemoryLogFormatError || (error instanceof GitReadError && error.ended === 'overflow');
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
  private derivedMemo: { key: string; values: Map<string, Promise<unknown>> } | undefined;

  private readonly fingerprints: Fingerprinter;
  private readonly versions: VersionCache;
  private events: { key: string; value: Promise<MemoryEvents> } | undefined;
  private originCache: { key: string; value: Promise<string> } | undefined;

  constructor(private readonly options: ProjectSnapshotOptions) {
    this.pid = options.pid;
    this.root = options.root;
    const depth = options.prefix.split('/').filter(Boolean).length;
    this.fingerprints = new Fingerprinter(
      path.resolve(options.root, ...Array<string>(depth).fill('..')),
      options.prefix,
    );
    this.versions = options.versions ?? new VersionCache();
  }

  /** The last observed state, or `undefined` before the first check. */
  current(): RepoState | undefined {
    return this.last;
  }

  /** The last observed state; the first call checks. */
  state(): Promise<RepoState> {
    if (this.last) return Promise.resolve(this.last);
    // Concurrent first views share the first check.
    return this.queued ?? this.running ?? this.check();
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

  /**
   * Key of the write lock (adr-001 D5, task-032 D32-2): the repository's git common directory, so
   * two listed projects in one repository (sub-folders, linked worktrees) queue together.
   */
  get lockKey(): string {
    return this.options.commonDir ?? this.root;
  }

  /** The repository's git common directory (the git directory when unknown), task-034 W4-7. */
  get commonDir(): string {
    return this.options.commonDir ?? this.options.gitDir ?? path.join(this.topLevel, '.git');
  }

  /** The git reads and transport of the project (task-033). */
  get git(): GitReads {
    return this.options.git;
  }

  /** The project folder relative to the repository's top level (`""` or ending in `/`). */
  get prefix(): string {
    return this.options.prefix;
  }

  /** The repository's top level (absolute): where git resolves a remote's relative path. */
  get topLevel(): string {
    const depth = this.options.prefix.split('/').filter(Boolean).length;
    return path.resolve(this.root, ...Array<string>(depth).fill('..'));
  }

  /**
   * The local folders a git or CLI message may quote, for `redactLocalPaths` (task-033 D33-5):
   * the project root and the repository's top level, git directory and common directory.
   */
  get localRoots(): { project: string[]; repository: string[] } {
    const top = this.topLevel;
    const repository = [top, this.options.gitDir, this.options.commonDir].filter((p): p is string => p !== undefined);
    return { project: [this.root], repository };
  }

  /**
   * Whether a git operation is in progress in this worktree (task-034 D34-3): one of git's own
   * markers (`wt-status.c`) in its git directory — a stopped `am` or rebase, a merge, cherry-pick or
   * revert not concluded, a sequence, a bisect. File checks only, no process; `false` without a
   * known git directory.
   */
  async operationInProgress(): Promise<boolean> {
    const gitDir = this.options.gitDir;
    if (gitDir === undefined) return false;
    const found = await Promise.all(
      OPERATION_MARKERS.map((name) =>
        lstat(path.join(gitDir, name)).then(
          () => true,
          () => false,
        ),
      ),
    );
    return found.includes(true);
  }

  /** {@link GitReads.sameEntryEverywhere} for a write (D32-1, review S2). */
  sameEntryEverywhere(file: string): Promise<boolean> {
    return this.options.git.sameEntryEverywhere(file);
  }

  /**
   * Whether the commit `sha` is a write on `file` (relative to the project root; review S4): it
   * changes that path only, and holds there the blob the working tree holds now (the file the CLI
   * just wrote).
   */
  async isWriteCommit(sha: string, file: string): Promise<boolean> {
    const changed = await this.options.git.changedPaths(sha);
    if (changed.length !== 1 || changed[0] !== `${this.options.prefix}${file}`) return false;
    const [committed, written] = await Promise.all([
      this.options.git.fileAt(sha, file),
      this.options.git.worktreeBlob(file),
    ]);
    return committed !== undefined && committed.blob === written;
  }

  /** {@link GitReads.commitsSince}: the commits a write made (D32-4). */
  commitsSince(before: string): Promise<CommitSummary[]> {
    return this.options.git.commitsSince(before);
  }

  /** The adapter of the current CLI generation (resolved on first use), for a write. */
  async cli(): Promise<WingfoilCli> {
    return (await this.tools(this.generationId)).cli;
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
    // The CLI reads on what the CLI can see (D33-6); derived values (descriptors) on the full key.
    const key = `${generation}:${state.contentKey}:${state.email ?? ''}`;
    if (this.memo?.key !== key) this.memo = { key, values: new Map() };
    const fullKey = `${generation}:${state.key}:${state.email ?? ''}`;
    if (this.derivedMemo?.key !== fullKey) this.derivedMemo = { key: fullKey, values: new Map() };
    const readValues = this.memo.values;
    const derivedValues = this.derivedMemo.values;
    const memo = <T>(name: string, read: (tools: Awaited<Generation['tools']>) => Promise<T>): Promise<T> => {
      const values = name.startsWith('derived\0') ? derivedValues : readValues;
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
    return new SnapshotView(state, memo, {
      events: (dirs) => this.memoryEvents(state.head, dirs),
      origin: () => this.origin(state.key),
      versions: this.versions,
    });
  }

  /**
   * The Memory events at `head` over `dirs`: one `git log -p <head>` and its sha list per HEAD and
   * set of directories, shared by concurrent callers; a refused shape or an oversized log is kept
   * for the HEAD, other failures are not. An unborn HEAD has none.
   */
  private memoryEvents(head: string, dirs: readonly string[]): Promise<MemoryEvents> {
    const key = `${head}\0${dirs.join('\0')}`;
    if (this.events?.key === key) return this.events.value;
    const value = (async (): Promise<MemoryEvents> => {
      if (head === UNBORN_HEAD) return { all: [], byElement: new Map() };
      const [stdout, shas] = await Promise.all([
        this.options.git.memoryLog(dirs, head),
        this.options.git.memoryLogShas(dirs, head),
      ]);
      const log = parseMemoryLog(stdout, shas);
      for (const sha of log.warnings) {
        this.options.logger?.warn({ pid: this.pid, sha }, 'memory event skipped or without a status line');
      }
      return { all: log.events, byElement: eventsByElement(log.events) };
    })();
    const entry = { key, value };
    this.events = entry;
    // A refused shape or an oversized log answers the same for this HEAD: kept, like the
    // deterministic read errors; transient failures (timeout, spawn) are read again.
    value.catch((error: unknown) => {
      if (!sameForHead(error) && this.events === entry) this.events = undefined;
    });
    return value;
  }

  /** The URL of `origin`, read once per state (a failed read is not kept). */
  private origin(key: string): Promise<string> {
    if (this.originCache?.key === key) return this.originCache.value;
    const entry = { key, value: this.options.git.origin() };
    this.originCache = entry;
    entry.value.catch(() => {
      if (this.originCache === entry) this.originCache = undefined;
    });
    return entry.value;
  }

  private runCheck(): Promise<RepoState> {
    const run = (async () => {
      const git = this.options.git;
      const [status, email, remotes] = await Promise.all([git.status(), git.email(), git.remotes()]);
      // spec-010 §1: a remote upstream is one whose `branch.<b>.remote` is a listed remote.
      const branchRemote =
        status.upstream !== undefined && status.branch
          ? await git.configValue(`branch.${status.branch}.remote`)
          : undefined;
      // The content of the listed files too: a second edit of a modified or untracked file leaves
      // the porcelain status unchanged (review F1).
      const fingerprint = await this.fingerprints.fingerprint(status.entries);
      const next = repoState({ ...status, hash: combinedHash(status.hash, fingerprint) }, email, this.options.prefix, {
        remotes,
        ...(branchRemote !== undefined ? { branchRemote } : {}),
      });
      const previous = this.last;
      this.last = next;
      const cliFound = await this.cliFoundAgain();
      if (previous && (!sameState(previous, next) || cliFound)) this.options.onChange?.(next);
      return next;
    })();
    this.running = run;
    const clear = (): void => {
      if (this.running === run) this.running = undefined;
    };
    void run.then(clear, clear);
    return run;
  }

  /**
   * When the current CLI generation found no CLI (a `PATH` change is not watched), look again at
   * each check; a CLI found starts a new generation (review F9). Discovery reads files only.
   */
  private async cliFoundAgain(): Promise<boolean> {
    const generation = this.generation;
    if (!generation || generation.id !== this.generationId) return false;
    const missing = await generation.tools.then(
      () => false,
      (error: unknown) => error instanceof CliNotFoundError,
    );
    if (!missing) return false;
    try {
      await this.options.discover();
    } catch {
      return false;
    }
    if (this.generationId === generation.id) this.generationId += 1;
    return true;
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

/** What a view reads beyond its memo: the snapshot's event cache and the version cache. */
interface ViewSources {
  events(dirs: readonly string[]): Promise<MemoryEvents>;
  origin(): Promise<string>;
  versions: VersionCache;
}

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
    private readonly sources: ViewSources,
  ) {}

  /**
   * A value derived from this view's reads (e.g. the action descriptors), computed once per state
   * and shared like the reads; `name` must not collide with a read's (use a `derived:` prefix).
   */
  derived<T>(name: string, compute: () => Promise<T>): Promise<T> {
    return this.memo(`derived\0${name}`, () => compute());
  }

  /**
   * The URL of `origin` (`""` without one), read once per state: a `git remote set-url` alone does
   * not move the state, so it is seen with the next state change.
   */
  origin(): Promise<string> {
    return this.sources.origin();
  }

  /** The project's CLI version against the supported range (one `--version` per CLI resolution). */
  detected(): Promise<DetectedVersion> {
    return this.memo('detected version', ({ cli }) => this.sources.versions.detect(cli));
  }

  /**
   * The Memory events of every element, oldest first (spec-002 §3), from one `git log -p` over the
   * Memory directories of `memory.yaml` — cached per HEAD. Rejects as {@link memoryTypes} does.
   */
  events(): Promise<ElementEvents> {
    return this.memoryEvents().then((events) => events.byElement);
  }

  /**
   * The Memory events of the project, newest first in git's order (spec-002 §3; the bell's
   * *Updates*, spec-004 §3): the same read and cache as {@link events}, no other process.
   */
  eventLog(): Promise<readonly MemoryEvent[]> {
    return this.memoryEvents().then((events) => events.all);
  }

  private memoryEvents(): Promise<MemoryEvents> {
    return this.memo('memory events', async () => this.sources.events(memoryDirectories(await this.memoryTypes())));
  }

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
    for (const status of ARCHIVED_STATES) {
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
