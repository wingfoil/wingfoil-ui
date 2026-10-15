/**
 * The auto-push of spec-010 §6 (RP-22, RP-33; task-034): the {@link WritePushPort} of the governed
 * writes, called inside the write lock right after the write's commit (task-032 D32-7).
 *
 * | Case | `push` |
 * |------|--------|
 * | `autoPush` off (read again from the local state), or no remote (`has-remote` does not hold) | `{ status: "off" }` |
 * | task-033's push plan refuses (`detached-head`, `no-upstream`, `remote-not-owned`, `remote-unreadable`) | `{ status: "failed", code }` — no process |
 * | nothing ahead of the upstream | `{ status: "pushed" }` — no process (the remote has HEAD) |
 * | the push (`pushArgs`, the manual Push's environment and hooks, RP-23) exits 0 | `{ status: "pushed" }` |
 * | killed after 60 s of process time (RP-33) | `{ status: "failed", code: "push-timeout" }` |
 * | git refuses | `{ status: "failed", message }` — git's message, local paths redacted |
 * | an unexpected error | `{ status: "failed", code: "internal" }`, logged by kind |
 *
 * The push is HEAD, as the manual Push: the user's own unpushed commits go with the write (D34-11),
 * and so does a commit a failed CLI left (W2-5), which is never pushed by itself — there is no
 * periodic push (D34-6). It never throws: a failed push is a successful write.
 */
import type { WritePush } from '@wingfoil-ui/contracts';
import { transportEnv, UNATTENDED_TIMEOUT_MS } from '../git/transport.js';
import type { StateStore } from '../state/store.js';
import type { PushTarget, WritePushPort } from './governed.js';
import type { GitTransport } from './transport.js';

/** Where the auto-push logs: codes and kinds only. */
export interface AutoPushLogger {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
}

/** Options of {@link AutoPush}. */
export interface AutoPushOptions {
  store: Pick<StateStore, 'reload' | 'settings'>;
  /** The routes' transport: its push plan and its message redaction. */
  transport: GitTransport;
  logger: AutoPushLogger;
  /** Time limit of the push (default {@link UNATTENDED_TIMEOUT_MS}); tests lower it. */
  timeoutMs?: number;
}

/** The auto-push. */
export class AutoPush implements WritePushPort {
  constructor(private readonly options: AutoPushOptions) {}

  async push({ pid, snapshot }: PushTarget): Promise<WritePush> {
    const { store, transport, logger } = this.options;
    try {
      // Another console's settings change counts (spec-006 §2).
      await store.reload().catch(() => undefined);
      if (!store.settings().autoPush) return { status: 'off' };
      const state = await snapshot.check();
      if (state.remotes.length === 0) return { status: 'off' };
      const plan = await transport.plan(snapshot, state, 'push');
      if ('refusal' in plan) return { status: 'failed', code: plan.refusal.code };
      if (plan.args === undefined) return { status: 'pushed' };
      const result = await snapshot.git.transport(plan.args, {
        env: transportEnv(await transport.sshConfigured(snapshot), transport.environment),
        timeoutMs: this.options.timeoutMs ?? UNATTENDED_TIMEOUT_MS,
      });
      logger.info({ project: pid, op: 'auto-push', ended: result.ended, exitCode: result.exitCode }, 'git transport');
      // The copy is in sync now (or still ahead): `repo` goes out with the new state.
      await snapshot.check().catch(() => undefined);
      if (result.ended === 'exit' && result.exitCode === 0) return { status: 'pushed' };
      if (result.ended === 'timeout') return { status: 'failed', code: 'push-timeout' };
      return { status: 'failed', message: transport.message(snapshot, result, plan.urls) };
    } catch (error) {
      const e = error as Error & { exitCode?: number | null };
      logger.warn(
        { project: pid, op: 'auto-push', kind: e.name, ...(e.exitCode !== undefined ? { exitCode: e.exitCode } : {}) },
        'auto-push failed',
      );
      return { status: 'failed', code: 'internal' };
    }
  }
}
