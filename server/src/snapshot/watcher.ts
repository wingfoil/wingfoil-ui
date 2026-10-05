/**
 * The repository watcher port (adr-002) and its local adapter on `fs.watch` (adr-001 D6,
 * REQ-STATE-02). The adapter only says *that* something may have changed; the snapshot then reads
 * git to know *what* (a check), so a missed or a spurious event costs at most one check. The
 * periodic check of the snapshot is the fallback for what file watching misses.
 *
 * Watched, without following the project's `node_modules` tree:
 *
 * | Folder | How | Means |
 * |--------|-----|-------|
 * | the project root | not recursive | new or removed top-level entries |
 * | each top-level folder but `.git` and `node_modules` | recursive | working-tree edits |
 * | `node_modules`, `node_modules/wingfoil` | not recursive | the project's CLI changed (task-004 hand-over) |
 * | the git directory and common directory, `refs/` | not recursive, `refs/` recursive | commits, staging, branch moves, the repository configuration |
 * | the folders of the global git configuration files | not recursive, filtered by name | the global `user.email` |
 */
import { watch, type FSWatcher } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

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
}

/** Called on a possible change. */
export interface WatchHandlers {
  /** HEAD, the working tree or the git configuration may have changed. */
  repo(): void;
  /** `node_modules/wingfoil` may have changed. */
  cli(): void;
}

/** A running watcher. */
export interface RepositoryWatcher {
  /** Stop watching (idempotent). */
  close(): void;
}

/** The port: start watching `targets`. */
export type WatchRepository = (targets: WatchTargets, handlers: WatchHandlers) => RepositoryWatcher;

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

const NOT_IN_TREE = new Set(['.git', 'node_modules']);

/** The local adapter of {@link WatchRepository}. */
export const watchRepository: WatchRepository = (targets, handlers) => new FsRepositoryWatcher(targets, handlers);

class FsRepositoryWatcher implements RepositoryWatcher {
  private readonly watchers = new Map<string, FSWatcher>();
  private closed = false;

  constructor(
    private readonly targets: WatchTargets,
    private readonly handlers: WatchHandlers,
  ) {
    const { root, gitDir, commonDir } = targets;
    this.add('root', root, false, (name) => this.onRoot(name));
    void this.scanTopLevel(true);
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
    this.closed = true;
    for (const key of [...this.watchers.keys()]) this.drop(key);
  }

  private onRoot(name: string | null): void {
    if (name === 'node_modules') {
      this.watchCli();
      this.handlers.cli();
      return;
    }
    if (name === '.git') return;
    // A new top-level folder gets its own watcher; a removed one loses it.
    void this.scanTopLevel();
    this.handlers.repo();
  }

  private async scanTopLevel(initial = false): Promise<void> {
    let names: string[];
    try {
      names = await readdir(this.targets.root);
    } catch {
      return;
    }
    const present = new Set<string>();
    for (const name of names) {
      if (NOT_IN_TREE.has(name)) continue;
      const dir = path.join(this.targets.root, name);
      try {
        if (!(await lstat(dir)).isDirectory()) continue;
      } catch {
        continue;
      }
      present.add(`tree:${name}`);
      if (!this.watchers.has(`tree:${name}`)) {
        this.add(`tree:${name}`, dir, true, () => this.handlers.repo());
        // Files written in a new folder before its watcher existed: one more check covers them.
        if (!initial) this.handlers.repo();
      }
    }
    for (const key of [...this.watchers.keys()]) if (key.startsWith('tree:') && !present.has(key)) this.drop(key);
  }

  /** (Re)watch `node_modules` and `node_modules/wingfoil` (a reinstall replaces the folder). */
  private watchCli(): void {
    const modules = path.join(this.targets.root, 'node_modules');
    this.drop('modules');
    this.drop('cli');
    this.add('modules', modules, false, (name) => {
      if (name === null || name === 'wingfoil') {
        this.drop('cli');
        this.add('cli', path.join(modules, 'wingfoil'), false, (n) => {
          if (n === null || n === 'package.json') this.handlers.cli();
        });
        this.handlers.cli();
      }
    });
    this.add('cli', path.join(modules, 'wingfoil'), false, (name) => {
      if (name === null || name === 'package.json') this.handlers.cli();
    });
  }

  private add(key: string, dir: string, recursive: boolean, onEvent: (name: string | null) => void): void {
    if (this.closed || this.watchers.has(key)) return;
    let watcher: FSWatcher;
    try {
      watcher = watch(dir, { recursive, persistent: false }, (_type, name) => {
        if (!this.closed) onEvent(name === null ? null : String(name));
      });
    } catch {
      // Missing or unwatchable: the periodic check covers it.
      return;
    }
    watcher.on('error', () => this.drop(key));
    this.watchers.set(key, watcher);
  }

  private drop(key: string): void {
    const watcher = this.watchers.get(key);
    if (!watcher) return;
    this.watchers.delete(key);
    watcher.close();
  }
}
