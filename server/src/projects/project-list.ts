/**
 * The project list (spec-006 §2–§3, REQ-STATE-07): add a local folder, clone a remote into a new
 * empty folder and add it, remove an entry, and the list with the availability of each entry,
 * computed on every read. Every refusal is a {@link ProjectRefusal} (422, spec-006 §3) and leaves
 * the state file and the file system unchanged.
 *
 * Order of the work of an add: the checks that read files (folder, `.wingfoil/`, same path, state
 * directory), the processes (`git remote get-url origin`, then the duplicate remote, the CLI
 * discovery, `dna show` for the name) — and only then a short transaction on the store that checks
 * the duplicates again against the list re-read under its lock (another console) and appends the
 * entry. A clone checks the typed URL against the list **before** cloning, refuses a working
 * directory inside a listed project or the state directory, and runs no CLI of the cloned
 * repository: it is listed under its folder name, whatever its availability (`cli-not-found`
 * included).
 *
 * The `projects` event (spec-004 §6) is published after an add or a remove, and by {@link
 * ProjectList.check} when the list (another console) or an availability differs from the last one
 * seen; the check runs on every list read and periodically ({@link ProjectList.start}). It reads
 * files only — no process (REQ-INT-09).
 */
import { realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Availability, ProjectEntry, ProjectListItem, ProjectRefusalCode } from '@wingfoil-ui/contracts';
import { CliOutputError, CliRefusedError, WingfoilCli, type CliLogger } from '../cli/adapter.js';
import { CliNotFoundError, discoverCli, INSTALL_COMMAND } from '../cli/discovery.js';
import type { EventBus } from '../events/bus.js';
import { GitReadError, GitReads, resolveGit } from '../git/git.js';
import type { ProcessRunner } from '../process/runner.js';
import type { WriteLock } from '../process/write-lock.js';
import { ProjectReads } from '../reads/project-reads.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import { findProjectContaining, isWithin, realpathLoose } from '../state/location.js';
import type { StateStore } from '../state/store.js';
import { CloneTarget, GitCloneError, runClone } from './clone.js';
import { cloneSourceProblem, repoName, sameRemote } from './remote.js';

/** Interval of the availability check, in milliseconds (the snapshot fallback's). */
export const DEFAULT_CHECK_MS = 10_000;

/**
 * Write-lock key of the clones: one clone at a time, so that two clones of the same remote or into
 * the same folder cannot race. Not a project id (`p_…`) and never a user path.
 */
export const CLONE_LOCK_KEY = 'clone';

/** Refusal codes of spec-006 §3 (`contracts/api/projects.refusal.schema.json`). */
export type RefusalCode = ProjectRefusalCode;

/** A refused add or clone (422, spec-006 §3): the list and the file system are unchanged. */
export class ProjectRefusal extends Error {
  constructor(
    readonly code: RefusalCode,
    message: string,
    /** The catalogue arguments (spec-008 §4); none for `git-refused`, whose message is git's. */
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ProjectRefusal';
  }
}

/** A request the route's schema cannot judge (a relative path, a URL starting with `-`): 400. */
export class InvalidProjectRequest extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProjectRequest';
  }
}

/** Where the list logs (pino's `Logger` fits). */
export interface ProjectListLogger extends CliLogger {
  warn(object: object, message: string): void;
}

/** Options of {@link ProjectList}. */
export interface ProjectListOptions {
  store: StateStore;
  /** Opened on add, closed on remove (task-010). */
  snapshots: Snapshots;
  /** Where `projects` goes. */
  bus: EventBus;
  /** Runner of git and of the CLI (the launcher's). */
  runner: ProcessRunner;
  /** Queue of the clones ({@link CLONE_LOCK_KEY}). */
  writeLock: WriteLock;
  /** The local state directory: never inside a listed project (spec-006 §1). */
  stateDir: string;
  /** Environment of git, of the CLI and of the discovery (default: the server's). */
  env?: NodeJS.ProcessEnv;
  /** Home directory a leading `~` stands for (default: `os.homedir()`). */
  homedir?: string;
  logger?: ProjectListLogger;
}

/** A clone request (`POST /api/projects/clone`). */
export interface CloneInput {
  url: string;
  directory?: string;
}

async function isDirectory(target: string): Promise<boolean> {
  return (await stat(target).catch(() => undefined))?.isDirectory() ?? false;
}

/** The list and its operations. */
export class ProjectList {
  private readonly env: NodeJS.ProcessEnv;
  private readonly homedir: string;
  /** Availability by id at the last check (the list's order included in the key). */
  private seen: string | undefined;
  private timer: NodeJS.Timeout | undefined;
  /** Token of the periodic check started last; `undefined` once stopped. */
  private run: object | undefined;
  private git: Promise<string> | undefined;
  /** Working directories of the clones running now (absolute). */
  private readonly cloning = new Set<string>();

  constructor(private readonly options: ProjectListOptions) {
    this.env = options.env ?? process.env;
    this.homedir = options.homedir ?? os.homedir();
  }

  /** The list, re-read from the state file (another console), with each entry's availability. */
  async list(): Promise<ProjectListItem[]> {
    const items = await Promise.all((await this.options.store.reload()).map((p) => this.item(p)));
    this.observe(items);
    return items;
  }

  /** Recompute the list and publish `projects` when it differs from the last one seen. */
  async check(): Promise<void> {
    await this.list();
  }

  /** Run {@link check} every `intervalMs` (default {@link DEFAULT_CHECK_MS}); `0` runs nothing. */
  start(intervalMs = DEFAULT_CHECK_MS): void {
    this.stop();
    if (intervalMs <= 0) return;
    const run = {};
    this.run = run;
    const tick = (): void => {
      // Stopped (or restarted) while a check was running: schedule nothing more.
      if (this.run !== run) return;
      this.timer = setTimeout(() => {
        this.check().then(tick, (error: unknown) => {
          this.options.logger?.warn({ kind: (error as Error).name }, 'project list check failed');
          tick();
        });
      }, intervalMs);
      this.timer.unref();
    };
    tick();
  }

  /** Stop the periodic check (stop sequence). */
  stop(): void {
    this.run = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Add the local folder `given` (`POST /api/projects`). */
  async add(given: string, signal?: AbortSignal): Promise<ProjectListItem> {
    const shown = given.trim();
    const absolute = this.absolute(shown, 'path');
    const root = await realpath(absolute).catch(() => undefined);
    // A folder a clone is writing: wait for that clone (it may list it, or remove it), then judge
    // the folder as it is. Inside the clone queue no other clone runs, so this add cannot race one.
    if (this.inClone(root ?? (await realpathLoose(absolute)))) return this.addAfterClone(shown, absolute, signal);
    return this.addNow(shown, root, signal, false);
  }

  private addAfterClone(shown: string, absolute: string, signal?: AbortSignal): Promise<ProjectListItem> {
    return this.options.writeLock.run(CLONE_LOCK_KEY, async () =>
      this.addNow(shown, await realpath(absolute).catch(() => undefined), signal, true),
    );
  }

  private async addNow(
    shown: string,
    root: string | undefined,
    signal: AbortSignal | undefined,
    queued: boolean,
  ): Promise<ProjectListItem> {
    if (root === undefined || !(await isDirectory(root))) {
      throw new ProjectRefusal('folder-not-found', `Folder not found: ${shown}`, { path: shown });
    }
    await this.checkWingfoil(root, { path: shown });
    const listed = await this.options.store.reload();
    this.refuseSamePath(listed, root);
    await this.refuseStateDirInside(root, shown);
    const remote = await this.origin(root);
    this.refuseSameRemote(listed, remote);
    const name = await this.name(root, shown, signal);
    // A clone started into this folder meanwhile: let it finish first.
    if (!queued && this.inClone(root)) return this.addAfterClone(shown, root, signal);
    return this.append({ path: root, name, remote });
  }

  /** Clone `input.url` into a new, empty folder and add it (`POST /api/projects/clone`). */
  async clone(input: CloneInput, signal?: AbortSignal): Promise<ProjectListItem> {
    const url = input.url.trim();
    const problem = cloneSourceProblem(url);
    if (problem) throw new InvalidProjectRequest(problem);
    let shown = input.directory?.trim();
    if (shown === undefined) {
      const name = repoName(url);
      if (name === undefined) throw new InvalidProjectRequest('no folder name in the url: give a directory');
      shown = `~/projects/${name}`;
    }
    // Real path (through a symlinked parent too) once: the stored paths are real paths.
    const directory = await realpathLoose(this.absolute(shown, 'directory'));
    // The URL typed is compared before anything is cloned (spec-006 §3).
    this.refuseListed(await this.options.store.reload(), url, directory, shown);
    // Never into the local state (REQ-ARC-08), decided by the user 2026-10-06.
    if (isWithin(directory, await realpathLoose(this.options.stateDir))) {
      throw new ProjectRefusal(
        'inside-state-dir',
        `The working directory lies inside the local state directory: ${shown}`,
        {
          path: shown,
        },
      );
    }
    if (!(await CloneTarget.inspect(directory))) throw this.notEmpty(shown);
    await this.refuseStateDirInside(directory, shown);
    const git = await this.resolveGit();
    return this.options.writeLock.run(CLONE_LOCK_KEY, async () => {
      // Premises again: an earlier clone in the queue may have taken the folder or the remote.
      const listedBefore = await this.options.store.reload();
      this.refuseListed(listedBefore, url, directory, shown);
      const target = await CloneTarget.inspect(directory);
      if (!target) throw this.notEmpty(shown);
      const known = new Set(listedBefore.map((p) => p.id));
      this.cloning.add(directory);
      try {
        try {
          await runClone(url, target, {
            git,
            runner: this.options.runner,
            env: this.env,
            ...(signal ? { signal } : {}),
          });
        } catch (error) {
          if (error instanceof GitCloneError) throw new ProjectRefusal('git-refused', error.message);
          throw error;
        }
        const root = await realpath(directory);
        await this.checkWingfoil(root, { source: 'clone' });
        // No CLI of the cloned repository runs at clone time (it is code just downloaded, decided by
        // the user 2026-10-06): the folder name for now, the DNA name refreshed on the first open.
        const name = path.basename(root);
        return await this.append({ path: root, name, remote: url });
      } catch (error) {
        // Listed by its path by an entry added during the clone (a local add won the race): that
        // entry points at the clone, so the clone stays. An entry listed before the clone never
        // keeps it (it was refused above; this guards a re-pointed missing project).
        const listedHere =
          error instanceof ProjectRefusal &&
          error.code === 'already-listed' &&
          !error.detail?.sameRemote &&
          !known.has(String(error.detail?.pid));
        if (!listedHere) await target.discard();
        throw error;
      } finally {
        this.cloning.delete(directory);
      }
    });
  }

  /** Remove `pid` from the list (no file of the project is touched); `false` when not listed. */
  async remove(pid: string): Promise<boolean> {
    if ((await this.options.store.remove(pid)) === undefined) return false;
    await this.options.snapshots.close(pid);
    await this.publishChange();
    return true;
  }

  /** Whether `folder` is, or lies inside, the working directory of a running clone. */
  private inClone(folder: string): boolean {
    return [...this.cloning].some((dir) => isWithin(folder, dir));
  }

  private absolute(given: string, field: string): string {
    const expanded = given === '~' || /^~[\\/]/.test(given) ? path.join(this.homedir, given.slice(1)) : given;
    if (!path.isAbsolute(expanded)) throw new InvalidProjectRequest(`${field} must be absolute`);
    return path.resolve(expanded);
  }

  private async checkWingfoil(root: string, detail: Record<string, unknown>): Promise<void> {
    if (await isDirectory(path.join(root, '.wingfoil'))) return;
    const where = 'source' in detail ? 'the cloned repository' : String(detail.path);
    throw new ProjectRefusal('not-wingfoil', `Not a WingFoil project: no .wingfoil/ folder in ${where}`, detail);
  }

  private refuseSamePath(listed: readonly ProjectEntry[], root: string): void {
    const same = listed.find((p) => p.path === root);
    if (same) throw this.alreadyListed(same, false);
  }

  /** A clone: its remote, or its working directory (a listed folder that went missing), already listed. */
  private refuseListed(listed: readonly ProjectEntry[], url: string, directory: string, shown: string): void {
    this.refuseSameRemote(listed, url);
    this.refuseSamePath(listed, directory);
    // A clone never writes inside an existing repository (REQ-ARC-03), decided by the user 2026-10-06.
    if (listed.some((p) => isWithin(directory, p.path))) {
      throw new ProjectRefusal(
        'directory-inside-project',
        `The working directory lies inside a listed project: ${shown}`,
        {
          path: shown,
        },
      );
    }
  }

  private refuseSameRemote(listed: readonly ProjectEntry[], remote: string): void {
    const same = listed.find((p) => sameRemote(p.remote, remote));
    if (same) throw this.alreadyListed(same, true);
  }

  private alreadyListed(entry: ProjectEntry, remote: boolean): ProjectRefusal {
    return new ProjectRefusal('already-listed', `Already in the list: ${entry.name}`, {
      pid: entry.id,
      name: entry.name,
      sameRemote: remote,
    });
  }

  private notEmpty(shown: string): ProjectRefusal {
    return new ProjectRefusal('directory-not-empty', `The working directory is not empty: ${shown}`, { path: shown });
  }

  private async refuseStateDirInside(candidate: string, shown: string): Promise<void> {
    const entry = { id: '', path: candidate, name: '', remote: '', addedAt: '', roleView: '' };
    if (await findProjectContaining(this.options.stateDir, [entry])) {
      throw new ProjectRefusal('state-dir-inside-project', 'The local state directory lies inside this folder', {
        path: shown,
        stateDir: this.options.stateDir,
      });
    }
  }

  private resolveGit(): Promise<string> {
    if (!this.git) {
      const resolving = resolveGit(this.env);
      this.git = resolving;
      resolving.catch(() => {
        if (this.git === resolving) this.git = undefined;
      });
    }
    return this.git;
  }

  /** The URL of `origin` (`""` without one); a folder outside any repository is refused. */
  private async origin(root: string): Promise<string> {
    const git = new GitReads({ git: await this.resolveGit(), runner: this.options.runner, cwd: root, env: this.env });
    try {
      return await git.origin();
    } catch (error) {
      if (error instanceof GitReadError) throw new ProjectRefusal('git-refused', error.message);
      throw error;
    }
  }

  private async discover(root: string, shown: string): Promise<WingfoilCli> {
    try {
      const cli = await discoverCli(root, { env: this.env });
      const { logger } = this.options;
      return new WingfoilCli({ cli, runner: this.options.runner, env: this.env, ...(logger ? { logger } : {}) });
    } catch (error) {
      if (error instanceof CliNotFoundError) {
        throw new ProjectRefusal('cli-not-found', 'WingFoil CLI not found for this project', {
          path: shown,
          command: INSTALL_COMMAND,
        });
      }
      throw error;
    }
  }

  /**
   * `dna.project.name`, else the folder's base name (optional in WingFoil 0.2.2). A refused or
   * unreadable `dna show` (S-27.1) does not stop the add; a timeout or a process failure does.
   */
  private async name(root: string, shown: string, signal?: AbortSignal): Promise<string> {
    const cli = await this.discover(root, shown);
    try {
      const name = (await new ProjectReads({ root, cli }).dna(signal)).data.project?.name?.trim();
      if (name) return name;
    } catch (error) {
      if (!(error instanceof CliRefusedError || error instanceof CliOutputError)) throw error;
    }
    return path.basename(root);
  }

  private async append(project: { path: string; name: string; remote: string }): Promise<ProjectListItem> {
    const { store, snapshots, logger } = this.options;
    const id = await store.transaction((draft) => {
      // Re-checked under the lock: another console may have added it meanwhile.
      this.refuseSamePath(draft.projects, project.path);
      this.refuseSameRemote(draft.projects, project.remote);
      const entry = draft.create(project);
      draft.projects.push(entry);
      return entry.id;
    });
    const entry = store.get(id)!;
    try {
      await snapshots.open(entry.id, entry.path);
    } catch (error) {
      // The entry stays listed; its reads will report the failure.
      logger?.warn({ pid: entry.id, kind: (error as Error).name }, 'snapshot not opened');
    }
    await this.publishChange();
    return this.item(entry);
  }

  /** Publish `projects` and remember the list as seen. */
  private async publishChange(): Promise<void> {
    this.seen = signature(await Promise.all(this.options.store.projects().map((p) => this.item(p))));
    this.options.bus.publish({ event: 'projects', data: {} });
  }

  private observe(items: readonly ProjectListItem[]): void {
    const next = signature(items);
    const previous = this.seen;
    this.seen = next;
    if (previous !== undefined && previous !== next) this.options.bus.publish({ event: 'projects', data: {} });
  }

  private async item(entry: ProjectEntry): Promise<ProjectListItem> {
    const { id, name, path: root, remote } = entry;
    const availability = await this.availability(root);
    return {
      id,
      name,
      path: root,
      remote,
      availability,
      ...(availability === 'cli-not-found' ? { command: INSTALL_COMMAND } : {}),
    };
  }

  /** Files only (no process): the folder, `.wingfoil/`, the CLI discovery (adr-001 D2). */
  private async availability(root: string): Promise<Availability> {
    if (!(await isDirectory(root))) return 'folder-not-found';
    if (!(await isDirectory(path.join(root, '.wingfoil')))) return 'not-wingfoil';
    try {
      await discoverCli(root, { env: this.env });
      return 'ok';
    } catch (error) {
      if (error instanceof CliNotFoundError) return 'cli-not-found';
      throw error;
    }
  }
}

function signature(items: readonly ProjectListItem[]): string {
  return JSON.stringify(items.map((i) => [i.id, i.name, i.availability]));
}
