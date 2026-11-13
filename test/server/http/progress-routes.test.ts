// task-059 AC-1, AC-3 … AC-7, TT-STATE-08 (D59-2 … D59-12; spec-012 §2, §3, §5, §8 … §11) —
// `GET /api/p/:pid/progress`, the missing-reference flag of `GET /api/p/:pid/elements` and
// `/config` `ui.progress.scope.current`, through the routes on copies of the real fixtures (pinned
// CLI, real git) and the variants of `test/harness/fixtures/progress.ts`: every body valid against
// its schema, the figures behind each `@v0.3` scenario's text, the errors of spec-012 §10, the
// processes (0 for a repeated request, none per element, none of the DNA or the events for
// `/progress`), one file re-read for a commit touching one element, and K1.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { readdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { gitSubcommand } from '../../../server/src/git/git.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import { nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  setFrontmatterValue,
  addSecondRelease,
  buildFixture,
  copyFixture,
  draftRelease,
  installCliStub,
  SECOND_RELEASE,
  usePresetUiConfig,
  addReleaseLine,
  HELD_RELEASE,
  RELEASE_LINE,
  submitToReleasing,
  usePrePacksStates,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { FixtureProject } from '../../harness/fixtures/project.js';
import { pinnedCli, pinnedVersion } from '../../harness/cli.js';
import { naturalOrder } from '../../../server/src/project-state/order.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { auditedSnapshots, processKind, type AuditedRunner } from '../snapshot/support.js';

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

/** Commit `text` as `.wingfoil/ui.yaml`. */
async function commitUiYaml(fx: Fixture, text: string): Promise<void> {
  await writeFile(path.join(fx.dir, '.wingfoil/ui.yaml'), text);
  await git(fx.dir, ['add', '.wingfoil/ui.yaml'], fx.env);
  await git(fx.dir, ['commit', '-q', '-m', 'chore(ui): a ui.yaml of the test'], fx.env);
}

/** Edit element `id`'s file with `edit` and commit it outside the UI. */
async function editElement(fx: Fixture, id: string, edit: (text: string) => string): Promise<void> {
  const files = (await git(fx.dir, ['ls-files', '-z'], fx.env)).stdout.split('\0');
  const rel = files.find((f) => path.basename(f) === `${id}.md`)!;
  const file = path.join(fx.dir, rel);
  await writeFile(file, edit(await readFile(file, 'utf8')));
  await git(fx.dir, ['commit', '-q', '-m', `docs: edit ${id}`, '--', rel], fx.env);
}

/** The variants, built once in `beforeAll` (bug-028); each test copies one. */
const VARIANTS = {
  // The custom fixture with the sw-life-cycle preset (conventions *Preset variant*).
  preset: async (fx: Fixture) => usePresetUiConfig(fx),
  // The custom fixture without ui.yaml.
  plain: async () => {},
  // T-12.4, T-12.6: minor-v0.1 released, minor-v0.2 in development.
  second: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await addSecondRelease(fx);
  },
  // T-12.5: the only release in draft.
  draft: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await draftRelease(fx);
  },
  // M-04.3: every required reference present.
  complete: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await setFrontmatterValue(fx, 'task-004-themes', 'ref', 'US-X-08');
    await setFrontmatterValue(fx, 'adr-001-local-server', 'sard_ref', 'REQ-ARC-01');
  },
  // Review round 1 F-1: minor-v0.1 in `releasing`, held `never` by the preset.
  releasing: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await submitToReleasing(fx);
  },
  // Review round 1 F-1: rl-v1 `active`, held `when-references-done` (minor-v0.1 references it).
  line: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await addReleaseLine(fx);
  },
  // Review round 1 F-2: the current release with an empty `version`.
  emptyVersion: async (fx: Fixture) => {
    await usePresetUiConfig(fx);
    await addSecondRelease(fx);
    await setFrontmatterValue(fx, SECOND_RELEASE, 'version', '');
  },
  // TT-STATE-08's fit criterion (checker N-3): the pre-packs states with the preset, where bug
  // `triaged` is both a gate and a `waiting:` state …
  prePacks: async (fx: Fixture) => {
    await usePrePacksStates(fx);
    await usePresetUiConfig(fx);
  },
  // … and bug-001-toast-overlap approved to `triaged` by Morgan (the verb).
  prePacksTriaged: async (fx: Fixture) => {
    await usePrePacksStates(fx);
    await usePresetUiConfig(fx);
    const p = new FixtureProject({
      dir: fx.dir,
      cli: pinnedCli(),
      cliVersion: pinnedVersion(),
      now: new Date(fx.now.getTime() + 70 * 60 * 1000),
      env: fx.env,
    });
    await p.approve('Morgan', 'bug-001-toast-overlap');
  },
  // spec-012 §2: an ignored ui.yaml.
  ignored: async (fx: Fixture) => commitUiYaml(fx, 'version: 1\nprogress: { mode: spiral }\n'),
} satisfies Record<string, (fx: Fixture) => Promise<void>>;
type Variant = keyof typeof VARIANTS | 'unknown';

let ws: TempWorkspace;
const variants = {} as Record<Variant, Fixture>;
let n = 0;
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-progress-');
  const root = await realpath(ws.dir);
  const template = await buildFixture('custom', { root: path.join(root, 'custom') });
  for (const [name, prepare] of Object.entries(VARIANTS) as [Variant, (fx: Fixture) => Promise<void>][]) {
    variants[name] = await copyFixture(template, path.join(root, `variant-${name}`));
    await prepare(variants[name]);
  }
  variants.unknown = await buildFixture('unknown', { root: path.join(root, 'unknown') });
}, 900_000);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws.dispose();
});

interface StartOptions {
  prepare?: (fx: Fixture) => Promise<void>;
  /** Overrides of the direct reads (by the path's suffix). */
  fs?: (file: string) => Promise<string> | undefined;
}

async function start(variant: Variant, options: StartOptions = {}) {
  n += 1;
  const fx = await copyFixture(variants[variant], path.join(await realpath(ws.dir), `copy-${n}`));
  await options.prepare?.(fx);
  const reads: string[] = [];
  const fs: ReadFs = {
    ...nodeReadFs,
    readFile: async (file) => {
      reads.push(path.relative(fx.dir, file));
      return options.fs?.(file) ?? nodeReadFs.readFile(file);
    },
  };
  const audited = auditedSnapshots(fx.env, { fs });
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
    return { status: res.statusCode, body: res.json(), state: res.headers['x-repo-state'] };
  };
  const snapshot = () => audited.snapshots.open(entry.id, fx.dir);
  const elementReads = () => reads.filter((f) => f.startsWith('docs/04_memory/') && f.endsWith('.md'));
  return { fx, pid: entry.id, runner: audited.runner as AuditedRunner, get, snapshot, elementReads };
}

const progress = async (c: Awaited<ReturnType<typeof start>>) => {
  const res = await c.get(`/api/p/${c.pid}/progress`);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  expectSchema('progress.schema.json', res.body);
  return res.body;
};

describe('GET /api/p/:pid/progress — the figures on the fixtures (TT-STATE-08)', () => {
  it('T-12.1 Show the figures of the current scope — minor-v0.1 planning, 25 %, tasks 1/4, open bugs 1, pending gates 3', async () => {
    const c = await start('preset');
    const body = await progress(c);
    expect(body.ui).toEqual({ source: 'file' });
    expect(body.mode).toBe('sequence');
    expect(body.scope).toMatchObject({
      type: 'release',
      current: { id: 'minor-v0.1', title: 'Minor v0.1', type: 'release', status: 'planning' },
      basis: 'derived',
    });
    expect(body.figures.completion).toMatchObject({ state: 'shown', percent: 25 });
    expect(body.figures.iterated).toMatchObject({ state: 'shown', type: 'task', done: 1, total: 4 });
    expect(body.figures.openDefects).toMatchObject({ state: 'shown', type: 'bug', count: 1 });
    expect(body.figures.pendingGates).toMatchObject({ state: 'shown', count: 3 });
    expect(body.unreadable).toEqual([]);
    expect(body.capped).toEqual([]);
  }, 300_000);

  it('T-12.2 Show whole-project figures without ui.yaml — unknown fixture: type null, pending gates 1, no-reference-categories', async () => {
    const body = await progress(await start('unknown'));
    expect(body.ui).toEqual({ source: 'none' });
    expect(body.mode).toBe('flow');
    expect(body.scope).toEqual({ type: null, current: null, basis: null });
    expect(body.figures.pendingGates).toEqual({ state: 'shown', count: 1, ids: ['story-001-onboarding'] });
    expect(body.figures.completion).toEqual({ state: 'unavailable', reason: { code: 'no-reference-categories' } });
    expect(body.figures.iterated).toEqual({ state: 'unavailable', reason: { code: 'no-iterates-type' } });
    expect(body.figures.openDefects).toEqual({ state: 'unavailable', reason: { code: 'no-defects-type' } });
  }, 300_000);

  it('T-12.4 Move the scope to the most advanced release — minor-v0.2 in-development', async () => {
    const body = await progress(await start('second'));
    expect(body.scope.current).toMatchObject({ id: SECOND_RELEASE, status: 'in-development' });
  }, 300_000);

  it('T-12.5 Say that no release is under way — current null with scope type release, project-wide figures', async () => {
    const body = await progress(await start('draft'));
    expect(body.scope).toEqual({ type: 'release', current: null, basis: null });
    expect(body.figures.iterated).toMatchObject({ total: 4 });
    expect(body.figures.pendingGates).toMatchObject({ count: 3 });
  }, 300_000);

  it('T-12.6 Say that no reference is linked in the current release — no-linked-elements on minor-v0.2', async () => {
    const body = await progress(await start('second'));
    expect(body.scope.current.id).toBe(SECOND_RELEASE);
    expect(body.figures.completion).toEqual({ state: 'unavailable', reason: { code: 'no-linked-elements' } });
  }, 300_000);

  it('T-13.1 Open the items behind "Pending gates" — pendingGates.ids', async () => {
    const body = await progress(await start('preset'));
    // In natural id order (review round 1 F-6).
    expect(body.figures.pendingGates.ids).toEqual([
      'bug-001-toast-overlap',
      'dl-002-use-fastify',
      'task-001-cli-adapter',
    ]);
  }, 300_000);

  it('T-13.2 Open the items behind "Tasks 1/4" — the 4 tasks of v0.1, task-002-memory-list done', async () => {
    const body = await progress(await start('preset'));
    expect(body.figures.iterated.ids).toEqual([
      'task-001-cli-adapter',
      'task-002-memory-list',
      'task-003-element-panel',
      'task-004-themes',
    ]);
    expect(body.figures.iterated.doneIds).toEqual(['task-002-memory-list']);
  }, 300_000);

  it('T-13.3 Clear a figure filter, T-13.4 Ignore an unknown figure code — each shown figure carries the ids the list filters on', async () => {
    const body = await progress(await start('preset'));
    for (const code of ['completion', 'iterated', 'openDefects', 'pendingGates']) {
      expect(body.figures[code].state).toBe('shown');
      expect(Array.isArray(body.figures[code].ids)).toBe(true);
    }
    expect(body.figures.completion.ids).toEqual([
      'task-001-cli-adapter',
      'task-002-memory-list',
      'task-003-element-panel',
    ]);
    expect(body.figures.openDefects.ids).toEqual(['bug-001-toast-overlap']);
  }, 300_000);

  it('T-14.1 Explain the completion figure on hover — US-M-01 50 %, US-S-01 0 %, referencesCount 2', async () => {
    const body = await progress(await start('preset'));
    expect(body.figures.completion).toEqual({
      state: 'shown',
      value: 0.25,
      percent: 25,
      references: [
        { id: 'US-M-01', done: 1, total: 2, percent: 50 },
        { id: 'US-S-01', done: 0, total: 1, percent: 0 },
      ],
      referencesCount: 2,
      ids: ['task-001-cli-adapter', 'task-002-memory-list', 'task-003-element-panel'],
    });
  }, 300_000);

  it.each([
    ['releasing', HELD_RELEASE],
    ['line', RELEASE_LINE],
  ] as const)(
    'review round 1 F-1: a held gate is no pending gate (%s: %s) — the ids are the /elements gates with no approveHeld',
    async (variant, held) => {
      const c = await start(variant);
      const body = await progress(c);
      const list = await c.get(`/api/p/${c.pid}/elements`);
      const heldGate = list.body.elements.find((e: any) => e.id === held);
      expect(heldGate.descriptor.kind).toBe('gate');
      expect(heldGate.descriptor.approveHeld).toBeDefined();
      const gates = list.body.elements
        .filter((e: any) => e.descriptor.kind === 'gate' && e.descriptor.approveHeld === undefined)
        .map((e: any) => e.id);
      expect(body.figures.pendingGates.ids).not.toContain(held);
      expect(body.figures.pendingGates.ids).toEqual(naturalOrder(gates));
      expect(body.figures.pendingGates.count).toBe(gates.length);
    },
    300_000,
  );

  it('TT-STATE-08 fit criterion (checker N-3): pre-packs states and the preset — pending gates 3', async () => {
    expect((await progress(await start('prePacks'))).figures.pendingGates.count).toBe(3);
  }, 300_000);

  it('TT-STATE-08 fit criterion (checker N-3): pending gates 2 once bug-001 is triaged (a gate and a waiting state)', async () => {
    const c = await start('prePacksTriaged');
    const body = await progress(c);
    const list = await c.get(`/api/p/${c.pid}/elements`);
    const bug = list.body.elements.find((e: any) => e.id === 'bug-001-toast-overlap');
    expect(bug.status).toBe('triaged');
    expect(bug.descriptor.kind).toBe('gate-waiting');
    expect(body.figures.pendingGates.count).toBe(2);
    expect(body.figures.pendingGates.ids).not.toContain('bug-001-toast-overlap');
  }, 300_000);

  it('review round 1 F-2: a current release with an empty version scopes nothing — tasks 0/0, no-linked-elements', async () => {
    const body = await progress(await start('emptyVersion'));
    expect(body.scope.current.id).toBe(SECOND_RELEASE);
    expect(body.figures.iterated).toMatchObject({ state: 'shown', done: 0, total: 0, ids: [] });
    expect(body.figures.completion).toEqual({ state: 'unavailable', reason: { code: 'no-linked-elements' } });
  }, 300_000);

  it('AC-1 the phase figures are read-only with the workflow-position reason of the header', async () => {
    const c = await start('preset');
    const body = await progress(c);
    const header = await c.get(`/api/p/${c.pid}`);
    const capability = header.body.capabilities.capabilities.find((x: any) => x.id === 'workflow-position');
    expect(capability.state).toBe('read-only');
    expect(body.figures.phase).toEqual({ state: 'read-only', reason: capability.reason });
    expect(body.figures.phaseCompletion).toEqual({ state: 'read-only', reason: capability.reason });
    expect(capability.reason).toEqual({ code: 'not-in-release' });
  }, 300_000);
});

describe('GET /api/p/:pid/elements — the missing-reference flag (spec-012 §5)', () => {
  it('M-03.1 Filter the elements missing a required reference — missingCategories on exactly task-004 and adr-001', async () => {
    const c = await start('preset');
    const res = await c.get(`/api/p/${c.pid}/elements`);
    expect(res.status).toBe(200);
    expectSchema('elements.schema.json', res.body);
    const flagged = res.body.elements
      .filter((e: any) => e.missingCategories)
      .map((e: any) => [e.id, e.missingCategories]);
    expect(flagged.sort()).toEqual([
      ['adr-001-local-server', ['requirement']],
      ['task-004-themes', ['requirement']],
    ]);
    expect(res.body.missingReferences).toEqual({ shown: true, unreadable: [], capped: [] });
  }, 300_000);

  it('M-04.3 Show the filter with 0 when every required reference is present — shown, no missingCategories', async () => {
    const c = await start('complete');
    const res = await c.get(`/api/p/${c.pid}/elements`);
    expectSchema('elements.schema.json', res.body);
    expect(res.body.elements.some((e: any) => e.missingCategories)).toBe(false);
    expect(res.body.missingReferences).toEqual({ shown: true, unreadable: [], capped: [] });
  }, 300_000);

  it.each(['plain', 'unknown'] as const)(
    'AC-3 without requires (%s): shown false, no flag, and no index (no element file read; only the ls-tree of the read tie)',
    async (variant) => {
      const c = await start(variant);
      const res = await c.get(`/api/p/${c.pid}/elements`);
      expectSchema('elements.schema.json', res.body);
      expect(res.body.missingReferences).toEqual({ shown: false, unreadable: [], capped: [] });
      expect(res.body.elements.some((e: any) => e.missingCategories)).toBe(false);
      // No index: no element file read. The one HEAD listing is the read tie's (task-075 D75-2:
      // `.wingfoil` and the Memory folders, one `git ls-tree -r` per new HEAD for the direct reads).
      const lsTrees = c.runner.spawned.filter((r) => r.args.includes('ls-tree'));
      expect(lsTrees.length).toBeLessThanOrEqual(1);
      for (const r of lsTrees) expect(r.args.slice(r.args.indexOf('--') + 1)).toContain('.wingfoil');
      expect(c.elementReads()).toEqual([]);
    },
    300_000,
  );

  it('AC-3 archived rows carry no flag; the element read carries none', async () => {
    const c = await start('preset');
    const all = await c.get(`/api/p/${c.pid}/elements?archived=true`);
    expectSchema('elements.schema.json', all.body);
    const one = await c.get(`/api/p/${c.pid}/elements/task-004-themes`);
    expect(one.status).toBe(200);
    expect(JSON.stringify(one.body)).not.toContain('missingCategories');
  }, 300_000);

  it('AC-3 absent with typesError (memory.yaml unreadable)', async () => {
    const c = await start('preset', {
      fs: (f) => (f.endsWith(`${path.sep}memory.yaml`) ? Promise.reject(new Error('EACCES')) : undefined),
    });
    const res = await c.get(`/api/p/${c.pid}/elements`);
    expect(res.status).toBe(200);
    expect(res.body.typesError).toBeDefined();
    expect(res.body).not.toHaveProperty('missingReferences');
  }, 300_000);
});

describe('/config ui.progress.scope.current (D59-2, Q6)', () => {
  it.each([
    ['T-12.1', 'preset', 'minor-v0.1'],
    ['T-12.4', 'second', SECOND_RELEASE],
    ['T-12.5', 'draft', null],
  ] as const)(
    '%s: the same derived element as /progress (%s)',
    async (_id, variant, id) => {
      const c = await start(variant);
      const config = await c.get(`/api/p/${c.pid}/config`);
      expectSchema('config.schema.json', config.body);
      const body = await progress(c);
      expect(config.body.ui.progress.scope.current?.id ?? null).toBe(id);
      expect(config.body.ui.progress.scope.current).toEqual(body.scope.current);
    },
    300_000,
  );
});

describe('spec-012 §10 — errors (AC-4)', () => {
  it('unknown :pid → 404; any query parameter → 400 invalid-request', async () => {
    const c = await start('preset');
    expect((await c.get('/api/p/p_0000000000zz/progress')).status).toBe(404);
    const bad = await c.get(`/api/p/${c.pid}/progress?scope=project`);
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('invalid-request');
  }, 300_000);

  it.each([
    { exitCode: 1, stderr: '{"error":"E_BOOM: boom"}', code: 'cli-refused' },
    { exitCode: 2, stderr: 'error: boom', code: 'internal' },
  ])(
    'memory search fails (exit $exitCode) → the CLI envelope, no partial figures (as /elements answers it)',
    async ({ code, ...failure }) => {
      const c = await start('preset', {
        prepare: (fx) =>
          installCliStub(fx, { failures: [{ command: ['memory', 'search'], ...failure }] }).then(() => {}),
      });
      const res = await c.get(`/api/p/${c.pid}/progress`);
      const list = await c.get(`/api/p/${c.pid}/elements`);
      expect(res.status).toBe(list.status);
      expect(res.body).toEqual(list.body);
      expect(res.body.error.code).toBe(code);
      expect(res.body).not.toHaveProperty('figures');
    },
    300_000,
  );

  it('memory.yaml unreadable → 502 read-error', async () => {
    const c = await start('preset', {
      fs: (f) => (f.endsWith(`${path.sep}memory.yaml`) ? Promise.reject(new Error('EACCES')) : undefined),
    });
    const res = await c.get(`/api/p/${c.pid}/progress`);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatchObject({ code: 'read-error', detail: { file: '.wingfoil/memory.yaml' } });
  }, 300_000);

  it('ui.yaml ignored → 200 with ui.status and the inferred values', async () => {
    const ignored = await progress(await start('ignored'));
    expect(ignored.ui).toMatchObject({ source: 'ignored', warning: { code: 'ui-config-ignored' } });
    expect(ignored.mode).toBe('flow');
    expect(ignored.scope).toEqual({ type: null, current: null, basis: null });
  }, 300_000);

  it('ui.yaml missing → 200 with ui.status and the inferred values', async () => {
    const none = await progress(await start('plain'));
    expect(none.ui).toEqual({ source: 'none' });
    expect(none.figures.iterated).toMatchObject({ state: 'shown', type: 'task', total: 4 });
  }, 300_000);

  it('an unreadable element file and one with 201 values → unreadable / capped (also on /elements)', async () => {
    const c = await start('preset', {
      prepare: async (fx) => {
        // Above the index's 64 KiB frontmatter bound (bug-032): a `shape` error the CLI does not have.
        await setFrontmatterValue(fx, 'task-004-themes', 'notes', 'x'.repeat(70_000));
        const list = Array.from({ length: 201 }, (_, i) => `v-${i}`).join(', ');
        await editElement(fx, 'task-003-element-panel', (t) => t.replace(/^title: /m, `extra: [${list}]\ntitle: `));
      },
    });
    const body = await progress(c);
    expect(body.unreadable).toEqual(['task-004-themes']);
    expect(body.capped).toEqual(['task-003-element-panel']);
    const list = await c.get(`/api/p/${c.pid}/elements`);
    expectSchema('elements.schema.json', list.body);
    expect(list.body.missingReferences).toEqual({
      shown: true,
      unreadable: ['task-004-themes'],
      capped: ['task-003-element-panel'],
    });
  }, 300_000);

  it('dna show failing does not fail /progress; /progress reads neither the DNA nor the events', async () => {
    const c = await start('preset', {
      prepare: (fx) =>
        installCliStub(fx, { failures: [{ command: ['dna', 'show'], exitCode: 2, stderr: 'error: boom' }] }).then(
          () => {},
        ),
    });
    const body = await progress(c);
    expect(body.figures.pendingGates).toMatchObject({ count: 3 });
    expect(c.runner.wingfoilCommands().some((x) => x.startsWith('dna show'))).toBe(false);
    expect(c.runner.spawned.filter((r) => processKind(r) === 'git').map((r) => gitSubcommand(r.args))).not.toContain(
      'log',
    );
  }, 300_000);
});

describe('caching and processes (AC-5, AC-7, spec-012 §8)', () => {
  it('a repeated /progress and /elements start 0 processes; X-Repo-State on each answer', async () => {
    const c = await start('preset');
    const first = await c.get(`/api/p/${c.pid}/progress`);
    await c.get(`/api/p/${c.pid}/elements`);
    const before = c.runner.spawned.length;
    const again = await c.get(`/api/p/${c.pid}/progress`);
    await c.get(`/api/p/${c.pid}/elements`);
    expect(c.runner.spawned.length).toBe(before);
    expect(again.body).toEqual(first.body);
    expect(first.state).toBeTruthy();
    expect(again.state).toBe(first.state);
  }, 300_000);

  it('a cold Today with the progress card adds 0 CLI processes (≤ 6 in all) and none per element', async () => {
    const c = await start('preset');
    await c.get(`/api/p/${c.pid}`);
    await c.get(`/api/p/${c.pid}/today`);
    await c.get(`/api/p/${c.pid}/events/memory?limit=5`);
    const cli = c.runner.count('wingfoil');
    await progress(c);
    expect(c.runner.count('wingfoil')).toBe(cli);
    expect(cli).toBeLessThanOrEqual(6);
    const kinds = c.runner.spawned.filter((r) => processKind(r) === 'git').map((r) => gitSubcommand(r.args));
    expect(kinds.filter((k) => k === 'ls-tree')).toHaveLength(1);
  }, 300_000);

  it('AC-7 one file re-read for a commit touching one element', async () => {
    const c = await start('preset');
    await progress(c);
    const before = c.elementReads().length;
    expect(before).toBeGreaterThan(0);
    await setFrontmatterValue(c.fx, 'task-004-themes', 'ref', 'US-X-08');
    await (await c.snapshot()).check();
    const body = await progress(c);
    expect(c.elementReads().slice(before)).toEqual([expect.stringMatching(/task-004-themes\.md$/)]);
    expect(body.figures.completion.referencesCount).toBe(3);
  }, 300_000);
});

describe('K1 — repository text escaped (AC-6, spec-012 §9)', () => {
  it('a bidi and a C1 control in a title and in a reference value come back escaped', async () => {
    const c = await start('preset', {
      prepare: async (fx) => {
        await editElement(fx, 'minor-v0.1', (t) => t.replace(/^title: .*$/m, 'title: "Minor \u202e v0.1\u0085"'));
        await setFrontmatterValue(fx, 'task-004-themes', 'ref', 'US-\u202eX\u0085');
      },
    });
    const body = await progress(c);
    expect(body.scope.current.title).toBe('Minor \\u202e v0.1\\x85');
    expect(body.figures.completion.references.map((r: any) => r.id)).toContain('US-\\u202eX\\x85');
    const config = await c.get(`/api/p/${c.pid}/config`);
    expect(config.body.ui.progress.scope.current.title).toBe('Minor \\u202e v0.1\\x85');
    expect(JSON.stringify(body)).not.toMatch(/[\u202e\u0085]/);
  }, 300_000);
});
