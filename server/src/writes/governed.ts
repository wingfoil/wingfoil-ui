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
 * | 7 | the element file has no local changes | 409 `local-changes` | **fresh** `git status` and the blob identity of the file (D32-1), under the lock |
 * | 8 | (task-033: the copy is not behind, diverged or detached) | | |
 * | 9 | the element file's status is `expectedStatus` | 409 `element-changed` | **fresh** direct read, under the lock |
 *
 * Rows 1–4 are the guards and the route's. Rows 5–6 start no process once the console has read the
 * project in its current state (the page has); no `wingfoil` process starts before row 9 passes.
 * The role is the CLI's to check (dl-002, REQ-SEC-07). On success: the commits the CLI made
 * (D32-4), each appended to the action log (`{sha, at}`, spec-006 §2; D32-8), the snapshot moved to
 * the new state, the push port (D32-7), then one `write` event. The reason is a user value: it
 * reaches the CLI as one argument and is never logged.
 */
import type {
  ApiError,
  MemoryMatch,
  ProjectEntry,
  WriteCommit,
  WritePush,
  WriteResponse,
} from '@wingfoil-ui/contracts';
import { CliError, CliInternalError, cliErrorEnvelope, type CliOutput, type WingfoilCli } from '../cli/adapter.js';
import { CliNotFoundError } from '../cli/discovery.js';
import type { EventBus } from '../events/bus.js';
import { matchIdentity } from '../identity/identity.js';
import type { WriteLock } from '../process/write-lock.js';
import { DirectReadError } from '../reads/confine.js';
import { readElement } from '../reads/element.js';
import type { ProjectSnapshot } from '../snapshot/snapshot.js';
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

/** No push attempted: `{ status: "off" }` (until task-034). */
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

/** An expected end of the write, answered as its envelope. */
class Refusal extends Error {
  constructor(readonly outcome: WriteOutcome) {
    super('refused');
  }
}

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
 * Whether `subject` is the one the CLI writes for `verb` on `id` of type `type` (W-15):
 * `wf(<type>): <verb> <id>`, then the end or ` [<from> → <to>]`.
 */
export function isWriteSubject(subject: string, type: string, verb: GovernedVerb, id: string): boolean {
  const prefix = `wf(${type}): ${verb} ${id}`;
  return subject === prefix || subject.startsWith(`${prefix} [`);
}

/** ISO 8601 UTC to the second (spec-006 §2 `at`). */
function isoSeconds(date: Date): string {
  return date.toISOString().replace(/\.\d+Z$/, 'Z');
}

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
      if (error instanceof Refusal) return error.outcome;
      if (error instanceof CliInternalError && request.verb !== 'submit') {
        const message = reasonRefusal(error);
        if (message !== undefined) return refuse(422, 'cli-refused', message);
      }
      if (error instanceof CliError || error instanceof CliNotFoundError) {
        const { status, body } = cliErrorEnvelope(error);
        return { status, body };
      }
      throw error;
    }
  }

  private async run(entry: ProjectEntry, request: GovernedWriteRequest, log: WriteLogger): Promise<WriteOutcome> {
    const { snapshots, writeLock, bus } = this.options;
    const snapshot = await snapshots.open(entry.id, entry.path);
    const view = await snapshot.view();
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
    // The element, looked up in the state's list — never a path built from `:eid` (D32-10).
    const match = (await view.elements()).matches.find((m) => m.match.id === request.eid)?.match;
    if (match === undefined) return refuse(404, 'not-found', 'Not found');

    const done = await writeLock.run(snapshot.lockKey, () => this.locked(snapshot, match, request, log));
    if (!('commits' in done.body)) return done;
    const commit = done.body.commits.at(-1)!.sha;
    bus.publish({ event: 'write', data: { pid: request.pid, eid: request.eid, commit } });
    return done;
  }

  /** Rows 7–9, the CLI and what follows, under the lock. */
  private async locked(
    snapshot: ProjectSnapshot,
    match: MemoryMatch,
    request: GovernedWriteRequest,
    log: WriteLogger,
  ): Promise<WriteOutcome> {
    // Row 7, fresh: the status, then what the status cannot show (D32-1).
    const fresh = await snapshot.freshStatus();
    if (fresh.changed.has(match.path) || !(await snapshot.sameBlobEverywhere(match.path))) {
      return refuse(409, 'local-changes', 'The element file has local changes');
    }
    // Row 8 (task-033) goes here.
    // Row 9, fresh: the file at its listed path holds this element in the status the page showed.
    try {
      await readElement(snapshot.root, { ...match, status: request.expectedStatus });
    } catch (error) {
      if (!(error instanceof DirectReadError)) throw error;
      if (error.kind === 'mismatch' || error.kind === 'missing') {
        return refuse(409, 'element-changed', 'This element changed since you opened it');
      }
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
    const cli = await snapshot.cli();
    const output = await this.verb(cli, request);
    const commits = (await snapshot.commitsSince(fresh.head))
      .filter((c) => isWriteSubject(c.subject, match.type, request.verb, request.eid))
      .reverse();
    if (commits.length === 0) {
      log.warn({ verb: request.verb }, 'governed write: the CLI answered without its commit');
      return refuse(502, 'cli-output', `Unexpected output of memory ${request.verb}`);
    }
    await this.logActions(
      commits.map((c) => ({ sha: c.sha, at: isoSeconds(c.at) })),
      log,
    );
    // A read after the `write` event sees the new state (git only).
    await snapshot.check().catch((error: unknown) => {
      log.warn({ kind: (error as Error).name }, 'governed write: state check failed');
    });
    const push = await this.push.push({ pid: request.pid, snapshot });
    const listed: WriteCommit[] = commits.map(({ sha, subject }) => ({ sha, subject }));
    return { status: 200, body: { result: output.data as unknown as Record<string, unknown>, commits: listed, push } };
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
