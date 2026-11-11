// task-068 AC-1, AC-3 (spec-012 §2, §9 K1; spec-005 §2–§3, §5) — the `ui` section of
// `GET /api/p/:pid/config` on copies of the fixtures (pinned CLI, real git): the body against
// `config.schema.json` on the kanban, scrum, custom and unknown fixtures, no `ui` when
// `memory.yaml` cannot be read, the failure of an ignored file redacted, every echoed string
// escaped, and the scenarios at the API level, one test titled with each id (C-01.x, C-04.1,
// C-04.2, T-12.1, T-12.4, T-12.5; their screens are task-064's and task-065's, the current element
// of `scope` task-059's).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import { renderPreset } from '../../../server/src/presets/ui-config.js';
import { nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import { REPO_STATE_HEADER } from '../../../server/src/snapshot/state.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import {
  buildFixture,
  copyFixture,
  usePresetUiConfig,
  type Fixture,
  type FixtureKind,
} from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { git } from '../../harness/run.js';
import { auditedSnapshots } from '../snapshot/support.js';

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
function expectConfigSchema(body: unknown): void {
  const validate = ajv.getSchema('https://wingfoil-ui.local/contracts/api/config.schema.json')!;
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true);
}

let root: string;
const templates = {} as Record<FixtureKind | 'sw-life-cycle', Fixture>;
let n = 0;
const registries: Snapshots[] = [];
let app: FastifyInstance | undefined;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-ui-route-')));
  for (const kind of ['kanban', 'scrum', 'custom', 'unknown'] as const) {
    templates[kind] = await buildFixture(kind, { root: path.join(root, kind) });
  }
  templates['sw-life-cycle'] = await copyFixture(templates.custom, path.join(root, 'sw-life-cycle'));
  await usePresetUiConfig(templates['sw-life-cycle'], 'sw-life-cycle');
}, HEAVY_MS);

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await rm(root, { recursive: true, force: true });
});

/** The routes over a copy of `template`, prepared by `prepare`; `config()` reads `/config`. */
async function start(template: Fixture, options: { fs?: ReadFs; prepare?: (fx: Fixture) => Promise<void> } = {}) {
  n += 1;
  const fx = await copyFixture(template, path.join(root, `copy-${n}`));
  await options.prepare?.(fx);
  const audited = auditedSnapshots(fx.env, options.fs ? { fs: options.fs } : {});
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const entry = await store.add({ path: fx.dir, name: fx.name, remote: '' });
  app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security,
    register: (a) => registerProjectRoutes(a, { store, snapshots: audited.snapshots }),
  });
  const config = async () => {
    const res = await app!.inject({ method: 'GET', url: `/api/p/${entry.id}/config`, headers: AUTH });
    expect(res.statusCode).toBe(200);
    expect(res.headers[REPO_STATE_HEADER.toLowerCase()]).toBeDefined();
    const body = res.json();
    expectConfigSchema(body);
    return body;
  };
  /** The project's snapshot, as the routes open it. */
  const snapshot = () => audited.snapshots.open(entry.id, entry.path);
  return { fx, config, snapshot };
}

/** Write `.wingfoil/ui.yaml` and commit it (the scenarios' "committed ui.yaml"). */
async function commitUiYaml(fx: Fixture, text: string): Promise<void> {
  await writeFile(path.join(fx.dir, '.wingfoil', 'ui.yaml'), text);
  await git(fx.dir, ['add', '.wingfoil/ui.yaml'], fx.env);
  await git(fx.dir, ['commit', '-qm', 'test: ui.yaml'], fx.env);
}

/** Every origin of the `ui` section, but `scope.current`'s. */
function origins(ui: any): string[] {
  return [
    ...ui.taxonomy.categories.map((c: any) => c.origin),
    ui.taxonomy.patterns.origin,
    ui.taxonomy.requires.origin,
    ...['mode', 'scope', 'phases', 'iterates', 'defects'].map((k) => ui.progress[k].origin),
    ui.holds.origin,
    ui.artifacts.origin,
  ];
}

describe('GET /api/p/:pid/config — the ui section', () => {
  it.each(['kanban', 'scrum', 'custom', 'unknown', 'sw-life-cycle'] as const)(
    'the %s fixture: the body validates and carries ui',
    async (kind) => {
      const ui = (await (await start(templates[kind])).config()).ui;
      expect(ui).toBeDefined();
      expect(ui.status.source).toBe(kind === 'sw-life-cycle' ? 'file' : 'none');
    },
  );

  it('no ui when memory.yaml cannot be read; types carries the error', async () => {
    const fs: ReadFs = {
      ...nodeReadFs,
      readFile: (f) =>
        f.endsWith(`${path.sep}memory.yaml`) ? Promise.reject(new Error('EACCES')) : nodeReadFs.readFile(f),
    };
    const body = await (await start(templates.kanban, { fs })).config();
    expect(body).not.toHaveProperty('ui');
    expect(body.types.error.code).toBe('read-error');
  });

  it('the failure of an ignored file names no local folder', async () => {
    const c = await start(templates.kanban, {
      prepare: (fx) => commitUiYaml(fx, `version: 1\nprogress: { mode: "${fx.dir}/x" }\n`),
    });
    const ui = (await c.config()).ui;
    expect(ui.status).toEqual({
      source: 'ignored',
      warning: { code: 'ui-config-ignored', failure: 'progress.mode must be sequence or flow (found <project>/x)' },
    });
  });

  it('K1: each echoed string with a bidi and a C1 control comes back escaped', async () => {
    const T = 't\u202e\u0085x';
    const S = 's\u202e\u0085x';
    // JSON is YAML; the controls written as YAML double-quoted escapes.
    const yamlOf = (data: unknown) =>
      JSON.stringify(data, null, 1)
        .replace(/\u202e/g, '\\u202e')
        .replace(/\u0085/g, '\\x85');
    const c = await start(templates.kanban, {
      prepare: async (fx) => {
        const file = path.join(fx.dir, '.wingfoil', 'memory.yaml');
        const memory = parse(await readFile(file, 'utf8')) as any;
        memory.types[T] = {
          path: 'docs/memory/tx/{id}.md',
          states: { sequence: ['draft', S], gates: { [S]: { reject: 'draft' } } },
        };
        await writeFile(file, yamlOf(memory));
        await writeFile(
          path.join(fx.dir, '.wingfoil', 'ui.yaml'),
          yamlOf({
            version: 1,
            taxonomy: {
              categories: { [T]: 'work' },
              patterns: [{ match: '^m\u202e\u0085\\d', category: 'requirement' }],
              requires: { [T]: ['requirement'] },
            },
            progress: { mode: 'sequence', scope: { type: T }, phases: ['ph\u202e\u0085'], iterates: T, defects: T },
            holds: { [T]: { [S]: { approve: 'never' } } },
            artifacts: [{ path: 'p\u202e', phase: 'ph\u202e\u0085' }],
          }),
        );
      },
    });
    const ui = (await c.config()).ui;
    const t = 't\\u202e\\x85x';
    expect(ui.status).toEqual({ source: 'file' });
    expect(ui.taxonomy.categories.find((r: any) => r.category === 'work')).toEqual({
      type: t,
      category: 'work',
      origin: 'declared',
    });
    // Q4-b: the pattern's own backslash (`\\d`) is not doubled.
    expect(ui.taxonomy.patterns.value).toEqual([{ match: '^m\\u202e\\x85\\d', category: 'requirement' }]);
    expect(ui.taxonomy.requires.value).toEqual([{ type: t, categories: ['requirement'] }]);
    expect(ui.progress.scope).toEqual({ value: { type: t }, origin: 'declared', current: null });
    expect(ui.progress.phases.value).toEqual(['ph\\u202e\\x85']);
    expect([ui.progress.iterates.value, ui.progress.defects.value]).toEqual([t, t]);
    expect(ui.holds.value).toEqual([{ type: t, state: 's\\u202e\\x85x', approve: 'never' }]);
    // A C1 control is refused in an artifact path by the file's schema; a bidi control is escaped.
    expect(ui.artifacts.value).toEqual([{ path: 'p\\u202e', phase: 'ph\\u202e\\x85' }]);
    expect(JSON.stringify(ui)).not.toMatch(/[\u202e\u0085]/u);
  });

  it('a C1 control in an artifact path makes the file ignored (its schema)', async () => {
    const c = await start(templates.kanban, {
      prepare: (fx) => commitUiYaml(fx, 'version: 1\nartifacts: [{ path: "dist/\\x85x", phase: release }]\n'),
    });
    const ui = (await c.config()).ui;
    expect(ui.status.source).toBe('ignored');
    expect(ui.artifacts).toEqual({ value: [], origin: 'inferred' });
  });
});

describe('the C and T scenarios at the API level', () => {
  it('C-01.1 — Show inferred values on a project without ui.yaml', async () => {
    const ui = (await (await start(templates.kanban)).config()).ui;
    expect(ui.status).toEqual({ source: 'none' });
    const row = (type: string) => ui.taxonomy.categories.find((r: any) => r.type === type);
    expect(row('task')).toEqual({ type: 'task', category: 'work', origin: 'inferred' });
    expect(row('bug')).toEqual({ type: 'bug', category: 'defect', origin: 'inferred' });
    expect(origins(ui).every((o) => o === 'inferred')).toBe(true);
    const schema = ajv.getSchema('https://wingfoil-ui.local/contracts/api/ui-config.schema.json')!.schema as any;
    expect(schema.definitions.category.enum).toEqual([
      'work',
      'defect',
      'decision',
      'spec',
      'requirement',
      'feature',
      'release',
      'external',
    ]);
  });

  it('C-01.2 — Show declared values from ui.yaml', async () => {
    const ui = (await (await start(templates['sw-life-cycle'])).config()).ui;
    expect(ui.status).toEqual({ source: 'file' });
    expect(ui.progress.scope).toEqual({ value: { type: 'release' }, origin: 'declared', current: null });
    expect(ui.progress.mode).toEqual({ value: 'sequence', origin: 'declared' });
  });

  it('C-01.3 — Mark a type with no inferable category', async () => {
    const ui = (await (await start(templates.unknown)).config()).ui;
    expect(ui.taxonomy.categories.find((r: any) => r.type === 'story')).toEqual({
      type: 'story',
      category: null,
      origin: 'inferred',
    });
  });

  it('C-04.1 — Fall back to inferred values when ui.yaml is invalid', async () => {
    const c = await start(templates.kanban, {
      prepare: (fx) => commitUiYaml(fx, 'version: 1\nprogress:\n  mode: spiral\n'),
    });
    const ui = (await c.config()).ui;
    expect(ui.status).toEqual({
      source: 'ignored',
      warning: { code: 'ui-config-ignored', failure: 'progress.mode must be sequence or flow (found spiral)' },
    });
    expect(origins(ui).every((o) => o === 'inferred')).toBe(true);
    expect(ui.progress.scope.value).toBeNull();
  });

  it('C-04.2 — Treat unparsable ui.yaml the same way', async () => {
    const c = await start(templates.kanban, {
      prepare: (fx) => commitUiYaml(fx, 'version: 1\ntaxonomy: [unclosed\n'),
    });
    const ui = (await c.config()).ui;
    expect(ui.status.source).toBe('ignored');
    expect(ui.status.warning.failure).toMatch(/at line \d+, column \d+$/);
    expect(origins(ui).every((o) => o === 'inferred')).toBe(true);
  });

  it('the sw-life-cycle variant on the custom fixture: the categories, patterns, requires and holds of spec-005 §5', async () => {
    const ui = (await (await start(templates['sw-life-cycle'])).config()).ui;
    const category = (type: string) => ui.taxonomy.categories.find((r: any) => r.type === type)?.category;
    expect([category('task'), category('bug'), category('release'), category('plan')]).toEqual([
      'work',
      'defect',
      'release',
      null,
    ]);
    expect(ui.taxonomy.patterns.origin).toBe('declared');
    expect(ui.taxonomy.patterns.value.length).toBe(3);
    expect(ui.taxonomy.requires.value.map((r: any) => r.type).sort()).toEqual(['adr', 'task', 'tech-spec']);
    expect(ui.holds.value).toEqual([
      { type: 'release', state: 'releasing', approve: 'never' },
      { type: 'release-line', state: 'active', approve: 'when-references-done' },
    ]);
  });

  // The progress card's scope (T-12.x) at the API level: the scope type the sw-life-cycle preset
  // declares, whatever state its releases are in. The current element of each scenario (minor-v0.1,
  // minor-v0.2, none) is derived by task-059, which builds those Givens; `/config` sends `null`
  // until then, so this task sets up no release state.
  const declaredScope = { value: { type: 'release' }, origin: 'declared', current: null };
  const scope = async () => (await (await start(templates['sw-life-cycle'])).config()).ui.progress.scope;

  it('T-12.1 — Show the figures of the current scope', async () => {
    expect(await scope()).toEqual(declaredScope);
  });

  it('T-12.4 — Move the scope to the most advanced release', async () => {
    expect(await scope()).toEqual(declaredScope);
  });

  it('T-12.5 — Say that no release is under way', async () => {
    expect(await scope()).toEqual(declaredScope);
  });
});

describe('GET /api/p/:pid/config — tied to its state check (bug-034, task-075 AC-1)', () => {
  it('AC-1 bug-034 `/config` after an edit and a revert between two checks serves the reverted `ui`', async () => {
    const { fx, config, snapshot } = await start(templates.kanban);
    const project = await snapshot();
    await project.view(); // the state check, before ui.yaml exists; no read of it yet
    const file = path.join(fx.dir, '.wingfoil', 'ui.yaml');
    await writeFile(file, renderPreset('kanban'));
    expect((await config()).ui.status.source).toBe('file');
    await rm(file);
    const before = project.current()!.key;
    expect((await project.check()).key).toBe(before);
    expect((await config()).ui.status).toEqual({ source: 'none' });
  });
});
