/**
 * Review R5 of task-029: the local registry of the staging publish smoke runs detached — in its
 * own process group, so a Ctrl-C to the terminal's group does not reach it — and a smoke run
 * interrupted before its `afterAll` would leave it running. {@link killGroupOnExit} kills that
 * group on SIGINT, SIGTERM, SIGHUP and on the process `exit`, then lets the signal take its usual
 * course. Kept free of imports (type-only syntax), so a plain Node.js child can load it with type
 * stripping (`registry-cleanup.publish.test.ts`).
 */

/** The signals after which the registry's group is killed. */
export const CLEANUP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

/**
 * Kill the process group `pgid` (SIGKILL) when this process gets one of {@link CLEANUP_SIGNALS} or
 * exits. A signal is raised again after the kill, with the handlers removed, so the process ends as
 * it would have (unless another listener of that signal decides otherwise). Returns `remove()`,
 * which takes the handlers off — call it on a normal stop.
 */
export function killGroupOnExit(pgid: number): () => void {
  const kill = (): void => {
    try {
      process.kill(-pgid, 'SIGKILL');
    } catch {
      // already gone
    }
  };
  const handlers = new Map<NodeJS.Signals, () => void>();
  const onExit = (): void => kill();
  const remove = (): void => {
    process.removeListener('exit', onExit);
    for (const [signal, handler] of handlers) process.removeListener(signal, handler);
    handlers.clear();
  };
  for (const signal of CLEANUP_SIGNALS) {
    const handler = (): void => {
      kill();
      remove();
      process.kill(process.pid, signal);
    };
    handlers.set(signal, handler);
    process.once(signal, handler);
  }
  process.once('exit', onExit);
  return remove;
}
