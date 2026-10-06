/**
 * The git reads of the snapshot (adr-001 D6, REQ-STATE-01/02) — only read operations of the
 * REQ-INT-06 allow-list, run through the process runner (argument arrays, no shell, 30 s timeout)
 * with `--no-optional-locks`, so that a read never writes `.git/index` (which would wake the
 * repository watcher):
 *
 * | Read | Command |
 * |------|---------|
 * | HEAD and the working tree, in one process | `git status --porcelain=v2 --branch -z --untracked-files=all` |
 * | the effective identity (repository, else global configuration) | `git config user.email` |
 * | the layout, once per project | `git rev-parse --show-prefix --absolute-git-dir --git-common-dir` |
 *
 * Git is never used to change anything here.
 */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ProcessResult, ProcessRunner } from '../process/runner.js';

/** HEAD of a repository without commits (`# branch.oid (initial)`). */
export const UNBORN_HEAD = '0'.repeat(40);

/** The arguments of each read: the closed list this module runs. */
export const GIT_READ_ARGS = {
  status: ['--no-optional-locks', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'],
  email: ['--no-optional-locks', 'config', 'user.email'],
  layout: ['--no-optional-locks', 'rev-parse', '--show-prefix', '--absolute-git-dir', '--git-common-dir'],
} as const;

/** One entry of the porcelain status. */
export interface StatusEntry {
  /** The two status letters (`.M`, `R.`, `??`, `!!`, …). */
  code: string;
  /** Path relative to the repository's top level, as git prints it. */
  path: string;
  /** Original path of a rename or copy. */
  from?: string;
}

/** HEAD and the working tree. */
export interface WorkingTreeStatus {
  /** Commit of HEAD, or {@link UNBORN_HEAD}. */
  head: string;
  entries: StatusEntry[];
  /** First 16 hex digits of the SHA-256 of the entries (headers excluded). */
  hash: string;
}

/** Where a project sits in its repository. */
export interface GitLayout {
  /** The project folder relative to the repository's top level, with a trailing `/`, or `""`. */
  prefix: string;
  /** Absolute git directory (HEAD, index). */
  gitDir: string;
  /** Absolute common directory (refs, packed-refs, config; equal to `gitDir` outside a worktree). */
  commonDir: string;
}

/** A git read failed: git's message, verbatim (REQ-INT-06). */
export class GitReadError extends Error {
  constructor(
    message: string,
    /** How the process ended (`exit`, `timeout`, …). */
    readonly ended: ProcessResult['ended'] = 'exit',
    /** Exit status, when it exited. */
    readonly exitCode: number | null = null,
  ) {
    super(message);
    this.name = 'GitReadError';
  }
}

/**
 * Variables that make git read another repository, index or object store than the project's, or
 * inject configuration (a `user.email` the repository does not hold). Compared case-insensitively.
 */
const REDIRECTING_GIT_VARIABLES = new Set([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_CEILING_DIRECTORIES',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  // Legacy: `git config` reads and writes this file instead of the repository's (git 2.43 still).
  'GIT_CONFIG',
]);

/**
 * `env` without the variables that would redirect a git read away from the project (an inherited
 * `GIT_DIR` from a hook, a `GIT_CONFIG_KEY_<n>` injection). `HOME`, `GIT_CONFIG_GLOBAL` and
 * `GIT_CONFIG_NOSYSTEM` are kept: they choose the global configuration, as for the CLI. The process
 * runner applies it to every child (bug-002), {@link GitReads} to its own requests too.
 */
export function gitEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    const upper = key.toUpperCase();
    if (REDIRECTING_GIT_VARIABLES.has(upper) || /^GIT_CONFIG_(KEY|VALUE)_\d+$/.test(upper)) continue;
    clean[key] = value;
  }
  return clean;
}

/** No `git` executable on the `PATH`. */
export class GitNotFoundError extends Error {
  constructor() {
    super('git not found on the PATH');
    this.name = 'GitNotFoundError';
  }
}

/** Parse the output of {@link GIT_READ_ARGS}`.status` (porcelain v2, NUL-terminated records). */
export function parseStatus(stdout: string): WorkingTreeStatus {
  const records = stdout.split('\0');
  let head = UNBORN_HEAD;
  const entries: StatusEntry[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i]!;
    if (record === '') continue;
    if (record.startsWith('# ')) {
      const oid = /^# branch\.oid (\S+)$/.exec(record)?.[1];
      if (oid && /^[0-9a-f]{40,64}$/.test(oid)) head = oid;
      continue;
    }
    hashed.push(record);
    switch (record[0]) {
      case '1':
        entries.push({ code: record.slice(2, 4), path: field(record, 8) });
        break;
      case '2': {
        const from = records[++i] ?? '';
        hashed.push(from);
        entries.push({ code: record.slice(2, 4), path: field(record, 9), from });
        break;
      }
      case 'u':
        entries.push({ code: record.slice(2, 4), path: field(record, 10) });
        break;
      case '?':
        entries.push({ code: '??', path: record.slice(2) });
        break;
      case '!':
        entries.push({ code: '!!', path: record.slice(2) });
        break;
    }
  }
  const hash = createHash('sha256').update(hashed.join('\0')).digest('hex').slice(0, 16);
  return { head, entries, hash };
}

/** What follows the first `spaces` spaces of `record` (the path, which may hold spaces). */
function field(record: string, spaces: number): string {
  let at = -1;
  for (let k = 0; k < spaces; k += 1) at = record.indexOf(' ', at + 1);
  return record.slice(at + 1);
}

/** Options of {@link GitReads}. */
export interface GitReadsOptions {
  /** Absolute path of `git` ({@link resolveGit}). */
  git: string;
  runner: ProcessRunner;
  /** The project root: working directory of every read. */
  cwd: string;
  /** Environment of the git processes (default: the server's), cleaned by {@link gitEnv}. */
  env?: NodeJS.ProcessEnv;
}

/** The git reads of one project. */
export class GitReads {
  private readonly env: NodeJS.ProcessEnv;

  constructor(private readonly options: GitReadsOptions) {
    this.env = gitEnv(options.env ?? process.env);
  }

  /** HEAD and the working tree (one process). */
  async status(): Promise<WorkingTreeStatus> {
    return parseStatus((await this.read(GIT_READ_ARGS.status)).stdout);
  }

  /** The effective `user.email`, or `undefined` when none is set. */
  async email(): Promise<string | undefined> {
    const result = await this.run(GIT_READ_ARGS.email);
    // `git config <key>` exits 1 when the key is not set.
    if (result.ended === 'exit' && result.exitCode === 1) return undefined;
    const email = this.check(result).stdout.trim();
    return email === '' ? undefined : email;
  }

  /** Prefix, git directory and common directory (one process). */
  async layout(): Promise<GitLayout> {
    const [prefix = '', gitDir = '', commonDir = ''] = (await this.read(GIT_READ_ARGS.layout)).stdout
      .split(/\r?\n/)
      .map((l) => l.trim());
    return {
      prefix,
      gitDir: path.resolve(this.options.cwd, gitDir),
      commonDir: path.resolve(this.options.cwd, commonDir),
    };
  }

  private run(args: readonly string[]): Promise<ProcessResult> {
    const { git, runner, cwd } = this.options;
    return runner.run({ file: git, args, cwd, env: this.env });
  }

  private async read(args: readonly string[]): Promise<ProcessResult> {
    return this.check(await this.run(args));
  }

  private check(result: ProcessResult): ProcessResult {
    if (result.ended === 'exit' && result.exitCode === 0) return result;
    const message =
      result.stderr.trim() ||
      (result.ended === 'exit' ? `git exited with status ${String(result.exitCode)}` : `git ended: ${result.ended}`);
    throw new GitReadError(message, result.ended, result.exitCode);
  }
}

/**
 * The absolute path of the first `git` on the `PATH` of `env` (absolute entries only: a relative
 * entry would resolve against the project folder). On Windows `git.exe`.
 */
export async function resolveGit(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Promise<string> {
  const key = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  const windows = platform === 'win32';
  const name = windows ? 'git.exe' : 'git';
  // The delimiter follows the platform rules; paths are the server's own (its file system).
  for (const entry of (env[key] ?? '').split(windows ? ';' : ':')) {
    if (!path.isAbsolute(entry)) continue;
    const candidate = path.join(entry, name);
    if (await runnable(candidate, platform)) return candidate;
  }
  throw new GitNotFoundError();
}

async function runnable(file: string, platform: NodeJS.Platform): Promise<boolean> {
  try {
    if (!(await stat(file)).isFile()) return false;
    if (platform !== 'win32') await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
