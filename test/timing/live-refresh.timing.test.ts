// REQ-PERF-03 (TT-PERF-03) — refresh after an external change: change → view updated within 5 s in
// 20 out of 20 trials (S-26.1, S-25.2, S-27.2 and the identity/DNA changes of S-12.3, S-13.3,
// S-15.3, API side). The page is the read console of the process audits (the real routes): its event stream
// stays open; on `repo` it refetches the view, as TanStack Query invalidation will (task-017).
// Changes: a CLI approval in a terminal (S-26.1), a working-tree edit, its commit (marker removed,
// S-25.2), a `user.email` change, a DNA edit. Timing suite (bug-001): run on a quiet machine; the
// times are printed with the load average.
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_FALLBACK_MS, type Snapshots } from '../../server/src/snapshot/snapshots.js';
import { binScript, PINNED_PACKAGE_DIR } from '../harness/cli.js';
import { buildFixture, type Fixture } from '../harness/fixtures/index.js';
import { git, run } from '../harness/run.js';
import type { SseStream } from '../server/http/sse-client.js';
import { startReadConsole, type ReadConsole } from '../server/http/read-console.js';
import { auditedSnapshots } from '../server/snapshot/support.js';
import { report } from './load.js';

const BUDGET_MS = 5_000;
const TRIALS = 20;
const PID = 'p_refresh00000';
let root: string;
let fx: Fixture;
let snapshots: Snapshots;
let standIn: ReadConsole;
let stream: SseStream;

interface Element {
  id: string;
  title: string;
  status: string;
  localChanges: boolean;
}

async function elements(): Promise<Element[]> {
  return ((await standIn.get(`/api/p/${PID}/elements`)).body as { elements: Element[] }).elements;
}

async function header(): Promise<{ name: string; email: string | null }> {
  const body = (await standIn.get(`/api/p/${PID}`)).body as { name: string; identity: { email?: string } };
  return { name: body.name, email: body.identity.email ?? null };
}

/** Make the change, then measure until `updated()` holds on data refetched after a `repo` event. */
async function trial(change: () => Promise<void>, updated: () => Promise<boolean>): Promise<number> {
  const seen = stream.events().length;
  await change();
  const t0 = performance.now();
  for (;;) {
    const arrived = stream
      .events()
      .slice(seen)
      .some((e) => e.event === 'repo');
    if (arrived && (await updated())) return performance.now() - t0;
    if (performance.now() - t0 > 4 * BUDGET_MS) return Number.POSITIVE_INFINITY;
    await new Promise((r) => setTimeout(r, 20));
  }
}

async function editTitle(id: string, title: string): Promise<void> {
  const file = path.join(fx.dir, 'docs/memory/task', `${id}.md`);
  await writeFile(file, (await readFile(file, 'utf8')).replace(/^title: .*$/m, `title: "${title}"`));
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-refresh-')));
  fx = await buildFixture('kanban', { root });
  const audited = auditedSnapshots(fx.env, { watch: true, fallbackMs: DEFAULT_FALLBACK_MS });
  snapshots = audited.snapshots;
  standIn = await startReadConsole(snapshots, audited.bus, { [PID]: fx.dir });
  stream = await standIn.events();
  await standIn.openMemoryList(PID);
}, 600_000);

afterAll(async () => {
  await standIn.close();
  await snapshots.closeAll();
  await rm(root, { recursive: true, force: true });
});

describe('REQ-PERF-03 — refresh after an external change', () => {
  it('updates the open view within 5 s in 20 out of 20 trials', async () => {
    const times: { kind: string; ms: number }[] = [];
    // S-26.1: approved with the CLI in a terminal, as Morgan (the approver).
    await git(fx.dir, ['config', 'user.email', 'morgan@example.test'], fx.env);
    await expect.poll(async () => (await header()).email, { timeout: 20_000 }).toBe('morgan@example.test');
    times.push({
      kind: 'cli-approve',
      ms: await trial(
        async () => {
          await run(
            process.execPath,
            [
              binScript(PINNED_PACKAGE_DIR),
              'memory',
              'approve',
              'task-001-login-form',
              '--reason',
              'ok',
              '--format',
              'json',
              '--no-interactive',
            ],
            { cwd: fx.dir, env: fx.env },
          );
        },
        async () => (await elements()).find((e) => e.id === 'task-001-login-form')?.status === 'approved',
      ),
    });
    const kinds = ['edit', 'commit', 'email', 'dna'] as const;
    let emailTrials = 0;
    for (let i = 1; i < TRIALS; i += 1) {
      const kind = kinds[(i - 1) % kinds.length]!;
      const title = `Password reset ${i}`;
      let ms: number;
      if (kind === 'edit') {
        ms = await trial(
          () => editTitle('task-002-password-reset', title),
          async () => {
            const e = (await elements()).find((x) => x.id === 'task-002-password-reset');
            return e?.title === title && e.localChanges;
          },
        );
      } else if (kind === 'commit') {
        ms = await trial(
          async () => {
            await git(fx.dir, ['commit', '-qam', `edit ${i}`], fx.env);
          },
          async () => (await elements()).every((e) => !e.localChanges),
        );
      } else if (kind === 'email') {
        // A new value every time (the identity starts as Morgan's): the same value is no change.
        emailTrials += 1;
        const email = emailTrials % 2 === 1 ? 'jordan@example.test' : 'alex@example.test';
        ms = await trial(
          async () => {
            await git(fx.dir, ['config', 'user.email', email], fx.env);
          },
          async () => (await header()).email === email,
        );
      } else {
        const name = `kanban-${i}`;
        const dna = path.join(fx.dir, '.wingfoil', 'dna.yaml');
        ms = await trial(
          async () => {
            await writeFile(
              dna,
              (await readFile(dna, 'utf8')).replace(/^(\s*name:\s*)"?kanban[^"\n]*"?\s*$/m, `$1${name}`),
            );
          },
          async () => (await header()).name === name,
        );
      }
      times.push({ kind, ms });
    }
    report('REQ-PERF-03 change → view updated (ms)', times.map((t) => `${t.kind} ${Math.round(t.ms)}`).join(', '));
    expect(times).toHaveLength(TRIALS);
    expect(Math.max(...times.map((t) => t.ms))).toBeLessThanOrEqual(BUDGET_MS);
  }, 300_000);
});
