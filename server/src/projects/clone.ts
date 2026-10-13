/**
 * The clone of `POST /api/projects/clone` — write class (c), "`clone` into a new, empty folder"
 * (adr-001 D5, D7; REQ-ARC-03, REQ-INT-06): one `git clone` through the process runner (argument
 * array, no shell — REQ-SEC-05), no fixed timeout but cancellable, never prompting. A refused
 * clone leaves the file system as it was (REQ-STATE-07): {@link CloneTarget.discard} removes what
 * the clone created, and only that.
 */
import { lstat, readdir, rm, rmdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cloneArgs } from '../git/git.js';
import type { ProcessRunner } from '../process/runner.js';

/** The clone failed: git's message, verbatim (spec-004 §5 `git-refused`). */
export class GitCloneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitCloneError';
  }
}

/** The clone was cancelled (the client left) or ended by the stop sequence. */
export class CloneCancelledError extends Error {
  constructor(reason: 'cancelled' | 'terminated') {
    super(`clone ${reason}`);
    this.name = 'CloneCancelledError';
  }
}

async function present(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}

/** The working directory of a clone, as found before it, and how to undo the clone. */
export class CloneTarget {
  private constructor(
    /** Absolute path of the working directory. */
    readonly directory: string,
    /** The directory existed (empty) before the clone: emptied again, not removed. */
    readonly existed: boolean,
    /** The topmost folder the clone creates (the directory or a missing ancestor). */
    readonly createdRoot: string,
  ) {}

  /**
   * Inspect `directory` (absolute): a new folder, or an existing empty one; `undefined` when it
   * exists and is not an empty folder (spec-006 §3 `directory-not-empty`).
   */
  static async inspect(directory: string): Promise<CloneTarget | undefined> {
    const info = await stat(directory).catch(() => undefined);
    if (info) {
      if (!info.isDirectory() || (await readdir(directory)).length > 0) return undefined;
      return new CloneTarget(directory, true, directory);
    }
    if (await present(directory)) return undefined; // a dangling link
    let createdRoot = directory;
    for (let parent = path.dirname(createdRoot); parent !== createdRoot; parent = path.dirname(createdRoot)) {
      if (await present(parent)) break;
      createdRoot = parent;
    }
    return new CloneTarget(directory, false, createdRoot);
  }

  /** The nearest folder that exists now: the working directory of the git process. */
  get existingParent(): string {
    return this.existed ? this.directory : path.dirname(this.createdRoot);
  }

  /**
   * Remove what the clone created, and only that: the working directory (recursively — the clone
   * wrote it), then each missing ancestor it created, from the deepest up to {@link createdRoot},
   * as an empty folder only: an ancestor that holds anything else (another clone, a user's file
   * created meanwhile) stays, with everything above it. An existing empty folder is emptied again.
   */
  async discard(): Promise<void> {
    if (this.existed) {
      const entries = await readdir(this.directory).catch(() => []);
      await Promise.all(entries.map((e) => rm(path.join(this.directory, e), { recursive: true, force: true })));
      return;
    }
    await rm(this.directory, { recursive: true, force: true });
    for (let dir = this.directory; dir !== this.createdRoot;) {
      dir = path.dirname(dir);
      try {
        await rmdir(dir);
      } catch {
        return; // not empty (or gone): leave it and what is above it
      }
    }
  }
}

/**
 * The hooks path of every clone ({@link cloneArgs}): this module's own file. Git looks for a hook
 * at `<hooks path>/<hook name>` and nothing can exist below a regular file (`ENOTDIR`), so no hook
 * runs — not the cloned repository's, not one planted by someone else. Nothing is created, so
 * nothing is left behind when the console is killed (bug-008); turning this file into a folder
 * needs write access to the console's own installation. Checked by {@link noHooksPath}.
 */
export const NO_HOOKS_PATH: string = fileURLToPath(import.meta.url);

/**
 * The hooks path could not be used: the clone is refused before any git process (fail closed). An
 * internal error, not git's refusal: the route answers spec-004 §5 `internal` (500) and the path
 * goes to the server log only (`git-refused` carries git's own message).
 */
export class HooksPathError extends Error {
  constructor(file: string) {
    super(`The empty hooks path of the clone is not a regular file: ${file}`);
    this.name = 'HooksPathError';
  }
}

/** `file` when it is an existing regular file (links followed), else rejects with {@link HooksPathError}. */
export async function noHooksPath(file: string = NO_HOOKS_PATH): Promise<string> {
  const info = await stat(file).catch(() => undefined);
  if (!info?.isFile()) throw new HooksPathError(file);
  return file;
}

/** What {@link runClone} needs. */
export interface CloneOptions {
  /** Absolute path of `git`. */
  git: string;
  runner: ProcessRunner;
  /** Environment of git (the server's); `GIT_TERMINAL_PROMPT=0` is added. */
  env: NodeJS.ProcessEnv;
  /** Cancels the clone (the process is killed). */
  signal?: AbortSignal;
  /** The hooks path (default {@link NO_HOOKS_PATH}); tests only. A bad one rejects with {@link HooksPathError}. */
  hooksPath?: string;
}

/**
 * Clone `url` into `target`. No timeout (a large repository takes long) but `signal` cancels it;
 * git never prompts (children have no terminal; `GIT_TERMINAL_PROMPT=0`), so a missing credential
 * is a refusal. Rejects with {@link GitCloneError} or {@link CloneCancelledError}; the caller
 * discards the target.
 */
export async function runClone(url: string, target: CloneTarget, options: CloneOptions): Promise<void> {
  const result = await options.runner.run({
    file: options.git,
    args: cloneArgs(url, target.directory, await noHooksPath(options.hooksPath)),
    cwd: target.existingParent,
    env: { ...options.env, GIT_TERMINAL_PROMPT: '0' },
    timeoutMs: null,
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (result.ended === 'cancelled' || result.ended === 'terminated') throw new CloneCancelledError(result.ended);
  if (result.ended === 'exit' && result.exitCode === 0) return;
  throw new GitCloneError(
    result.stderr.trim() ||
      (result.ended === 'exit'
        ? `git clone exited with status ${String(result.exitCode)}`
        : `git clone ended: ${result.ended}`),
  );
}
