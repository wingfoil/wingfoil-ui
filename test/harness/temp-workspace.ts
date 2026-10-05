/**
 * A temporary folder and the processes a test runs in it (red stub: removal only, as the TypeDoc
 * test did before bug-001).
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { run, type RunOptions, type RunResult } from './run.js';

/** A temporary folder owned by one test file. */
export class TempWorkspace {
  private constructor(readonly dir: string) {}

  /** Create a folder `<tmpdir>/<prefix>XXXXXX`. */
  static async create(prefix: string): Promise<TempWorkspace> {
    return new TempWorkspace(await mkdtemp(path.join(tmpdir(), prefix)));
  }

  /** Run a process tied to this workspace. */
  run(file: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
    return run(file, args, options);
  }

  /** Remove the folder. */
  async dispose(): Promise<void> {
    await rm(this.dir, { recursive: true, force: true });
  }
}
