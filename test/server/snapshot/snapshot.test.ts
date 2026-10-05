// REQ-STATE-02 (TT-STATE-02, S-26.1/S-26.3 API side) — cached reads keyed on HEAD, the
// working-tree status hash and the effective `user.email`; REQ-STATE-01 (TT-STATE-01, S-25.1–S-25.3
// API side) — the local-changes marker; REQ-PERF-05 (one CLI process per command and state, shared
// by concurrent views). On the real kanban fixture and the pinned CLI, the watcher off: the state
// moves only by `check()`.
import { appendFile, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CliRefusedError } from '../../../server/src/cli/adapter.js';
import { CliNotFoundError } from '../../../server/src/cli/discovery.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import {
  buildFixture,
  copyFixture,
  envWithoutWingfoil,
  installCliStub,
  removeCli,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from './support.js';

const TASK_001 = 'docs/memory/task/task-001-login-form.md';
let root: string;
let template: Fixture;
let n = 0;
const registries: Snapshots[] = [];

async function fresh(envFor: (fx: Fixture) => Promise<NodeJS.ProcessEnv> = async (fx) => fx.env) {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  const audited = auditedSnapshots(await envFor(fx));
  registries.push(audited.snapshots);
  const snapshot = await audited.snapshots.open(`p${n}`, fx.dir);
  return { fx, snapshot, ...audited };
}

/** The element paths `git status --porcelain` lists (renames: both sides). */
async function porcelainPaths(fx: Fixture): Promise<Set<string>> {
  const out = (await git(fx.dir, ['status', '--porcelain', '-z', '--untracked-files=all'], fx.env)).stdout;
  const paths = new Set<string>();
  const records = out.split('\0').filter(Boolean);
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i]!;
    paths.add(record.slice(3));
    if (record[0] === 'R' || record[0] === 'C') paths.add(records[++i]!);
  }
  return paths;
}

async function commitAll(fx: Fixture, message: string): Promise<void> {
  await git(fx.dir, ['add', '-A'], fx.env);
  await git(fx.dir, ['commit', '-qm', message], fx.env);
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-snapshot-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

describe('TT-STATE-02 — cache keyed on HEAD, working-tree status and user.email', () => {
  it('hits with no change, misses after a working-tree edit and after a commit, new identity after user.email', async () => {
    const { fx, snapshot, runner } = await fresh();
    const first = await snapshot.view();
    expect(first.state.key).toMatch(/^[0-9a-f]{40}\.[0-9a-f]{16}$/);
    expect(first.state.email).toBe('alex@example.test');
    await first.elements();
    expect(runner.count('wingfoil')).toBe(1);

    // Hit: same view, a new view, and a new view after a check that found no change.
    await first.elements();
    await (await snapshot.view()).elements();
    await snapshot.check();
    const unchanged = await snapshot.view();
    expect(unchanged.state.key).toBe(first.state.key);
    await unchanged.elements();
    expect(runner.count('wingfoil')).toBe(1);

    // Miss: a working-tree edit (the CLI reads the working tree).
    const file = path.join(fx.dir, TASK_001);
    await writeFile(file, (await readFile(file, 'utf8')).replace('title: "Login form"', 'title: "Login form v2"'));
    await snapshot.check();
    const edited = await snapshot.view();
    expect(edited.state.head).toBe(first.state.head);
    expect(edited.state.statusHash).not.toBe(first.state.statusHash);
    const list = await edited.elements();
    expect(runner.count('wingfoil')).toBe(2);
    expect(list.matches.find((m) => m.match.id === 'task-001-login-form')?.match.title).toBe('Login form v2');

    // Miss: a commit (HEAD moves; the status is clean again).
    await commitAll(fx, 'edit outside the UI');
    await snapshot.check();
    const committed = await snapshot.view();
    expect(committed.state.head).not.toBe(first.state.head);
    expect(committed.state.statusHash).toBe(first.state.statusHash);
    await committed.elements();
    expect(runner.count('wingfoil')).toBe(3);

    // New identity: user.email changed, HEAD and status did not.
    await git(fx.dir, ['config', 'user.email', 'morgan@example.test'], fx.env);
    await snapshot.check();
    const morgan = await snapshot.view();
    expect(morgan.state.key).toBe(committed.state.key);
    expect(morgan.state.email).toBe('morgan@example.test');
    await morgan.elements();
    expect(runner.count('wingfoil')).toBe(4);
  });

  it('runs one process per command and state for concurrent views (REQ-PERF-05)', async () => {
    const { snapshot, runner } = await fresh();
    const views = await Promise.all([snapshot.view(), snapshot.view(), snapshot.view()]);
    await Promise.all(views.flatMap((v) => [v.elements(), v.dna(), v.directives(), v.elements(), v.dna()]));
    expect(runner.wingfoilCommands().sort()).toEqual(['directives list', 'dna show', 'memory search']);
  });

  it('serves element(id), directive(id) and history(id) from the cached lists', async () => {
    const { snapshot, runner } = await fresh();
    const view = await snapshot.view();
    await view.elements();
    await view.directives();
    const before = runner.count('wingfoil');
    const element = await view.element('task-001-login-form');
    expect(element?.content.frontmatter.status).toBe('pending');
    expect(element?.localChanges).toBe(false);
    const directives = (await view.directives()).data.entries;
    if (directives.length > 0) {
      const id = directives[0]!.frontmatter.id;
      expect((await view.directive(id))?.entry.frontmatter.id).toBe(id);
    }
    expect(runner.count('wingfoil')).toBe(before);
    await view.history('task-001-login-form');
    await view.history('task-001-login-form');
    expect(runner.wingfoilCommands().filter((c) => c.startsWith('memory history'))).toHaveLength(1);
    // An unknown id looks in the archived lists once per state.
    expect(await view.element('task-999-none')).toBeUndefined();
    expect(await view.element('task-999-none')).toBeUndefined();
    expect(runner.wingfoilCommands().filter((c) => c.includes('--status'))).toEqual([
      'memory search --status deprecated',
      'memory search --status superseded',
    ]);
    expect(await view.directive('no-such-directive')).toBeUndefined();
  });

  it('keeps a CLI refusal for its state and reads again once the state changes (S-27.1/S-27.2)', async () => {
    const { fx, snapshot, runner } = await fresh();
    const dna = path.join(fx.dir, '.wingfoil', 'dna.yaml');
    const valid = await readFile(dna, 'utf8');
    await appendFile(dna, '\n  broken: [unclosed\n');
    await snapshot.check();
    const broken = await snapshot.view();
    await expect(broken.dna()).rejects.toBeInstanceOf(CliRefusedError);
    await expect(broken.dna()).rejects.toBeInstanceOf(CliRefusedError);
    expect(runner.wingfoilCommands()).toEqual(['dna show']);
    await writeFile(dna, valid);
    await snapshot.check();
    const fixed = await snapshot.view();
    expect((await fixed.dna()).data.modules).toBeDefined();
    expect(runner.wingfoilCommands()).toEqual(['dna show', 'dna show']);
  });

  it('runs CLI discovery once per CLI generation; cliChanged() starts a new one', async () => {
    // No `wingfoil` on the PATH: without the project's own CLI there is none.
    const { fx, snapshot, runner, events } = await fresh((f) => envWithoutWingfoil(f.env, path.join(root, `bin-${n}`)));
    expect(await (await snapshot.view()).version()).toBe('0.2.2');
    expect(await (await snapshot.view()).version()).toBe('0.2.2');
    expect(runner.count('wingfoil')).toBe(1);
    await installCliStub(fx, { version: '0.2.3' });
    snapshot.cliChanged();
    expect(await (await snapshot.view()).version()).toBe('0.2.3');
    expect(events).toContainEqual({ event: 'repo', data: { pid: snapshot.pid, state: snapshot.current()!.key } });
    await removeCli(fx);
    snapshot.cliChanged();
    await expect((await snapshot.view()).version()).rejects.toBeInstanceOf(CliNotFoundError);
  });

  it('publishes `repo {pid, state}` when a check finds a new state, and nothing when it does not', async () => {
    const { fx, snapshot, events } = await fresh();
    const first = await snapshot.state();
    await snapshot.check();
    expect(events).toEqual([]);
    await writeFile(path.join(fx.dir, 'notes.txt'), 'x\n');
    const next = await snapshot.check();
    expect(next.key).not.toBe(first.key);
    expect(events).toEqual([{ event: 'repo', data: { pid: snapshot.pid, state: next.key } }]);
    await git(fx.dir, ['config', 'user.email', 'casey@example.test'], fx.env);
    await snapshot.check();
    expect(events).toHaveLength(2);
  });

  it('coalesces concurrent checks', async () => {
    const { snapshot, runner } = await fresh();
    await snapshot.state();
    const before = runner.count('git');
    await Promise.all([snapshot.check(), snapshot.check(), snapshot.check(), snapshot.check()]);
    // One running check and at most one queued after it: 2 git processes each.
    expect(runner.count('git') - before).toBeLessThanOrEqual(4);
  });
});

describe('TT-STATE-01 — the local-changes marker', () => {
  async function expectMarkersMatchPorcelain(fx: Fixture, snapshot: Awaited<ReturnType<typeof fresh>>['snapshot']) {
    await snapshot.check();
    const list = await (await snapshot.view()).elements();
    const changed = await porcelainPaths(fx);
    for (const { match, localChanges } of list.matches) expect(localChanges, match.path).toBe(changed.has(match.path));
    return list;
  }

  it('no element carries the marker on a clean copy', async () => {
    const { fx, snapshot } = await fresh();
    const list = await expectMarkersMatchPorcelain(fx, snapshot);
    expect(list.matches.length).toBeGreaterThan(0);
    expect(list.matches.every((m) => !m.localChanges)).toBe(true);
  });

  it('S-25.1/S-25.3/S-25.2 — modified, staged and untracked new elements carry it; committed, none does', async () => {
    const { fx, snapshot } = await fresh();
    // S-25.1: an uncommitted title edit, read as the working tree.
    const file = path.join(fx.dir, TASK_001);
    await writeFile(file, (await readFile(file, 'utf8')).replace('title: "Login form"', 'title: "Login form v2"'));
    // A staged edit of another element.
    const bug = path.join(fx.dir, 'docs/memory/bug/bug-001-crash-on-save.md');
    await appendFile(bug, '\nMore detail.\n');
    await git(fx.dir, ['add', 'docs/memory/bug/bug-001-crash-on-save.md'], fx.env);
    // S-25.3: an uncommitted new element.
    const draft = 'docs/memory/task/task-009-draft-idea.md';
    await writeFile(
      path.join(fx.dir, draft),
      '---\nid: task-009-draft-idea\ntype: task\ntitle: "Draft idea"\nstatus: draft\n---\n\nIdea.\n',
    );
    const list = await expectMarkersMatchPorcelain(fx, snapshot);
    const marked = list.matches.filter((m) => m.localChanges).map((m) => m.match.id);
    expect(marked.sort()).toEqual(['bug-001-crash-on-save', 'task-001-login-form', 'task-009-draft-idea']);
    expect(list.matches.find((m) => m.match.id === 'task-001-login-form')?.match.title).toBe('Login form v2');
    const element = await (await snapshot.view()).element('task-009-draft-idea');
    expect(element?.localChanges).toBe(true);

    // S-25.2: committed outside the UI → no marker.
    await commitAll(fx, 'commit the edits');
    const after = await expectMarkersMatchPorcelain(fx, snapshot);
    expect(after.matches.some((m) => m.localChanges)).toBe(false);
  });

  it('a renamed element file carries the marker at its new path', async () => {
    const { fx, snapshot } = await fresh();
    await git(fx.dir, ['mv', TASK_001, 'docs/memory/task/task-001-login-form-renamed.md'], fx.env);
    const list = await expectMarkersMatchPorcelain(fx, snapshot);
    expect(list.matches.find((m) => m.match.id === 'task-001-login-form')?.localChanges).toBe(true);
  });
});
