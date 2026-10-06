/**
 * Shared set-up of the snapshot tests: a process runner that records every process it starts and
 * tells the `wingfoil` processes from the git ones (process audit, REQ-PERF-05, REQ-INT-09).
 */
import path from 'node:path';
import { InProcessEventBus } from '../../../server/src/events/bus.js';
import { LocalProcessRunner, type SpawnRecord } from '../../../server/src/process/runner.js';
import { Snapshots, type SnapshotsOptions } from '../../../server/src/snapshot/snapshots.js';

/** What a process is, from its spawn record. */
export function processKind(record: SpawnRecord): 'wingfoil' | 'git' | 'other' {
  if (path.basename(record.file).replace(/\.exe$/, '') === 'git') return 'git';
  if (record.file === process.execPath && /wingfoil/.test(record.args[0] ?? '')) return 'wingfoil';
  return 'other';
}

/** A counting runner. */
export class AuditedRunner extends LocalProcessRunner {
  readonly spawned: SpawnRecord[] = [];

  constructor() {
    super({ onSpawn: (r) => this.spawned.push(r) });
  }

  /** Processes of `kind` started so far. */
  count(kind: 'wingfoil' | 'git'): number {
    return this.spawned.filter((r) => processKind(r) === kind).length;
  }

  /** The `wingfoil` commands started so far (words after `--format json`). */
  wingfoilCommands(): string[] {
    return this.spawned
      .filter((r) => processKind(r) === 'wingfoil')
      .map((r) =>
        r.args
          .slice(1)
          .join(' ')
          .replace(/^--format json /, ''),
      );
  }
}

/** A registry on `env` with an audited runner and a bus recording every event. */
export function auditedSnapshots(env: NodeJS.ProcessEnv, options: Partial<SnapshotsOptions> = {}) {
  const runner = new AuditedRunner();
  const bus = new InProcessEventBus();
  const events: unknown[] = [];
  bus.subscribe((e) => events.push(e));
  const snapshots = new Snapshots({ runner, bus, env, watch: false, fallbackMs: 0, ...options });
  return { runner, bus, events, snapshots };
}
