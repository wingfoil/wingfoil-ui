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
 * | the URL of `origin`, when a project is added (duplicate check) and on every open (spec-006 §2, once per state) | `git remote get-url origin` |
 * | the Memory events, once per HEAD (spec-002 §3), with their sha order (`log --format=%H%x00`) | `git log --no-color --no-renames --no-ext-diff --no-textconv --unified=0 -p --format=… <HEAD> -- <Memory directories>` |
 * | a governed write's element file: its entry at HEAD and in the index, whether the executable bit counts (task-032, D32-1, review S2) | `git ls-tree -z HEAD -- <path>`, `git ls-files --stage -z -- <path>`, `git config --bool core.fileMode` |
 * | the same file in the working tree as `git add` would store it (clean filters applied, nothing written) | `git hash-object -- <path>` |
 * | the commits a governed write made, and the paths each changes (D32-4, review S4) | `git log --first-parent --format=… <before>..HEAD`, `git diff-tree … <sha>` |
 * | the remotes, with the status in every check (spec-010 §1, task-033) | `git remote` |
 * | the upstream's remote and merge ref of the branch; the user's ssh command (spec-010 §1, §4) | `git config --get branch.<branch>.remote`, `… .merge`, `git config --get core.sshCommand` |
 * | every URL of a remote (`insteadOf` applied), for the owner check of a local remote (D33-1) | `git remote get-url --all [--push] -- <remote>` |
 * | the files the incoming commits change (spec-010 §5 `local-changes-in-the-way`) | `git log --no-renames --name-only -z --format= HEAD..@{u}` |
 *
 * Git is never used to change a repository by these reads. The writes are git transport (write
 * class (c), adr-001 D7): the clone into a new, empty folder ({@link cloneArgs}, run by
 * `projects/clone.ts`) and, from v0.2, fetch, `pull --ff-only` and push (`git/transport.ts`).
 */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { access, lstat, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ProcessResult, ProcessRunner } from '../process/runner.js';
import { MEMORY_LOG_FORMAT } from './memory-log.js';

/** HEAD of a repository without commits (`# branch.oid (initial)`). */
export const UNBORN_HEAD = '0'.repeat(40);

/** The arguments of each read: the closed list this module runs. */
export const GIT_READ_ARGS = {
  status: ['--no-optional-locks', 'status', '--porcelain=v2', '--branch', '-z', '--untracked-files=all'],
  email: ['--no-optional-locks', 'config', 'user.email'],
  layout: ['--no-optional-locks', 'rev-parse', '--show-prefix', '--absolute-git-dir', '--git-common-dir'],
  origin: ['--no-optional-locks', 'remote', 'get-url', 'origin'],
  // task-033 (spec-010 §1, §4, §5).
  remotes: ['--no-optional-locks', 'remote'],
  configGet: ['--no-optional-locks', 'config', '--get'],
  // task-034 (D34-5): every value of a multi-valued key (`remote.<r>.fetch`).
  configGetAll: ['--no-optional-locks', 'config', '-z', '--get-all'],
  // task-034 (W4-5): where every setting comes from (scope, origin), NUL-separated.
  configOrigins: ['--no-optional-locks', 'config', '--list', '--show-origin', '--show-scope', '-z'],
  remoteUrl: ['--no-optional-locks', 'remote', 'get-url'],
  incoming: [
    '--no-optional-locks',
    '-c',
    'core.quotePath=false',
    '-c',
    'log.showSignature=false',
    'log',
    '--no-color',
    '--no-renames',
    '--name-only',
    '-z',
    '--format=',
    'HEAD..@{u}',
  ],
  // `core.quotePath=false` for this invocation only: file names arrive as UTF-8, not escaped.
  memoryLog: [
    '--no-optional-locks',
    '-c',
    'core.quotePath=false',
    // No signature check output (`log.showSignature`) in the stream; no textconv or external diff.
    '-c',
    'log.showSignature=false',
    'log',
    '--no-color',
    '--no-renames',
    '--no-ext-diff',
    '--no-textconv',
    '--unified=0',
    '-p',
    `--format=${MEMORY_LOG_FORMAT}`,
  ],
  // The same walk without the patch: the authoritative sha order the patch read is cut at.
  memoryShas: ['--no-optional-locks', '-c', 'log.showSignature=false', 'log', '--no-renames', '--format=%H%x00'],
  // task-032 (D32-1, review S2): an element file's entry at a commit (mode, type, blob)…
  lsTree: ['--no-optional-locks', '--literal-pathspecs', 'ls-tree', '-z'],
  // …in the index (mode, blob, stage)…
  lsFiles: ['--no-optional-locks', '--literal-pathspecs', 'ls-files', '--stage', '-z'],
  // …whether the executable bit is tracked…
  fileMode: ['--no-optional-locks', 'config', '--bool', 'core.fileMode'],
  // …and the working-tree file as `git add` would store it: `hash-object` without `-w` writes nothing.
  hashObject: ['--no-optional-locks', 'hash-object', '--'],
  // task-032 (review S4): the paths a commit changes, relative to the repository's top level.
  changedPaths: [
    '--no-optional-locks',
    'diff-tree',
    '--no-commit-id',
    '--name-only',
    '-r',
    '-z',
    '--root',
    '--no-renames',
  ],
  // task-032 (D32-4): sha, committer time (epoch seconds) and subject of each commit since a write began.
  commits: [
    '--no-optional-locks',
    '-c',
    'log.showSignature=false',
    'log',
    '--first-parent',
    '--no-color',
    '--max-count=50',
    '--format=%H%x1f%ct%x1f%s%x1e',
  ],
} as const;

/** No fsmonitor program (task-034 W4-5): prefixed to every read of {@link GitReads}. */
export const NO_FSMONITOR: readonly string[] = ['-c', 'core.fsmonitor=false'];

/** One setting's scope (`system`, `global`, `local`, `worktree`, `command`) and origin (`file:<path>`, …). */
export interface ConfigOrigin {
  scope: string;
  origin: string;
}

/**
 * The git subcommands the server may run (REQ-INT-06): reads, `clone` into a new empty folder,
 * transport (v0.2) and the `ui.yaml` preset commit (v0.3). Never a merge commit — `merge` only as the
 * automatic update, `--ff-only` with the configured strategy and squash overridden (spec-010 §4,
 * task-034 D34-2) — and never rebase, reset, stash or checkout. The process audit checks every git
 * process against it.
 */
export const GIT_ALLOWED_SUBCOMMANDS: readonly string[] = [
  'rev-parse',
  'status',
  'log',
  'rev-list',
  'config',
  'remote',
  'clone',
  'fetch',
  'pull',
  'push',
  'add',
  'commit',
  // task-032 (D32-1, reviews S2, S4): reads of a governed write; `hash-object` never with `-w`.
  'hash-object',
  'ls-tree',
  'ls-files',
  'diff-tree',
  // task-034 (SARD REQ-INT-06 v0.10, RP-41): the automatic update, `merge --ff-only` only.
  'merge',
];

/**
 * Settings of every clone, passed as `-c` arguments (the inherited `GIT_CONFIG_*` variables are
 * dropped by {@link gitEnv}): every transport refused by default (`protocol.allow=never`) and only
 * `https`, `http`, `ssh`, `git` and `file` allowed — so `ext::` (which runs a command) and `fd::`
 * are refused whatever the user's configuration says.
 */
export const CLONE_SETTINGS: readonly string[] = [
  '-c',
  'protocol.allow=never',
  ...['https', 'http', 'ssh', 'git', 'file'].flatMap((p) => ['-c', `protocol.${p}.allow=always`]),
];

/**
 * The transports of {@link CLONE_SETTINGS}, as `GIT_ALLOW_PROTOCOL` takes them (task-033 D33-2,
 * bug-013): that variable, when the server's environment holds it, overrides `protocol.allow`
 * whatever `-c` says, so every clone and transport sets it to exactly this list.
 */
export const ALLOWED_PROTOCOLS = 'https:http:ssh:git:file';

/**
 * `git clone` of `url` into `directory` (write class (c)): quiet, so that the standard error holds
 * git's error message only; `url` and `directory` after `--`, never read as options.
 * `core.hooksPath` is set to `hooksPath`, a regular file of the server's own (nothing can exist
 * below it, so git finds no hook; `projects/clone.ts` `NO_HOOKS_PATH`, bug-008): a relative
 * `core.hooksPath` in the user's configuration (`.githooks`, `.husky`) would otherwise be resolved
 * in the new working tree and run the remote's committed `post-checkout` hook — no code of the
 * cloned repository runs at clone time (decided by the user 2026-10-06).
 */
export function cloneArgs(url: string, directory: string, hooksPath: string): string[] {
  return [...CLONE_SETTINGS, '-c', `core.hooksPath=${hooksPath}`, 'clone', '--quiet', '--', url, directory];
}

/** The subcommand of a git argument list: the first word after the global options (`-c k=v`, `-C dir`, `--…`). */
export function gitSubcommand(args: readonly string[]): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '-c' || arg === '-C') i += 1;
    else if (!arg.startsWith('-')) return arg;
  }
  return undefined;
}

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
  /** `# branch.head`: the branch checked out, `null` when detached (spec-010 §1). */
  branch?: string | null;
  /** `# branch.upstream`, when an upstream is configured. */
  upstream?: string;
  /** `# branch.ab`, printed only when the upstream's tracking ref exists. */
  ab?: { ahead: number; behind: number };
}

/** A regular file tracked at a commit. */
export interface TrackedFile {
  /** `100644` or `100755`. */
  mode: string;
  blob: string;
}

/** A commit listed by {@link GitReads.commitsSince}. */
export interface CommitSummary {
  sha: string;
  /** Committer time. */
  at: Date;
  subject: string;
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

/** A commit sha as a revision argument; anything else is refused (never an option). */
function commitArg(head: string): string {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(head)) throw new GitReadError(`not a commit sha: ${head}`);
  return head;
}

/** The NUL-terminated records of a `-z` output. */
function splitNul(stdout: string): string[] {
  return stdout.split(String.fromCharCode(0)).filter((record) => record !== '');
}

/** Parse the output of {@link GIT_READ_ARGS}`.status` (porcelain v2, NUL-terminated records). */
export function parseStatus(stdout: string): WorkingTreeStatus {
  const records = stdout.split('\0');
  let head = UNBORN_HEAD;
  let branch: string | null | undefined;
  let upstream: string | undefined;
  let ab: { ahead: number; behind: number } | undefined;
  const entries: StatusEntry[] = [];
  const hashed: string[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i]!;
    if (record === '') continue;
    if (record.startsWith('# ')) {
      const oid = /^# branch\.oid (\S+)$/.exec(record)?.[1];
      if (oid && /^[0-9a-f]{40,64}$/.test(oid)) head = oid;
      const name = /^# branch\.head (.+)$/s.exec(record)?.[1];
      if (name !== undefined) branch = name === '(detached)' ? null : name;
      const upstreamName = /^# branch\.upstream (.+)$/s.exec(record)?.[1];
      if (upstreamName !== undefined) upstream = upstreamName;
      const counts = /^# branch\.ab \+(\d+) -(\d+)$/.exec(record);
      if (counts) ab = { ahead: Number(counts[1]), behind: Number(counts[2]) };
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
  return {
    head,
    entries,
    hash,
    ...(branch !== undefined ? { branch } : {}),
    ...(upstream !== undefined ? { upstream } : {}),
    ...(ab ? { ab } : {}),
  };
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

  /**
   * The URL of `origin` as git resolves it (`url.<base>.insteadOf` applied), or `""` when the
   * repository has no `origin`. Rejects with {@link GitReadError} outside a repository.
   */
  async origin(): Promise<string> {
    const result = await this.run(GIT_READ_ARGS.origin);
    // `git remote get-url` exits 2 when the remote does not exist.
    if (result.ended === 'exit' && result.exitCode === 2) return '';
    return this.check(result).stdout.trim();
  }

  /** The remotes `git remote` lists (spec-010 §1), in its order. */
  async remotes(): Promise<string[]> {
    return (await this.read(GIT_READ_ARGS.remotes)).stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l !== '');
  }

  /**
   * `git config --get <key>` (repository, global and system configuration, as git reads them), or
   * `undefined` when unset (exit 1) or empty. `key` is the server's own (`branch.<name>.remote`, …).
   */
  async configValue(key: string): Promise<string | undefined> {
    const result = await this.run([...GIT_READ_ARGS.configGet, key]);
    if (result.ended === 'exit' && result.exitCode === 1) return undefined;
    const value = this.check(result).stdout.replace(/\r?\n$/, '');
    return value === '' ? undefined : value;
  }

  /** Where each setting of the effective configuration comes from (task-034 W4-5). */
  async configOrigins(): Promise<ConfigOrigin[]> {
    const fields = (await this.read(GIT_READ_ARGS.configOrigins)).stdout.split(String.fromCharCode(0));
    const origins: ConfigOrigin[] = [];
    for (let i = 0; i + 2 < fields.length; i += 3) origins.push({ scope: fields[i]!, origin: fields[i + 1]! });
    return origins;
  }

  /**
   * Every value of `key` in git's order, empty values included (NUL-terminated, security review
   * round 2); `[]` when unset (exit 1). `key` is the server's own.
   */
  async configValues(key: string): Promise<string[]> {
    const result = await this.run([...GIT_READ_ARGS.configGetAll, key]);
    if (result.ended === 'exit' && result.exitCode === 1) return [];
    const values = this.check(result).stdout.split(String.fromCharCode(0));
    // Every value ends with a NUL: the last field is the empty rest.
    return values.slice(0, -1);
  }

  /**
   * Every URL git uses for the remote `name` (`insteadOf` applied; `push`: the push URLs), in its
   * order (review round 1 S2). A remote with no URL is opened by git as the path `name` itself:
   * `[name]` then (review round 1 S4).
   */
  async remoteUrls(name: string, push = false): Promise<string[]> {
    const result = await this.run([...GIT_READ_ARGS.remoteUrl, '--all', ...(push ? ['--push'] : []), '--', name]);
    // `git remote get-url` exits 2 when the remote does not exist.
    if (result.ended === 'exit' && result.exitCode === 2) return [name];
    const urls = this.check(result)
      .stdout.split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => u !== '');
    return urls.length > 0 ? urls : [name];
  }

  /** The paths the commits of `HEAD..@{u}` change, relative to the repository's top level (spec-010 §5). */
  async incomingPaths(): Promise<string[]> {
    return [...new Set(splitNul((await this.read(GIT_READ_ARGS.incoming)).stdout).map((p) => p.replace(/^\n+/, '')))];
  }

  /**
   * Run a git transport command (task-033): no timeout unless given, `signal` cancels it (the
   * process group is killed), `env` added to the reads' environment. The outcome as it is.
   */
  transport(
    args: readonly string[],
    options: { env?: NodeJS.ProcessEnv; signal?: AbortSignal; timeoutMs?: number | null } = {},
  ): Promise<ProcessResult> {
    const { git, runner, cwd } = this.options;
    return runner.run({
      file: git,
      args,
      cwd,
      env: { ...this.env, ...options.env },
      timeoutMs: options.timeoutMs ?? null,
      ...(options.signal ? { signal: options.signal } : {}),
    });
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

  /**
   * The raw output of the spec-002 §3 read over `dirs` (Memory directories relative to the
   * project, see `memoryDirectories`) from the commit `head` — the observed state's HEAD, so that a
   * commit landing meanwhile does not change what is read; parse it with `parseMemoryLog`. No
   * directory → no process.
   */
  async memoryLog(dirs: readonly string[], head: string): Promise<string> {
    if (dirs.length === 0) return '';
    return (await this.read([...GIT_READ_ARGS.memoryLog, commitArg(head), '--', ...dirs])).stdout;
  }

  /** The shas of the same walk as {@link memoryLog} from `head`, newest first (no patch). */
  async memoryLogShas(dirs: readonly string[], head: string): Promise<string[]> {
    if (dirs.length === 0) return [];
    const out = (await this.read([...GIT_READ_ARGS.memoryShas, commitArg(head), '--', ...dirs])).stdout;
    return out
      .split(String.fromCharCode(0))
      .map((s) => s.trim())
      .filter((s) => s !== '');
  }

  /**
   * The entry of `file` (relative to the project root) at the commit `rev`: a regular file (mode
   * `100644` or `100755`) and its blob, or `undefined` (absent, a symlink, a folder, a submodule).
   */
  async fileAt(rev: string, file: string): Promise<TrackedFile | undefined> {
    const result = await this.run([...GIT_READ_ARGS.lsTree, rev === 'HEAD' ? rev : commitArg(rev), '--', file]);
    if (result.ended === 'exit' && result.exitCode !== 0) return undefined;
    const records = splitNul(this.check(result).stdout);
    const entry = records.length === 1 ? /^(100644|100755) blob ([0-9a-f]+)\t/.exec(records[0]!) : null;
    return entry ? { mode: entry[1]!, blob: entry[2]! } : undefined;
  }

  /**
   * The blob `git add` would store for `file` (clean filters applied, nothing written), or
   * `undefined` when there is no file to read.
   */
  async worktreeBlob(file: string): Promise<string | undefined> {
    const result = await this.run([...GIT_READ_ARGS.hashObject, file]);
    if (result.ended === 'exit' && result.exitCode !== 0) return undefined;
    return this.check(result).stdout.trim();
  }

  /**
   * Whether `file` (relative to the project root) is the same entry at HEAD, in the index and in
   * the working tree (task-032, D32-1, review S2) — whatever the status shows: an edit or a mode
   * change hidden by `assume-unchanged`, `skip-worktree`, `core.ignoreStat` or an fsmonitor still
   * differs here. HEAD and the index: one stage-0 entry each, a regular file, same mode and blob;
   * the working tree: a regular file (not a symlink), with the executable bit of that mode when
   * `core.fileMode` holds, and the blob `git add` would store. Anything missing is not the same.
   */
  async sameEntryEverywhere(file: string): Promise<boolean> {
    const atHead = await this.fileAt('HEAD', file);
    if (!atHead) return false;
    const staged = await this.run([...GIT_READ_ARGS.lsFiles, '--', file]);
    if (staged.ended === 'exit' && staged.exitCode !== 0) return false;
    const records = splitNul(this.check(staged).stdout);
    const index = records.length === 1 ? /^(\d{6}) ([0-9a-f]+) (\d)\t/.exec(records[0]!) : null;
    if (!index || index[3] !== '0' || index[1] !== atHead.mode || index[2] !== atHead.blob) return false;
    let stats;
    try {
      stats = await lstat(path.join(this.options.cwd, file));
    } catch {
      return false;
    }
    if (!stats.isFile()) return false;
    if (await this.fileModeTracked()) {
      const executable = (stats.mode & 0o100) !== 0;
      if (executable !== (atHead.mode === '100755')) return false;
    }
    return (await this.worktreeBlob(file)) === atHead.blob;
  }

  /** The paths the commit `sha` changes (against its first parent), relative to the repository's top level. */
  async changedPaths(sha: string): Promise<string[]> {
    return splitNul((await this.read([...GIT_READ_ARGS.changedPaths, commitArg(sha)])).stdout);
  }

  /** `core.fileMode` (default `true`): whether git tracks the executable bit. */
  private async fileModeTracked(): Promise<boolean> {
    const result = await this.run(GIT_READ_ARGS.fileMode);
    // `git config` exits 1 when the key is not set.
    if (result.ended === 'exit' && result.exitCode === 1) return true;
    return this.check(result).stdout.trim() !== 'false';
  }

  /** The first-parent commits of `<before>..HEAD`, newest first, at most 50 (task-032, D32-4). */
  async commitsSince(before: string): Promise<CommitSummary[]> {
    const out = (await this.read([...GIT_READ_ARGS.commits, `${commitArg(before)}..HEAD`])).stdout;
    return out
      .split('\x1e')
      .map((record) => record.replace(/^\s+/, ''))
      .filter((record) => record !== '')
      .flatMap((record) => {
        const [sha = '', time = '', ...subject] = record.split('\x1f');
        if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha) || !/^\d+$/.test(time)) return [];
        return [{ sha, at: new Date(Number(time) * 1000), subject: subject.join('\x1f') }];
      });
  }

  private run(args: readonly string[]): Promise<ProcessResult> {
    const { git, runner, cwd } = this.options;
    // No fsmonitor program in the server's own reads: the configuration may name one from the
    // working tree (task-034 W4-5, security review S1).
    return runner.run({ file: git, args: [...NO_FSMONITOR, ...args], cwd, env: this.env });
  }

  private async read(args: readonly string[]): Promise<ProcessResult> {
    return this.check(await this.run(args));
  }

  private check(result: ProcessResult): ProcessResult {
    // A cut output may be incomplete: never read (task-034 W4-13), fail closed.
    if (result.drained)
      throw new GitReadError('git output cut: its pipes were held open', result.ended, result.exitCode);
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
