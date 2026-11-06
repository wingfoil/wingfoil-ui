// spec-005 §2, spec-012 §8, AC-3, task-054 D54-1/D54-7 — `SnapshotView.uiConfig()` on the real
// kanban fixture and the pinned CLI: the working tree's `ui.yaml` per state, memoised (one read per
// state), no process started by the read, a rejection like `memoryTypes()` when `memory.yaml`
// cannot be read. The `/config` section is task-068's (test/server/http/ui-config-route.test.ts).
// task-068 AC-2 (task-054 Q4 (a), spec-001 §4.4 and spec-004 §5 amended 2026-11-06): every edit of
// `ui.yaml` — tracked, untracked or ignored by git — moves the state key and emits `repo`.
import { appendFile, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DirectReadError } from '../../../server/src/reads/confine.js';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from './support.js';

let root: string;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];

async function fresh() {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  const audited = auditedSnapshots(fx.env);
  registries.push(audited.snapshots);
  const snapshot = await audited.snapshots.open(`p${n}`, fx.dir);
  return { fx, snapshot, ...audited };
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-ui-config-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

describe('SnapshotView.uiConfig()', () => {
  it('no ui.yaml → inferred values; an untracked ui.yaml is read at the next state; no process is started by the read', async () => {
    const { fx, snapshot, runner } = await fresh();
    let view = await snapshot.view();
    await view.memoryTypes(); // the read the configuration needs, done first
    const before = runner.spawned.length;
    const none = await view.uiConfig();
    expect(none.status).toEqual({ source: 'none' });
    expect(none.categories.value.get('task')).toBe('work');
    expect(runner.spawned.length).toBe(before);
    // Memoised for the state: the same value, no second read.
    expect(await view.uiConfig()).toBe(none);

    await writeFile(path.join(fx.dir, '.wingfoil', 'ui.yaml'), renderPreset('kanban'));
    await snapshot.check();
    view = await snapshot.view();
    await view.memoryTypes();
    const afterCheck = runner.spawned.length;
    const declared = await view.uiConfig();
    expect(runner.spawned.length).toBe(afterCheck);
    expect(declared.status).toEqual({ source: 'file' });
    expect(declared.categories.origin).toBe('declared');
    expect(declared.progress.phases.value).toEqual(['plan', 'build', 'review', 'deliver']);
  }, 120_000);

  it('an invalid ui.yaml is ignored with its warning; the project folder is redacted from it', async () => {
    const { fx, snapshot } = await fresh();
    await writeFile(path.join(fx.dir, '.wingfoil', 'ui.yaml'), `version: 1\nprogress: { mode: "${fx.dir}" }\n`);
    await snapshot.check();
    const effective = await (await snapshot.view()).uiConfig();
    expect(effective.status).toEqual({
      source: 'ignored',
      warning: { code: 'ui-config-ignored', failure: 'progress.mode must be sequence or flow (found <project>)' },
    });
  }, 120_000);

  it('memory.yaml unreadable → rejects as memoryTypes() does', async () => {
    const { fx, snapshot } = await fresh();
    await writeFile(path.join(fx.dir, '.wingfoil', 'memory.yaml'), 'types: [\n');
    await snapshot.check();
    const view = await snapshot.view();
    const error = await view.uiConfig().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DirectReadError);
    expect(error).toEqual(await view.memoryTypes().catch((e: unknown) => e));
  }, 120_000);
});

describe('task-068 AC-2 — an edit of ui.yaml moves the state key, whatever git says of the file', () => {
  type Fresh = Awaited<ReturnType<typeof fresh>>;
  const repoEvents = (events: unknown[]) => events.filter((e) => (e as { event: string }).event === 'repo').length;

  /** Create, edit and edit again `ui.yaml`: each step a new key, a `repo` event and the new values. */
  async function expectEveryEditSeen({ fx, snapshot, events }: Fresh, label: string): Promise<void> {
    const file = path.join(fx.dir, '.wingfoil', 'ui.yaml');
    const keys = [(await snapshot.check()).key];
    const steps: [string, () => Promise<void>, string][] = [
      ['created', () => writeFile(file, 'version: 1\nprogress: { mode: sequence }\n'), 'sequence'],
      ['edited', () => writeFile(file, 'version: 1\nprogress: { mode: flow }\n'), 'flow'],
      ['edited again', () => appendFile(file, 'artifacts: []\n'), 'flow'],
    ];
    for (const [step, edit, mode] of steps) {
      const before = repoEvents(events);
      await edit();
      const state = await snapshot.check();
      expect(keys, `${label}: ${step}`).not.toContain(state.key);
      keys.push(state.key);
      expect(repoEvents(events), `${label}: ${step} → repo`).toBe(before + 1);
      const effective = await (await snapshot.view()).uiConfig();
      expect(effective.progress.mode, `${label}: ${step}`).toEqual({ value: mode, origin: 'declared' });
    }
    // No edit: the same key, no event.
    const before = repoEvents(events);
    expect((await snapshot.check()).key).toBe(keys.at(-1));
    expect(repoEvents(events)).toBe(before);
  }

  it('ignored by .gitignore (red first: git lists no entry for it)', async () => {
    const f = await fresh();
    await writeFile(path.join(f.fx.dir, '.gitignore'), '.wingfoil/ui.yaml\n');
    await git(f.fx.dir, ['add', '.gitignore'], f.fx.env);
    await git(f.fx.dir, ['commit', '-qm', 'ignore ui.yaml'], f.fx.env);
    await expectEveryEditSeen(f, '.gitignore');
  }, 120_000);

  it('ignored by .git/info/exclude', async () => {
    const f = await fresh();
    await appendFile(path.join(f.fx.dir, '.git', 'info', 'exclude'), '\n.wingfoil/ui.yaml\n');
    await expectEveryEditSeen(f, 'info/exclude');
  }, 120_000);

  it('untracked (characterization: the status entry and the content fingerprint already see it)', async () => {
    await expectEveryEditSeen(await fresh(), 'untracked');
  }, 120_000);

  it('tracked (characterization)', async () => {
    const f = await fresh();
    const file = path.join(f.fx.dir, '.wingfoil', 'ui.yaml');
    await writeFile(file, 'version: 1\n');
    await git(f.fx.dir, ['add', '.wingfoil/ui.yaml'], f.fx.env);
    await git(f.fx.dir, ['commit', '-qm', 'add ui.yaml'], f.fx.env);
    await expectEveryEditSeen(f, 'tracked');
  }, 120_000);
});
