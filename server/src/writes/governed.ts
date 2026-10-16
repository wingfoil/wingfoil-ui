/**
 * The governed writes on an element (spec-004 §3–§6, task-032): `memory submit`, `memory approve
 * --reason`, `memory reject --reason` through the CLI adapter, under the write lock, after the
 * preconditions of spec-004 §4 in their order:
 *
 * | Row | Check | Refusal | Read from |
 * |-----|-------|---------|-----------|
 * | 5 | the user is one member of the team | 403 `not-in-team` | the snapshot view (D32-3) |
 * | 6 | the WingFoil version is in the range | 409 `unsupported-version` | the version cache |
 * | — | `:eid` is listed by `memory search` | 404 `not-found` | the snapshot view (D32-10) |
 * | 7 | the element file has no local changes | 409 `local-changes` | **fresh** `git status` and the whole entry of the file at HEAD, in the index and in the working tree (D32-1, review S2), under the lock |
 * | — | the fresh state lists `:eid` at exactly one path (review S1) | 409 `local-changes` when a listed path has local changes, else 409 `element-changed` | `memory search` of the fresh state, re-read only when the state moved |
 * | 8 | the copy is not behind, diverged or on a detached HEAD (REQ-STATE-04, task-033) | 409 `stale-copy` | the **fresh** state's copy (spec-010 §1), under the lock |
 * | 9 | the element file's status is `expectedStatus` | 409 `element-changed` | **fresh** direct read, under the lock |
 *
 * Rows 1–4 are the guards and the route's. Rows 5–6 start no process once the console has read the
 * project in its current state (the page has); no `wingfoil` write verb starts before row 9 passes
 * (a state that moved meanwhile is listed again first: a read). The role is the CLI's to check
 * (dl-002, REQ-SEC-07). After the CLI: exactly one commit since the write began has the CLI's
 * subject for it, changes the element's path only and holds the file just written (D32-4, review
 * S4) — else 502 `cli-output`. That commit is appended to the action log (`{sha, at}`, spec-006 §2;
 * D32-8), the snapshot moves to the new state, the push port runs (D32-7) and one `write` event goes
 * out, all under the lock. 500 `write-incomplete` (a fixed message, never the CLI's text) when the
 * CLI answers for another path (W2-4: `detail.file` that path, `detail.commit` when found), fails
 * after its commit (W2-5: the commit logged and announced, not pushed; `detail.commit`) or fails
 * leaving the element file changed without a commit (W2-1). The reason is a user value: it reaches
 * the CLI as one argument and is never logged.
 */
import path from 'node:path';
import type {
  ApiError,
  MemoryMatch,
  ProjectEntry,
  WriteCommit,
  WritePush,
  WriteResponse,
} from '@wingfoil-ui/contracts';
import {
  CliError,
  CliInternalError,
  cliErrorEnvelope,
  usageKind,
  type CliOutput,
  type WingfoilCli,
} from '../cli/adapter.js';
import { CliNotFoundError } from '../cli/discovery.js';
import type { EventBus } from '../events/bus.js';
import { blocksWrites } from '../git/copy.js';
import { redactLocalPaths } from '../git/redact.js';
import { matchIdentity } from '../identity/identity.js';
import type { WriteLock } from '../process/write-lock.js';
import { DirectReadError } from '../reads/confine.js';
import { readElement } from '../reads/element.js';
import type { ProjectSnapshot, SnapshotView } from '../snapshot/snapshot.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import type { StateStore } from '../state/store.js';

/** The governed verbs on an element. */
export type GovernedVerb = 'submit' | 'approve' | 'reject';

/** The governed verbs, in route order. */
export const GOVERNED_VERBS: readonly GovernedVerb[] = ['submit', 'approve', 'reject'];

/** What a write asks. */
export interface GovernedWriteRequest {
  pid: string;
  eid: string;
  verb: GovernedVerb;
  expectedStatus: string;
  /** The reason of `approve` and `reject` (validated by the request schema). */
  reason?: string;
}

/** Where the write was made, for the push. */
export interface PushTarget {
  pid: string;
  snapshot: ProjectSnapshot;
}

/**
 * The auto-push after a successful governed write (spec-010 §6, task-032 D32-7): called inside the
 * write lock, after the commit; never throws (a failed push is a successful write). Task-034
 * supplies the implementation that reads `autoPush`.
 */
export interface WritePushPort {
  push(target: PushTarget): Promise<WritePush>;
}

/** No push attempted: `{ status: "off" }` (the default; the launcher wires task-034's `AutoPush`). */
export const PUSH_OFF: WritePushPort = {
  push: () => Promise.resolve({ status: 'off' }),
};

/** Where the writes log (pino's `Logger` fits): kinds and codes only, never a user value. */
export interface WriteLogger {
  warn(object: object, message: string): void;
}

/** Options of {@link GovernedWrites}. */
export interface GovernedWritesOptions {
  store: StateStore;
  snapshots: Snapshots;
  writeLock: WriteLock;
  bus: EventBus;
  push?: WritePushPort;
}

/** The outcome of a write: the HTTP status and body. */
export type WriteOutcome = { status: 200; body: WriteResponse } | { status: number; body: { error: ApiError } };

const refuse = (status: number, code: string, message: string): WriteOutcome => ({
  status,
  body: { error: { code, message } },
});

/**
 * The message of a CLI usage error (exit 2) caused by the reason (D32-5): WingFoil reports a reason
 * it will not record (`invalid flag value: --reason …`) as a usage error; only the reason, a user
 * value, can cause it on an approve or reject the adapter built. `undefined` for any other exit 2.
 */
export function reasonRefusal(error: CliInternalError): string | undefined {
  let text = error.detail.trim();
  try {
    const parsed = JSON.parse(text) as { error?: unknown };
    if (typeof parsed.error === 'string') text = parsed.error;
  } catch {
    // Plain text: as it is.
  }
  return /^invalid flag value: --reason\b/.test(text) ? text : undefined;
}

/**
 * The subject the CLI writes for a transition (W-15): `wf(<type>): submit <id>`, or
 * `wf(<type>): <verb> <id> [<from> → <to>]` for `approve` and `reject`. With `to` unknown (the CLI
 * failed before answering), any target after `<from> → ` matches.
 */
export function isWriteSubject(
  subject: string,
  write: { type: string; verb: GovernedVerb; id: string; from: string; to?: string },
): boolean {
  const base = `wf(${write.type}): ${write.verb} ${write.id}`;
  if (write.verb === 'submit') return subject === base;
  if (write.to !== undefined) return subject === `${base} [${write.from} → ${write.to}]`;
  const open = `${base} [${write.from} → `;
  return subject.startsWith(open) && /^[^[\]]+\]$/.test(subject.slice(open.length));
}

/** ISO 8601 UTC to the second (spec-006 §2 `at`). */
function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z');
}

/** 500 `write-incomplete` (W2-1, W2-4, W2-5): a fixed message, never the CLI's text. */
function incomplete(what: string, detail: { file: string; commit?: string }): WriteOutcome {
  return {
    status: 500,
    body: { error: { code: 'write-incomplete', message: `The write did not finish: ${what}`, detail } },
  };
}

const LOCAL_CHANGES = refuse(409, 'local-changes', 'The element file has local changes');
const ELEMENT_CHANGED = refuse(409, 'element-changed', 'This element changed since you opened it');
const STALE_COPY = refuse(409, 'stale-copy', 'The copy is behind, diverged or on a detached HEAD');

/** The governed writes of the server. */
export class GovernedWrites {
  private readonly push: WritePushPort;

  constructor(private readonly options: GovernedWritesOptions) {
    this.push = options.push ?? PUSH_OFF;
  }

  /** Run one write of `request` on the listed project `entry`; CLI errors are mapped (spec-004 §5). */
  async write(entry: ProjectEntry, request: GovernedWriteRequest, log: WriteLogger): Promise<WriteOutcome> {
    try {
      return await this.run(entry, request, log);
    } catch (error) {
      if (error instanceof CliInternalError && request.verb !== 'submit') {
        const message = reasonRefusal(error);
        // Redacted like every refusal (review round 1 F6, bug-012).
        const roots = this.options.snapshots.get(entry.id)?.localRoots ?? { project: [entry.path] };
        if (message !== undefined) return refuse(422, 'cli-refused', redactLocalPaths(message, roots));
      }
      if (error instanceof CliError || error instanceof CliNotFoundError) {
        const { status, body } = cliErrorEnvelope(error);
        return { status, body };
      }
      throw error;
    }
  }

  private async run(entry: ProjectEntry, request: GovernedWriteRequest, log: WriteLogger): Promise<WriteOutcome> {
    const snapshot = await this.options.snapshots.open(entry.id, entry.path);
    const view = await snapshot.view();
    const refused = await this.identifiedInRange(view);
    if (refused) return refused;
    // The element, looked up in the state's list — never a path built from `:eid` (D32-10).
    const listed = await this.listed(view, request.eid);
    if (listed.length === 0) return refuse(404, 'not-found', 'Not found');
    return this.options.writeLock.run(snapshot.lockKey, () => this.locked(snapshot, view, listed, request, log));
  }

  /** Rows 5 and 6 on `view`, or the refusal. */
  private async identifiedInRange(view: SnapshotView): Promise<WriteOutcome | undefined> {
    // Row 5: the watched identity (a failed `dna show` matches no member, as the header shows it).
    const members = await view.dna().then(
      (dna) => dna.data.team.members,
      () => [],
    );
    if (matchIdentity(view.state.email, members).kind !== 'member') {
      return refuse(403, 'not-in-team', 'Not identified as a member of the team');
    }
    // Row 6: the cached detection (adr-001 D3).
    if (!(await view.detected()).inRange) {
      return refuse(409, 'unsupported-version', 'WingFoil version outside the supported range');
    }
    return undefined;
  }

  /** Every match of `id` in the `memory search` of `view` (more than one: a duplicated id). */
  private async listed(view: SnapshotView, id: string): Promise<MemoryMatch[]> {
    return (await view.elements()).matches.filter((m) => m.match.id === id).map((m) => m.match);
  }

  /** Rows 7–9, the CLI and what follows, under the lock. */
  private async locked(
    snapshot: ProjectSnapshot,
    seen: SnapshotView,
    listed: MemoryMatch[],
    request: GovernedWriteRequest,
    log: WriteLogger,
  ): Promise<WriteOutcome> {
    // Fresh: the state now (git only), not the watcher's last one.
    const state = await snapshot.check();
    const clean = new Map<string, Promise<boolean>>();
    const isClean = (file: string): Promise<boolean> => {
      let value = clean.get(file);
      if (!value) {
        // Row 7: the status, then what the status cannot show (D32-1, review S2).
        value = state.changed.has(file) ? Promise.resolve(false) : snapshot.sameEntryEverywhere(file);
        clean.set(file, value);
      }
      return value;
    };
    const moved = state.key !== seen.state.key || state.email !== seen.state.email;
    let fresh = state;
    // Row 7 on the path the page's state listed, before any other process — unless that path is
    // gone from a state that moved (e.g. the element was moved by a commit): then listed again.
    const first = listed[0]!.path;
    if (!(await isClean(first)) && (!moved || state.changed.has(first))) return LOCAL_CHANGES;
    // Review S1: the state moved since the lookup — list the element again, on the fresh state.
    if (moved) {
      const view = await snapshot.view();
      fresh = view.state;
      const refused = await this.identifiedInRange(view);
      if (refused) return refused;
      listed = await this.listed(view, request.eid);
      if (listed.length === 0) return ELEMENT_CHANGED;
    }
    for (const match of listed) if (!(await isClean(match.path))) return LOCAL_CHANGES;
    // A duplicated id: which file the CLI would take depends on its order (review S1).
    if (listed.length > 1) return ELEMENT_CHANGED;
    const match = listed[0]!;
    // Row 8 (task-033): the copy of the fresh state (spec-010 §1), never a fetch first.
    if (blocksWrites(fresh.copy)) return STALE_COPY;
    // Row 9, fresh: the file at its listed path holds this element in the status the page showed.
    try {
      await readElement(snapshot.root, { ...match, status: request.expectedStatus });
    } catch (error) {
      if (!(error instanceof DirectReadError)) throw error;
      if (error.kind === 'mismatch' || error.kind === 'missing') return ELEMENT_CHANGED;
      log.warn({ kind: error.kind }, 'governed write: element file unreadable');
      return {
        status: 502,
        body: {
          error: {
            code: 'read-error',
            message: `Cannot read ${match.path}: ${error.kind}`,
            detail: { file: match.path, kind: error.kind },
          },
        },
      };
    }
    const write: Parameters<typeof isWriteSubject>[1] = {
      type: match.type,
      verb: request.verb,
      id: request.eid,
      from: request.expectedStatus,
    };
    let output: CliOutput;
    try {
      output = await this.verb(await snapshot.cli(), request);
    } catch (error) {
      if (error instanceof CliError) {
        const incomplete = await this.afterFailure(snapshot, state.head, match, write, error, request, log);
        if (incomplete) return incomplete;
      }
      throw error;
    }
    const data = output.data as { path?: unknown; to?: unknown };
    if (request.verb !== 'submit' && typeof data.to === 'string') write.to = data.to;
    // The CLI acted on the element the checks were made on (review S1); else W2-4.
    if (data.path !== match.path) {
      return this.otherPath(
        snapshot,
        state.head,
        typeof data.path === 'string' ? data.path : '',
        match,
        write,
        request,
        log,
      );
    }
    const commit = await this.settle(snapshot, state.head, match, write, log);
    if (!commit) {
      log.warn({ verb: request.verb }, 'governed write: the CLI answered without its commit');
      return refuse(502, 'cli-output', `Unexpected output of memory ${request.verb}`);
    }
    const push = await this.push.push({ pid: request.pid, snapshot });
    // Inside the lock: no other write starts before the event is out (review F3).
    this.announce(request, commit);
    return {
      status: 200,
      body: { result: output.data as unknown as Record<string, unknown>, commits: [commit], push },
    };
  }

  /**
   * After a failed CLI (review F4, S3, W2-1, W2-5): the write's commit, when the CLI made it before
   * failing, is logged, announced (not pushed) and answered as 500 `write-incomplete` with
   * `detail.commit`; without a commit, an element file left changed is 500 `write-incomplete` too.
   * Never the CLI's text: it quotes local absolute paths and the git command line holding the reason
   * (review round 2 N1). `undefined`: nothing was left — the CLI's error is answered.
   */
  private async afterFailure(
    snapshot: ProjectSnapshot,
    before: string,
    match: MemoryMatch,
    write: Parameters<typeof isWriteSubject>[1],
    error: CliError,
    request: GovernedWriteRequest,
    log: WriteLogger,
  ): Promise<WriteOutcome | undefined> {
    const made = await this.settle(snapshot, before, match, write, log).catch((e: unknown) => {
      log.warn({ kind: (e as Error).name }, 'governed write: commits after a CLI failure not read');
      return undefined;
    });
    if (made) {
      log.warn(
        { verb: request.verb, kind: error.kind, commit: made.sha },
        'governed write: the CLI failed after its commit',
      );
      this.announce(request, made);
      return incomplete('WingFoil failed after its commit', { file: match.path, commit: made.sha });
    }
    if (await this.leftChanged(snapshot, match.path)) {
      // Nothing is restored (no git write).
      log.warn(
        { verb: request.verb, kind: error.kind, cli: usageKind(error.message) },
        'governed write: the element file is left changed without a commit',
      );
      return incomplete('the element file is left changed', { file: match.path });
    }
    return undefined;
  }

  /**
   * The CLI answered for another path than the one checked (review S1, W2-4): 500
   * `write-incomplete` with that path (relative to the project, as the CLI gives it) and the commit
   * the CLI made there, when one is found — logged by sha only, not in the action log, no event.
   */
  private async otherPath(
    snapshot: ProjectSnapshot,
    before: string,
    other: string,
    match: MemoryMatch,
    write: Parameters<typeof isWriteSubject>[1],
    request: GovernedWriteRequest,
    log: WriteLogger,
  ): Promise<WriteOutcome> {
    // Only a relative path of the project is sent; anything else names the checked file.
    const file = other !== '' && !path.isAbsolute(other) && !other.split(/[\\/]/).includes('..') ? other : match.path;
    let commit: string | undefined;
    try {
      const found = [];
      for (const c of await snapshot.commitsSince(before)) {
        if (isWriteSubject(c.subject, write) && (await snapshot.isWriteCommit(c.sha, file))) found.push(c.sha);
      }
      if (found.length === 1) commit = found[0];
    } catch (error) {
      log.warn({ kind: (error as Error).name }, 'governed write: commits on another path not read');
    }
    await snapshot.check().catch(() => undefined);
    log.warn(
      { verb: request.verb, ...(commit ? { commit } : {}) },
      'governed write: the CLI answered for another path',
    );
    return incomplete('WingFoil wrote another file', { file, ...(commit ? { commit } : {}) });
  }

  /** Whether `file` has local changes now (fresh status and entry), after a failed CLI. */
  private async leftChanged(snapshot: ProjectSnapshot, file: string): Promise<boolean> {
    try {
      const state = await snapshot.check();
      return state.changed.has(file) || !(await snapshot.sameEntryEverywhere(file));
    } catch {
      // Unknown: the CLI's error is answered as it is.
      return false;
    }
  }

  /**
   * The commit this write made (D32-4, review S4): of the first-parent commits since `before`, the
   * only one with the CLI's subject for `write` that changes `match.path` alone and holds the file
   * just written. Found: appended to the action log and the snapshot moved to the new state (a read
   * after the `write` event sees it). None, or more than one: `undefined`, nothing logged.
   */
  private async settle(
    snapshot: ProjectSnapshot,
    before: string,
    match: MemoryMatch,
    write: Parameters<typeof isWriteSubject>[1],
    log: WriteLogger,
  ): Promise<WriteCommit | undefined> {
    const candidates = (await snapshot.commitsSince(before)).filter((c) => isWriteSubject(c.subject, write));
    const found = [];
    for (const c of candidates) if (await snapshot.isWriteCommit(c.sha, match.path)) found.push(c);
    if (found.length !== 1) return undefined;
    const [commit] = found as [(typeof found)[number]];
    await this.logActions([{ sha: commit.sha, at: isoSeconds(commit.at) }], log);
    await snapshot.check().catch((error: unknown) => {
      log.warn({ kind: (error as Error).name }, 'governed write: state check failed');
    });
    return { sha: commit.sha, subject: commit.subject };
  }

  /** The `write` event of spec-004 §6. */
  private announce(request: GovernedWriteRequest, commit: WriteCommit): void {
    this.options.bus.publish({ event: 'write', data: { pid: request.pid, eid: request.eid, commit: commit.sha } });
  }

  private verb(cli: WingfoilCli, request: GovernedWriteRequest): Promise<CliOutput> {
    const positionals = [request.eid];
    if (request.verb === 'submit') return cli.run('memory submit', { positionals });
    const options = { '--reason': request.reason ?? '' };
    return request.verb === 'approve'
      ? cli.run('memory approve', { options, positionals })
      : cli.run('memory reject', { options, positionals });
  }

  /** Append to the action log (TT-SEC-10); a failure never fails the write (D32-8). */
  private async logActions(entries: { sha: string; at: string }[], log: WriteLogger): Promise<void> {
    try {
      await this.options.store.transaction((draft) => {
        draft.actionLog.push(...entries);
      });
    } catch (error) {
      log.warn({ kind: (error as Error).name }, 'governed write: action log not written');
    }
  }
}
