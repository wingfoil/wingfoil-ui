/**
 * The preset write (spec-005 §5, spec-004 §3–§6, task-060): one of the shipped presets written as
 * `.wingfoil/ui.yaml` and committed alone as `chore(ui): apply the <Preset> preset` (REQ-ARC-03
 * class b, REQ-INT-06) — the console's one commit that is not a CLI `wf(…)` commit.
 *
 * | Step | Check or action | Refusal | Read from |
 * |------|-----------------|---------|-----------|
 * | 5, 6 | one member of the team; WingFoil in range | 403 `not-in-team`, 409 `unsupported-version` | the snapshot view, before the lock; again on the fresh view when the state moved (D60-3) |
 * | 7′ | `.wingfoil/ui.yaml` exists nowhere: no working-tree entry (a `.wingfoil` that is not a directory counts, Q1), no index entry, none at HEAD | 409 `ui-config-exists` | **fresh**, under the lock (D60-4) |
 * | 8 | the copy is not behind, diverged or detached | 409 `stale-copy` | the fresh state |
 * | — | `memory.yaml` read; the rendered text parsed and checked | 502 `read-error`, 422 `ui-config-invalid` | a direct read (D60-5) |
 * | — | the exclusive create (`O_EXCL`, `O_NOFOLLOW`), `.wingfoil` and the file the same entries after it | 409 `ui-config-exists`; 500 `write-incomplete` (a swap, nothing removed) | {@link PresetFs} (D60-6) |
 * | — | `git add -- .wingfoil/ui.yaml` | 422 `git-refused` (redacted), the created file removed | D60-7, D60-9 |
 * | — | `git commit --only … -- .wingfoil/ui.yaml`, then exactly one first-parent commit with the subject, changing that path only, holding the working-tree blob, the file still the rendered text | 500 `write-incomplete` (`detail.commit` when exactly one commit has the subject; nothing logged, pushed or announced) | D60-8, D60-9 |
 *
 * On success, under the lock: the action log, the state check, the auto-push, the `write` event
 * `{pid, commit}` without `eid`, then 200 (D60-10). Logs carry kinds, codes and exits only — never
 * git's text (it quotes the absolute root) nor a path.
 */
import { constants } from 'node:fs';
import { lstat, open, unlink } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectEntry, UiConfigPresetResult, WriteCommit } from '@wingfoil-ui/contracts';
import { CliError, cliErrorEnvelope } from '../cli/adapter.js';
import { CliNotFoundError } from '../cli/discovery.js';
import type { EventBus } from '../events/bus.js';
import { blocksWrites } from '../git/copy.js';
import { UNBORN_HEAD, type CommitSummary } from '../git/git.js';
import { presetAddArgs, presetCommitArgs } from '../git/index-write.js';
import { redactLocalPaths } from '../git/redact.js';
import {
  presetCommitSubject,
  renderPreset,
  UI_PRESETS,
  type UiPreset,
  type UiPresetName,
} from '../presets/ui-config.js';
import type { ProcessResult } from '../process/runner.js';
import type { WriteLock } from '../process/write-lock.js';
import { DirectReadError } from '../reads/confine.js';
import { MEMORY_YAML, readMemoryYaml } from '../reads/memory-yaml.js';
import { readUiYaml, UI_YAML } from '../reads/ui-yaml.js';
import type { ProjectSnapshot, SnapshotView } from '../snapshot/snapshot.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import type { StateStore } from '../state/store.js';
import { checkUiYaml } from '../ui-config/check.js';
import { parseUiYaml } from '../ui-config/parse.js';
import {
  appendActions,
  identifiedInRange,
  isoSeconds,
  PUSH_OFF,
  type WriteLogger,
  type WriteOutcome,
  type WritePushPort,
} from './governed.js';

/** An entry as the create sees it: its identity and kind (`lstat`, never followed). */
export interface PresetEntryId {
  dev: number;
  ino: number;
  kind: 'directory' | 'file' | 'other';
}

/**
 * The file port of the preset write (D60-6; the tests swap entries between its steps): `lstat`
 * (`undefined` when nothing is there), the exclusive create of a file holding `bytes` (errors
 * carry their `code`: `EEXIST` when any entry is there, a dangling link included; a
 * {@link PartialCreateError} when the file was created but not fully written), `unlink`.
 */
export interface PresetFs {
  lstat(file: string): Promise<PresetEntryId | undefined>;
  create(file: string, bytes: Uint8Array): Promise<PresetEntryId>;
  unlink(file: string): Promise<void>;
}

/** The file was created (`entry`) but writing it failed (`cause`). */
export class PartialCreateError extends Error {
  constructor(
    readonly entry: PresetEntryId,
    cause: unknown,
  ) {
    super('the created file was not fully written', { cause });
    this.name = 'PartialCreateError';
  }
}

function entryOf(stats: { dev: number; ino: number; isDirectory(): boolean; isFile(): boolean }): PresetEntryId {
  return {
    dev: stats.dev,
    ino: stats.ino,
    kind: stats.isDirectory() ? 'directory' : stats.isFile() ? 'file' : 'other',
  };
}

/** The port on the local file system. */
export const nodePresetFs: PresetFs = {
  async lstat(file) {
    try {
      return entryOf(await lstat(file));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
  },
  async create(file, bytes) {
    // O_NOFOLLOW guards the last component only: the caller checks `.wingfoil` around it (P11).
    const handle = await open(
      file,
      constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
      0o666,
    );
    let entry: PresetEntryId | undefined;
    try {
      entry = entryOf(await handle.stat());
      await handle.writeFile(bytes);
      await handle.close();
      return entry;
    } catch (error) {
      await handle.close().catch(() => undefined);
      if (entry) throw new PartialCreateError(entry, error);
      throw error;
    }
  },
  unlink: (file) => unlink(file),
};

/** Options of {@link PresetWrites}. */
export interface PresetWritesOptions {
  store: StateStore;
  snapshots: Snapshots;
  writeLock: WriteLock;
  bus: EventBus;
  /** The auto-push (default: off). */
  push?: WritePushPort;
  /** The preset table (default: the shipped one). Only the API test passes another (D60-12). */
  presets?: Readonly<Record<UiPresetName, UiPreset>>;
  /** The file port (default {@link nodePresetFs}). */
  fs?: PresetFs;
}

/** What a preset write asks. */
export interface PresetWriteRequest {
  pid: string;
  preset: UiPresetName;
}

const refuse = (status: number, code: string, message: string): WriteOutcome => ({
  status,
  body: { error: { code, message } },
});

const EXISTS = refuse(409, 'ui-config-exists', 'ui.yaml already exists');
const STALE_COPY = refuse(409, 'stale-copy', 'The copy is behind, diverged or on a detached HEAD');
const INTERNAL = refuse(500, 'internal', 'Internal error');

/** 500 `write-incomplete` (D60-9): a fixed message, never git's text. */
function incomplete(what: string, commit?: string): WriteOutcome {
  return {
    status: 500,
    body: {
      error: {
        code: 'write-incomplete',
        message: `The write did not finish: ${what}`,
        detail: { file: UI_YAML, ...(commit !== undefined ? { commit } : {}) },
      },
    },
  };
}

const sameEntry = (a: PresetEntryId | undefined, b: PresetEntryId | undefined): boolean =>
  a !== undefined && b !== undefined && a.dev === b.dev && a.ino === b.ino && a.kind === b.kind;

const succeeded = (result: ProcessResult): boolean => result.ended === 'exit' && result.exitCode === 0;

/** The preset write of the server. */
export class PresetWrites {
  private readonly push: WritePushPort;
  private readonly presets: Readonly<Record<UiPresetName, UiPreset>>;
  private readonly fs: PresetFs;

  constructor(private readonly options: PresetWritesOptions) {
    this.push = options.push ?? PUSH_OFF;
    this.presets = options.presets ?? UI_PRESETS;
    this.fs = options.fs ?? nodePresetFs;
  }

  /** Apply `request` on the listed project `entry`; CLI errors of rows 5–6 are mapped (spec-004 §5). */
  async apply(entry: ProjectEntry, request: PresetWriteRequest, log: WriteLogger): Promise<WriteOutcome> {
    try {
      const snapshot = await this.options.snapshots.open(entry.id, entry.path);
      const view = await snapshot.view();
      const refused = await identifiedInRange(view);
      if (refused) return refused;
      return await this.options.writeLock.run(snapshot.lockKey, () => this.locked(snapshot, view, request, log));
    } catch (error) {
      if (error instanceof CliError || error instanceof CliNotFoundError) {
        const { status, body } = cliErrorEnvelope(error);
        return { status, body };
      }
      throw error;
    }
  }

  private async locked(
    snapshot: ProjectSnapshot,
    seen: SnapshotView,
    request: PresetWriteRequest,
    log: WriteLogger,
  ): Promise<WriteOutcome> {
    // Fresh: the state now (git only), not the watcher's last one.
    const state = await snapshot.check();
    if (state.key !== seen.state.key || state.email !== seen.state.email) {
      const refused = await identifiedInRange(await snapshot.view());
      if (refused) return refused;
    }
    // Row 7′ (D60-4), then row 8.
    if (await this.existsAnywhere(snapshot, state.head)) return EXISTS;
    if (blocksWrites(state.copy)) return STALE_COPY;

    // D60-5: render (no user text), read memory.yaml, check what will be written.
    const text = renderPreset(request.preset, this.presets);
    const subject = presetCommitSubject(request.preset, this.presets);
    let memoryYaml;
    try {
      memoryYaml = await readMemoryYaml(snapshot.root);
    } catch (error) {
      if (!(error instanceof DirectReadError)) throw error;
      log.warn({ kind: error.kind, file: MEMORY_YAML }, 'preset write: memory.yaml unreadable');
      return {
        status: 502,
        body: {
          error: {
            code: 'read-error',
            message: `Cannot read ${MEMORY_YAML}: ${error.kind}`,
            detail: { file: MEMORY_YAML, kind: error.kind },
          },
        },
      };
    }
    const parsed = parseUiYaml(text);
    const checked = parsed.ok ? checkUiYaml(parsed.data, memoryYaml) : parsed;
    if (!checked.ok) {
      return {
        status: 422,
        body: {
          error: {
            code: 'ui-config-invalid',
            message: `ui.yaml not written: ${checked.failure}`,
            detail: { failure: checked.failure },
          },
        },
      };
    }

    // D60-6: the exclusive create.
    const wingfoilDir = path.join(snapshot.root, '.wingfoil');
    const file = path.join(snapshot.root, ...UI_YAML.split('/'));
    const before = await this.fs.lstat(wingfoilDir);
    if (before?.kind !== 'directory') return EXISTS;
    let created: PresetEntryId;
    try {
      created = await this.fs.create(file, Buffer.from(text, 'utf8'));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (error instanceof PartialCreateError) {
        log.warn(
          { kind: 'ui-yaml-create', code: (error.cause as NodeJS.ErrnoException)?.code },
          'preset write: not written',
        );
        // Review round 1 F-5: a file left behind is answered as after a failed add.
        if (!(await this.removeCreated(snapshot, wingfoilDir, before, file, error.entry, log))) {
          return incomplete('ui.yaml could not be removed after it was not fully written');
        }
        return INTERNAL;
      }
      if (code === 'EEXIST') return EXISTS;
      log.warn({ kind: 'ui-yaml-create', code }, 'preset write: not created');
      return INTERNAL;
    }
    if (!(await this.stillHere(wingfoilDir, before, file, created))) {
      log.warn({ kind: 'ui-yaml-swapped' }, 'preset write: .wingfoil changed around the create');
      return incomplete('.wingfoil changed while ui.yaml was created');
    }

    // D60-7, D60-9: git add, then the commit.
    const git = snapshot.git;
    const added = await git.indexWrite(presetAddArgs(UI_YAML));
    if (!succeeded(added)) {
      log.warn({ op: 'preset-add', ended: added.ended, exitCode: added.exitCode }, 'preset write: git add failed');
      const message = redactLocalPaths(
        added.stderr.trim() ||
          (added.ended === 'exit' ? `git exited with status ${String(added.exitCode)}` : `git ended: ${added.ended}`),
        snapshot.localRoots,
      );
      if (!(await this.removeCreated(snapshot, wingfoilDir, before, file, created, log))) {
        return incomplete('ui.yaml could not be removed after git add failed');
      }
      return refuse(422, 'git-refused', message);
    }
    const committed = await git.indexWrite(presetCommitArgs(UI_YAML, subject));
    const found = await this.commitsWithSubject(snapshot, state.head, subject).catch((error: unknown) => {
      log.warn({ kind: (error as Error).name }, 'preset write: commits not read');
      return undefined;
    });
    const single = found?.length === 1 ? found[0] : undefined;
    const ok = succeeded(committed) && single !== undefined && (await this.holdsTheFile(snapshot, single.sha, text));
    if (!ok) {
      log.warn(
        {
          op: 'preset-commit',
          ended: committed.ended,
          exitCode: committed.exitCode,
          found: found?.length ?? null,
          ...(single ? { commit: single.sha } : {}),
        },
        'preset write: the commit is not the preset’s single commit',
      );
      await snapshot.check().catch(() => undefined);
      return incomplete(single ? 'the preset commit is not as written' : 'the preset commit was not made', single?.sha);
    }

    // D60-10: success, under the lock.
    const commit: WriteCommit = { sha: single.sha, subject: single.subject };
    await appendActions(this.options.store, [{ sha: commit.sha, at: isoSeconds(single.at) }], log, 'preset write');
    await snapshot.check().catch((error: unknown) => {
      log.warn({ kind: (error as Error).name }, 'preset write: state check failed');
    });
    const push = await this.push.push({ pid: request.pid, snapshot });
    this.options.bus.publish({ event: 'write', data: { pid: request.pid, commit: commit.sha } });
    const result: UiConfigPresetResult = { file: UI_YAML, preset: request.preset };
    return { status: 200, body: { result: { ...result }, commits: [commit], push } };
  }

  /** Row 7′ (D60-4): any entry in the working tree, the index or at HEAD. */
  private async existsAnywhere(snapshot: ProjectSnapshot, head: string): Promise<boolean> {
    const wingfoil = await this.fs.lstat(path.join(snapshot.root, '.wingfoil'));
    if (wingfoil !== undefined && wingfoil.kind !== 'directory') return true; // Q1 (a)
    if (wingfoil !== undefined && (await this.fs.lstat(path.join(snapshot.root, ...UI_YAML.split('/')))) !== undefined)
      return true;
    if (await snapshot.git.hasIndexEntry(UI_YAML)) return true;
    return head !== UNBORN_HEAD && (await snapshot.git.hasHeadEntry(UI_YAML));
  }

  /** `.wingfoil` and the file are the entries of the create (no swap around it, D60-6). */
  private async stillHere(
    wingfoilDir: string,
    before: PresetEntryId,
    file: string,
    created: PresetEntryId,
  ): Promise<boolean> {
    return sameEntry(await this.fs.lstat(wingfoilDir), before) && sameEntry(await this.fs.lstat(file), created);
  }

  /**
   * Remove the file this write created (D60-9): only while `.wingfoil` and the file are still the
   * entries of the create, and the index holds nothing there. `false`: left as it is.
   */
  private async removeCreated(
    snapshot: ProjectSnapshot,
    wingfoilDir: string,
    before: PresetEntryId,
    file: string,
    created: PresetEntryId,
    log: WriteLogger,
  ): Promise<boolean> {
    try {
      if (!(await this.stillHere(wingfoilDir, before, file, created))) return false;
      if (await snapshot.git.hasIndexEntry(UI_YAML)) return false;
      await this.fs.unlink(file);
      await snapshot.check().catch(() => undefined);
      return true;
    } catch (error) {
      log.warn(
        { kind: (error as Error).name, code: (error as NodeJS.ErrnoException).code },
        'preset write: not removed',
      );
      return false;
    }
  }

  /** The first-parent commits since `before` (from the root for an unborn start) with `subject`. */
  private async commitsWithSubject(
    snapshot: ProjectSnapshot,
    before: string,
    subject: string,
  ): Promise<CommitSummary[]> {
    const commits = before === UNBORN_HEAD ? await snapshot.git.commitsFromRoot() : await snapshot.commitsSince(before);
    return commits.filter((c) => c.subject === subject);
  }

  /** The commit changes the file only, holds the working-tree blob, and the file is still `text` (D60-8). */
  private async holdsTheFile(snapshot: ProjectSnapshot, sha: string, text: string): Promise<boolean> {
    try {
      if (!(await snapshot.isWriteCommit(sha, UI_YAML))) return false;
      const entry = await readUiYaml(snapshot.root);
      return entry.kind === 'text' && entry.text === text;
    } catch {
      return false;
    }
  }
}
