// task-069 AC-2 (D69-2 … D69-4; spec-003 §3, §5, §8; spec-005 §4a) — held gates through the routes,
// on copies of the custom fixture (pinned CLI, real git) with the sw-life-cycle preset and the
// Given steps of S-24.5 and S-24.6 made by WingFoil's verbs: `GET /elements`, `GET /elements/:eid`
// and `GET /today` serve `approveHeld` with the hold and its count from the reference index, every
// body valid against its schema; an ignored `ui.yaml` holds nothing; a `ui.yaml` with no
// `when-references-done` hold builds no index (no `git ls-tree`, no element file read but the one
// opened, D55-9).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import { nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  addReleaseLine,
  buildFixture,
  copyFixture,
  HELD_RELEASE,
  memberByName,
  RELEASE_LINE,
  releaseHeldRelease,
  submitToReleasing,
  usePresetUiConfig,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { auditedSnapshots, type AuditedRunner } from '../snapshot/support.js';

const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const sink = new Writable({ write: (_c, _e, cb) => cb() });

const ajv = new Ajv({ allErrors: true });
const CONTRACTS = path.join(REPO_ROOT, 'contracts');
for (const dir of ['api', 'cli', 'files']) {
  for (const file of await readdir(path.join(CONTRACTS, dir))) {
    ajv.addSchema(JSON.parse(await readFile(path.join(CONTRACTS, dir, file), 'utf8')) as object);
  }
}
ajv.addSchema(JSON.parse(await readFile(path.join(CONTRACTS, 'capabilities.schema.json'), 'utf8')) as object);
function expectSchema(file: string, body: unknown): void {
  const validate = ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`);
  expect(validate, file).toBeDefined();
  expect(validate!(body), `${file}: ${JSON.stringify(validate!.errors)}`).toBe(true);
}

/** A `ui.yaml` written and committed as is. */
async function commitUiYaml(fx: Fixture, text: string): Promise<void> {
  await writeFile(path.join(fx.dir, '.wingfoil/ui.yaml'), text);
  await git(fx.dir, ['add', '.wingfoil/ui.yaml'], fx.env);
  await git(fx.dir, ['commit', '-q', '-m', 'chore(ui): a ui.yaml of the test'], fx.env);
}

/** The fixture variants, built once with the CLI in `beforeAll` (bug-028); each test copies one. */
const VARIANTS = {
  // S-24.5 and S-24.6: the preset, `minor-v0.1` in `releasing`, `rl-v1` in `active`.
  held: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await submitToReleasing(fx);
    await addReleaseLine(fx);
  },
  // `minor-v0.1`, the only element referencing `v1`, released (kind `last`: done).
  released: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await submitToReleasing(fx);
    await addReleaseLine(fx);
    await releaseHeldRelease(fx);
  },
  // A `holds` value outside the schema: the file is ignored (spec-005 §2).
  ignored: async (fx: Fixture) => {
    await submitToReleasing(fx);
    await commitUiYaml(fx, 'version: 1\nholds: { release: { releasing: { approve: sometimes } } }\n');
  },
  // A `never` hold only: no reference index is needed.
  never: async (fx: Fixture) => {
    await submitToReleasing(fx);
    await commitUiYaml(fx, 'version: 1\nholds: { release: { releasing: { approve: never } } }\n');
  },
} satisfies Record<string, (fx: Fixture) => Promise<void>>;
type Variant = keyof typeof VARIANTS;

let ws: TempWorkspace;
const variants = {} as Record<Variant, Fixture>;
let n = 0;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-held-');
  const root = await realpath(ws.dir);
  const template = await buildFixture('custom', { root: path.join(root, 'custom') });
  for (const [name, prepare] of Object.entries(VARIANTS) as [Variant, (fx: Fixture) => Promise<void>][]) {
    variants[name] = await copyFixture(template, path.join(root, `variant-${name}`));
    await prepare(variants[name]);
  }
}, 600_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

/** Element files read through the server's direct reads (`ReadFs.readFile`), by project path. */
function readSpy(root: string): { fs: ReadFs; elementReads: () => string[] } {
  const reads: string[] = [];
  return {
    fs: {
      ...nodeReadFs,
      readFile: async (file) => {
        reads.push(path.relative(root, file));
        return nodeReadFs.readFile(file);
      },
    },
    elementReads: () => reads.filter((f) => f.startsWith('docs/04_memory/')),
  };
}

async function start(variant: Variant, member = 'Morgan' as const) {
  n += 1;
  const fx = await copyFixture(variants[variant], path.join(await realpath(ws.dir), `copy-${n}`));
  await git(fx.dir, ['config', 'user.email', memberByName(member).email], fx.env);
  const spy = readSpy(fx.dir);
  const audited = auditedSnapshots(fx.env, { fs: spy.fs });
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const entry = await store.add({ path: fx.dir, name: fx.name, remote: '' });
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => registerProjectRoutes(a, { store, snapshots: audited.snapshots }),
  });
  apps.push(app);
  const get = async (url: string) => {
    const res = await app.inject({ method: 'GET', url, headers: AUTH });
    return { status: res.statusCode, body: res.json() };
  };
  return { fx, pid: entry.id, runner: audited.runner as AuditedRunner, get, elementReads: spy.elementReads };
}

const lsTrees = (runner: AuditedRunner) => runner.spawned.filter((r) => r.args.includes('ls-tree')).length;
const descriptorOf = (list: any, id: string) => list.elements.find((e: any) => e.id === id)?.descriptor;

describe('held gates through the routes (spec-003 §3, §5, §8; spec-005 §4a)', () => {
  it('S-24.5, S-24.6 — /elements, /elements/:eid and /today serve the holds with their count', async () => {
    const c = await start('held');
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expectSchema('elements.schema.json', list.body);
    // TT-PERF-05: the index adds no CLI process to a cold Memory list (at most 6), and one
    // `git ls-tree` for the state.
    expect(c.runner.count('wingfoil')).toBeLessThanOrEqual(6);
    expect(lsTrees(c.runner)).toBe(1);
    const release = descriptorOf(list.body, HELD_RELEASE);
    expect(release.approveHeld).toEqual({ condition: 'never', reason: { code: 'held-by-config' } });
    expect(release.verbs.map((v: any) => [v.verb, v.to])).toEqual([['reject', 'in-development']]);
    // `minor-v0.1` (`release-line: v1`, `releasing`, not done) references the line by its version.
    const line = descriptorOf(list.body, RELEASE_LINE);
    expect(line.approveHeld).toEqual({
      condition: 'when-references-done',
      reason: { code: 'held-until-references-done', count: 1 },
    });
    expect(line.verbs.map((v: any) => v.verb)).toEqual(['reject']);

    const one = await c.get(`/api/p/${c.pid}/elements/${RELEASE_LINE}`);
    expect(one.status).toBe(200);
    expectSchema('element.schema.json', one.body);
    expect(one.body.descriptor).toEqual(line);

    const today = await c.get(`/api/p/${c.pid}/today?view=approver`);
    expect(today.status).toBe(200);
    expectSchema('today.schema.json', today.body);
    const ids = (rows: any[]) => rows.map((r) => r.element.id);
    expect(ids(today.body.requiresYou)).not.toContain(HELD_RELEASE);
    expect(ids(today.body.requiresYou)).not.toContain(RELEASE_LINE);
    expect(ids(today.body.waitingOnOthers)).toEqual(expect.arrayContaining([HELD_RELEASE, RELEASE_LINE]));
    // The index was built once for the state (one `git ls-tree` per HEAD).
    expect(lsTrees(c.runner)).toBe(1);
  }, 300_000);

  it('a line whose referencing releases are all done is not held: the approve is offered', async () => {
    const c = await start('released');
    const list = await c.get(`/api/p/${c.pid}/elements`);
    const line = descriptorOf(list.body, RELEASE_LINE);
    expect(line).not.toHaveProperty('approveHeld');
    expect(line.verbs.map((v: any) => v.verb)).toEqual(['approve', 'reject']);
  }, 300_000);

  it('an ignored ui.yaml holds nothing', async () => {
    const c = await start('ignored');
    const list = await c.get(`/api/p/${c.pid}/elements`);
    const release = descriptorOf(list.body, HELD_RELEASE);
    expect(release).not.toHaveProperty('approveHeld');
    expect(release.verbs.map((v: any) => v.verb)).toEqual(['approve', 'reject']);
  }, 300_000);

  it('D55-9 — a ui.yaml with no when-references-done hold builds no index', async () => {
    const c = await start('never');
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expect(descriptorOf(list.body, HELD_RELEASE).approveHeld?.condition).toBe('never');
    expect((await c.get(`/api/p/${c.pid}/today?view=approver`)).status).toBe(200);
    expect((await c.get(`/api/p/${c.pid}/elements/${HELD_RELEASE}`)).status).toBe(200);
    expect(lsTrees(c.runner)).toBe(0);
    expect(c.elementReads()).toEqual(['docs/04_memory/planning/v1/minor-v0.1.md']);
  }, 300_000);
});
