// REQ-STATE-06 on the bin (S-22.1, S-22.2, S-22.3 at API level; the screens close in task-016):
// the kanban and custom fixtures seeded into the console's state directory, the role view set
// with `PUT /api/p/:pid/role-view` against the real git identity and the pinned CLI, kept per
// project and across a restart.
import type { ProjectEntry, StateFile } from '@wingfoil-ui/contracts';
import http from 'node:http';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WingfoilCli } from '../../server/src/cli/adapter.js';
import { discoverCli } from '../../server/src/cli/discovery.js';
import { directivesForRoleView } from '../../server/src/identity/identity.js';
import { createLocalIdentitySource, projectIdentityView } from '../../server/src/identity/project-identity.js';
import { LocalProcessRunner } from '../../server/src/process/runner.js';
import { ProjectReads } from '../../server/src/reads/project-reads.js';
import { pinnedCli } from '../harness/cli.js';
import { buildFixture, type Fixture } from '../harness/fixtures/index.js';
import { git, run } from '../harness/run.js';
import { startLauncher, type Launcher } from './launcher.js';

const KANBAN = 'p_kanbankanban';
const CUSTOM = 'p_c5stmc5stmab';
let root: string;
let stateDir: string;
let kanban: Fixture;
let custom: Fixture;
let env: NodeJS.ProcessEnv;
const started: Launcher[] = [];

function entry(id: string, fx: Fixture): ProjectEntry {
  return { id, path: fx.dir, name: fx.name, remote: '', addedAt: '2026-10-05T08:00:00Z', roleView: '' };
}

async function readState(): Promise<StateFile> {
  return JSON.parse(await readFile(path.join(stateDir, 'state.json'), 'utf8')) as StateFile;
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-role-view-')));
  // Both fixtures under one root share the harness's global git configuration.
  kanban = await buildFixture('kanban', { root });
  custom = await buildFixture('custom', { root });
  stateDir = path.join(root, 'state');
  await mkdir(stateDir, { recursive: true, mode: 0o700 });
  const state: StateFile = {
    version: 1,
    projects: [entry(KANBAN, kanban), entry(CUSTOM, custom)],
    settings: {},
    actionLog: [],
  };
  await writeFile(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2), { mode: 0o600 });
  env = { ...kanban.env, WINGFOIL_UI_STATE_DIR: stateDir };
}, 600_000);

afterAll(async () => {
  for (const l of started) await l.kill();
  await rm(root, { recursive: true, force: true });
});

async function launch(): Promise<Launcher> {
  const l = await startLauncher(['--no-open'], env, 30_000);
  started.push(l);
  return l;
}

function put(l: Launcher, pid: string, body: unknown, auth = true): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: l.port,
        method: 'PUT',
        path: `/api/p/${pid}/role-view`,
        headers: {
          host: `127.0.0.1:${l.port}`,
          'content-type': 'application/json',
          ...(auth ? { authorization: `Bearer ${l.token}` } : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (d: Buffer) => (text += String(d)));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }));
      },
    );
    req.on('error', reject);
    req.end(JSON.stringify(body));
  });
}

describe('REQ-STATE-06 — role views through the console', () => {
  it('S-22.3 keeps developer on kanban and approver on custom, across a restart', async () => {
    const first = await launch();
    // Alex is the fixtures' identity (all seven roles).
    expect((await put(first, KANBAN, { role: 'approver' })).status).toBe(204);
    expect((await put(first, KANBAN, { role: 'developer' })).status).toBe(204);
    expect((await put(first, CUSTOM, { role: 'approver' })).status).toBe(204);
    let state = await readState();
    expect(state.projects.map((p) => [p.id, p.roleView])).toEqual([
      [KANBAN, 'developer'],
      [CUSTOM, 'approver'],
    ]);
    expect(await first.stop()).toBe(0);

    const second = await launch();
    state = await readState();
    const runner = new LocalProcessRunner();
    const identities = createLocalIdentitySource({ runner, env });
    expect((await projectIdentityView(identities, state.projects[0]!)).roleView).toBe('developer');
    expect((await projectIdentityView(identities, state.projects[1]!)).roleView).toBe('approver');
    // A refused PUT leaves the stored view unchanged.
    expect((await put(second, KANBAN, { role: 'ghost-role' })).status).toBe(400);
    expect((await readState()).projects[0]!.roleView).toBe('developer');
    expect(await second.stop()).toBe(0);
  }, 180_000);

  it('S-22.1 switching approver → developer changes "only mine" to the directives bound to developer', async () => {
    const l = await launch();
    const runner = new LocalProcessRunner();
    const reads = new ProjectReads({
      root: custom.dir,
      cli: new WingfoilCli({ cli: await discoverCli(custom.dir, { env }), runner, env }),
    });
    const { entries } = (await reads.directives()).data;
    const mine = async (): Promise<string[]> => {
      const stored = (await readState()).projects.find((p) => p.id === CUSTOM)!;
      const view = await projectIdentityView(createLocalIdentitySource({ runner, env }), stored);
      return directivesForRoleView(entries, view.roleView).map((e) => e.frontmatter.id);
    };
    expect((await put(l, CUSTOM, { role: 'approver' })).status).toBe(204);
    const approver = await mine();
    expect((await put(l, CUSTOM, { role: 'developer' })).status).toBe(204);
    const developer = await mine();
    expect(developer).not.toEqual(approver);
    // The same set as WingFoil's own role filter.
    const byCli = JSON.parse(
      (
        await run(process.execPath, [pinnedCli().script, '--format', 'json', 'directives', 'list', '--role', 'developer'], {
          cwd: custom.dir,
          env,
        })
      ).stdout,
    ) as { entries: { frontmatter: { id: string } }[] };
    expect([...developer].sort()).toEqual(byCli.entries.map((e) => e.frontmatter.id).sort());
    expect(await l.stop()).toBe(0);
  }, 180_000);

  it('S-22.2 refuses a role Jordan does not hold; 403 for a user not in the team; 404, 401', async () => {
    const l = await launch();
    await git(kanban.dir, ['config', 'user.email', 'jordan@example.test'], env);
    expect((await put(l, KANBAN, { role: 'approver' })).status).toBe(400);
    expect((await put(l, KANBAN, { role: 'developer' })).status).toBe(204);
    await git(kanban.dir, ['config', 'user.email', 'riley@example.test'], env);
    const refused = await put(l, KANBAN, { role: 'developer' });
    expect(refused.status).toBe(403);
    expect(JSON.parse(refused.body)).toMatchObject({ error: { code: 'not-in-team' } });
    expect((await put(l, 'p_zzzzzzzzzzzz', { role: 'developer' })).status).toBe(404);
    expect((await put(l, KANBAN, { role: 'developer' }, false)).status).toBe(401);
    await git(kanban.dir, ['config', 'user.email', 'alex@example.test'], env);
    expect(await l.stop()).toBe(0);
  }, 180_000);
});
