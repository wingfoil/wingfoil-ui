/**
 * A temporary folder and the processes a test runs in it (bug-001). {@link TempWorkspace.dispose}
 * first stops every process still running — a test that timed out leaves its process behind,
 * which would recreate files while the folder is removed — waits for them to end, then removes
 * the folder. Call it in `afterAll`: Vitest runs the hook after a timed-out test too.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run, type RunOptions, type RunResult } from './run.js';

/** A temporary folder owned by one test file. */
export class TempWorkspace {
  private readonly abort = new AbortController();
  private readonly running = new Set<Promise<unknown>>();

  private constructor(readonly dir: string) {}

  /** Create a folder `<tmpdir>/<prefix>XXXXXX`. */
  static async create(prefix: string): Promise<TempWorkspace> {
    return new TempWorkspace(await mkdtemp(path.join(tmpdir(), prefix)));
  }

  /** {@link run} a process tied to this workspace: {@link dispose} kills it if it still runs. */
  run(file: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
    const result = run(file, args, { ...options, signal: this.abort.signal });
    const settled = result.catch(() => undefined);
    this.running.add(settled);
    void settled.then(() => this.running.delete(settled));
    return result;
  }

  /** Kill the processes still running, wait for their end, remove the folder. Idempotent. */
  async dispose(): Promise<void> {
    this.abort.abort();
    await Promise.all(this.running);
    await rm(this.dir, { recursive: true, force: true, maxRetries: 5 });
  }
}
