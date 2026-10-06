/**
 * The repository watcher port (adr-002) and its local adapter on `fs.watch` (adr-001 D6,
 * REQ-STATE-02). The adapter only says *that* something may have changed; the snapshot then reads
 * git to know *what* (a check), so a missed or a spurious event costs at most one check. The
 * periodic check of the snapshot is the fallback for what file watching misses.
 *
 * Only what feeds the reads is watched (on Linux a recursive watch costs one inotify watch per
 * folder, so a source tree, `dist/` or a nested `node_modules` is never watched):
 *
 * | Folder | How | Means |
 * |--------|-----|-------|
 * | the project root | not recursive | root files, new `node_modules` |
 * | `.wingfoil/` and the element folders of `memory.yaml` ({@link memoryWatchPlan}) | recursive | DNA, types, directives, element edits; re-evaluated when `.wingfoil/` changes |
 * | the nearest existing parent of a missing element folder | not recursive | the folder appears |
 * | `node_modules`, `node_modules/wingfoil` | not recursive | the project's CLI changed (task-004 hand-over) |
 * | the git directory and common directory, `refs/` | not recursive, `refs/` recursive | commits, staging, branch moves, the repository configuration |
 * | the folders of the global git configuration files | not recursive, filtered by name | the global `user.email` |
 *
 * A watch that cannot be set up (other than a missing folder: `ENOSPC`, `EMFILE`, …) is reported
 * through {@link WatchHandlers.degraded}.
 */
import { watch as fsWatch, type FSWatcher } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { readMemoryYaml } from '../reads/memory-yaml.js';

/** What to watch for one project. */
export interface WatchTargets {
  /** Project root. */
  root: string;
  /** Absolute git directory. */
  gitDir: string;
  /** Absolute common directory. */
  commonDir: string;
  /** Global git configuration files ({@link globalConfigFiles}). */
  globalConfig: readonly string[];
  /** What to watch recursively, re-evaluated when `.wingfoil/` changes (default {@link memoryWatchPlan}). */
  trees?: () => Promise<WatchPlan>;
}

/** Called on a possible change. */
export interface WatchHandlers {
  /** HEAD, the working tree or the git configuration may have changed. */
  repo(): void;
  /** `node_modules/wingfoil` may have changed. */
  cli(): void;
  /** A watch could not be set up: changes there are seen by the periodic check only. */
  degraded?(reason: string): void;
}

/** A running watcher. */
export interface RepositoryWatcher {
  /** Resolves once every initial watch is set up (the element folders are found asynchronously). */
  readonly ready: Promise<void>;
  /** Stop watching (idempotent). */
  close(): void;
}

/** Options of {@link watchRepository}. */
export interface WatchOptions {
  /** `fs.watch` (replaced by tests). */
  watch?: typeof fsWatch;
}

/** The port: start watching `targets`. */
export type WatchRepository = (
  targets: WatchTargets,
  handlers: WatchHandlers,
  options?: WatchOptions,
) => RepositoryWatcher;

/**
 * The global git configuration files git reads for `user.email` with `env`: `GIT_CONFIG_GLOBAL`
 * when set, else `$XDG_CONFIG_HOME/git/config` (default `~/.config/git/config`) and `~/.gitconfig`.
 */
export function globalConfigFiles(env: NodeJS.ProcessEnv): string[] {
  if (env.GIT_CONFIG_GLOBAL) return [env.GIT_CONFIG_GLOBAL];
  const home = env.HOME;
  const files: string[] = [];
  const xdg = env.XDG_CONFIG_HOME || (home ? path.join(home, '.config') : undefined);
  if (xdg) files.push(path.join(xdg, 'git', 'config'));
  if (home) files.push(path.join(home, '.gitconfig'));
  return files;
}

/** What {@link memoryWatchPlan} found. */
export interface WatchPlan {
  /** Folders, relative to the root, to watch recursively. */
  trees: string[];
  /**
   * Types whose path pattern has no static folder (`{id}.md`, `{release}/{id}.md`): their elements
   * may be anywhere, so file watching cannot cover them without watching the whole tree — the
   * watcher reports itself degraded instead (review round 2, R3).
   */
  unwatched: string[];
}

/**
 * The folders that feed the reads, relative to `root`: `.wingfoil` and, for each type of
 * `memory.yaml`, the static folder of its path pattern (`docs/memory/task/{id}.md` →
 * `docs/memory/task`), without folders nested in another one. An unreadable `memory.yaml` leaves
 * `.wingfoil` only (its fix is an event there).
 */
export async function memoryWatchPlan(root: string): Promise<WatchPlan> {
  const trees = new Set<string>(['.wingfoil']);
  const unwatched: string[] = [];
  try {
    for (const [name, type] of Object.entries((await readMemoryYaml(root)).types)) {
      const fixed = type.path.split('{')[0] ?? '';
      const dir = path.normalize(fixed.endsWith('/') ? fixed.slice(0, -1) : path.dirname(fixed));
      if (dir === '.' || dir.startsWith('..') || path.isAbsolute(dir)) unwatched.push(name);
      else trees.add(dir);
    }
  } catch {
    // Types unreadable: `.wingfoil` only.
  }
  const sorted = [...trees].sort();
  return {
    trees: sorted.filter((dir) => !sorted.some((other) => other !== dir && dir.startsWith(`${other}${path.sep}`))),
    unwatched: unwatched.sort(),
  };
}

/** The recursive folders of {@link memoryWatchPlan}. */
export async function memoryTrees(root: string): Promise<string[]> {
  return (await memoryWatchPlan(root)).trees;
}

/** The local adapter of {@link WatchRepository}. */
export const watchRepository: WatchRepository = (targets, handlers, options = {}) =>
  new FsRepositoryWatcher(targets, handlers, options.watch ?? fsWatch);

class FsRepositoryWatcher implements RepositoryWatcher {
  private readonly watchers = new Map<string, FSWatcher>();
  private stopped = false;
  private treeGeneration = 0;
  private reportedUnwatched = '';
  readonly ready: Promise<void>;

  constructor(
    private readonly targets: WatchTargets,
    private readonly handlers: WatchHandlers,
    private readonly watchFn: typeof fsWatch,
  ) {
    const { root, gitDir, commonDir } = targets;
    this.add('root', root, false, (name) => {
      if (name === 'node_modules') {
        this.watchCli();
        handlers.cli();
      } else if (name !== '.git') {
        // A new top-level folder may be (the parent of) an element folder.
        void this.watchTrees();
        handlers.repo();
      }
    });
    this.ready = this.watchTrees();
    this.watchCli();
    const git = (name: string | null): void => {
      if (name === null || !name.endsWith('.lock')) handlers.repo();
    };
    this.add('git', gitDir, false, git);
    if (commonDir !== gitDir) this.add('common', commonDir, false, git);
    this.add('refs', path.join(commonDir, 'refs'), true, git);
    for (const file of targets.globalConfig) {
      const base = path.basename(file);
      this.add(`global:${file}`, path.dirname(file), false, (name) => {
        if (name === null || name === base) handlers.repo();
      });
    }
  }

  close(): void {
    this.stopped = true;
    for (const key of [...this.watchers.keys()]) this.drop(key);
  }

  /**
   * (Re)watch the trees; a missing one through its nearest existing parent. Calls may overlap (a
   * burst of `.wingfoil/` events): each takes a generation, and one superseded by a later call
   * neither adds nor drops a watch (review round 2, R4).
   */
  private async watchTrees(): Promise<void> {
    const generation = ++this.treeGeneration;
    const plan = await (this.targets.trees ?? (() => memoryWatchPlan(this.targets.root)))().catch((): WatchPlan => ({
      trees: ['.wingfoil'],
      unwatched: [],
    }));
    const wanted: { key: string; dir: string; recursive: boolean; tree: string }[] = [];
    for (const tree of plan.trees) {
      const dir = path.join(this.targets.root, tree);
      if (await isDirectory(dir)) {
        wanted.push({ key: `tree:${tree}`, dir, recursive: true, tree });
        continue;
      }
      const parent = await nearestParent(this.targets.root, dir);
      if (parent !== undefined) wanted.push({ key: `parent:${parent}`, dir: parent, recursive: false, tree });
    }
    if (this.stopped || generation !== this.treeGeneration) return;
    // From here on synchronous: no other call interleaves.
    const unwatched = plan.unwatched.join(', ');
    if (unwatched !== '' && unwatched !== this.reportedUnwatched) {
      this.handlers.degraded?.(`no static folder in the path pattern of: ${unwatched}`);
    }
    this.reportedUnwatched = unwatched;
    const keys = new Set(wanted.map((w) => w.key));
    for (const key of [...this.watchers.keys()]) {
      if ((key.startsWith('tree:') || key.startsWith('parent:')) && !keys.has(key)) this.drop(key);
    }
    for (const w of wanted) {
      if (w.recursive) {
        this.add(w.key, w.dir, true, () => {
          this.handlers.repo();
          // `.wingfoil/memory.yaml` may name other folders now.
          if (w.tree === '.wingfoil') void this.watchTrees();
        });
      } else {
        this.add(w.key, w.dir, false, () => {
          void this.watchTrees();
          this.handlers.repo();
        });
      }
    }
  }

  /** (Re)watch `node_modules` and `node_modules/wingfoil` (a reinstall replaces the folder). */
  private watchCli(): void {
    const modules = path.join(this.targets.root, 'node_modules');
    const cli = (): void => {
      this.drop('cli');
      this.add('cli', path.join(modules, 'wingfoil'), false, (n) => {
        if (n === null || n === 'package.json') this.handlers.cli();
      });
    };
    this.drop('modules');
    this.add('modules', modules, false, (name) => {
      if (name === null || name === 'wingfoil') {
        cli();
        this.handlers.cli();
      }
    });
    cli();
  }

  private add(key: string, dir: string, recursive: boolean, onEvent: (name: string | null) => void): void {
    if (this.stopped || this.watchers.has(key)) return;
    let watcher: FSWatcher;
    try {
      watcher = this.watchFn(dir, { recursive, persistent: false }, (_type, name) => {
        if (!this.stopped) onEvent(name === null ? null : String(name));
      });
    } catch (error) {
      // A missing folder is normal (no global configuration, no `node_modules`); anything else
      // (`ENOSPC`, `EMFILE`) leaves changes there to the periodic check.
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT' && code !== 'ENOTDIR') this.handlers.degraded?.(`${code ?? 'error'}: ${dir}`);
      return;
    }
    watcher.on('error', (error: NodeJS.ErrnoException) => {
      this.drop(key);
      if (error.code !== 'ENOENT') this.handlers.degraded?.(`${error.code ?? 'error'}: ${dir}`);
    });
    this.watchers.set(key, watcher);
  }

  private drop(key: string): void {
    const watcher = this.watchers.get(key);
    if (!watcher) return;
    this.watchers.delete(key);
    watcher.close();
  }
}

async function isDirectory(dir: string): Promise<boolean> {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

/** The nearest existing folder above `dir`, strictly inside `root`, or `undefined`. */
async function nearestParent(root: string, dir: string): Promise<string | undefined> {
  let current = path.dirname(dir);
  while (current.startsWith(`${root}${path.sep}`)) {
    if (await isDirectory(current)) return current;
    current = path.dirname(current);
  }
  return undefined;
}
