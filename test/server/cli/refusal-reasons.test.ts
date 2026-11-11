// task-070 AC-2 (the RP3-7 scope item; spec-001 §2, spec-004 §5; D70-5, D70-6) — a WingFoil 0.3.x
// refusal's `details[].detail` texts reach the 422 `cli-refused` body as `detail.reasons[]`, through
// the adapter's sanitiser like the message (the project, repository, package and home folders, URL
// userinfo, the character escape, 4 000 characters each), at most 200 then one count line; any other
// shape of `details` gives no reason; `details[].file` is not passed on; a refusal without `details`
// (WingFoil 0.2.2) is unchanged byte for byte. Fake runner, then the real CLIs through a governed
// write (a submit from the `pending` gate state, W-20).
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies, each validated against its schema */
import { Ajv } from 'ajv';
import type { FastifyInstance } from 'fastify';
import { readdir, readFile, realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../../server/src/auth/authentication.js';
import { CliRefusedError, cliErrorEnvelope, WingfoilCli } from '../../../server/src/cli/adapter.js';
import { MAX_MESSAGE } from '../../../server/src/git/redact.js';
import { buildApp } from '../../../server/src/http/app.js';
import { registerElementWriteRoutes } from '../../../server/src/http/element-writes.js';
import { registerProjectRoutes } from '../../../server/src/http/project-routes.js';
import { createLogger } from '../../../server/src/logging.js';
import { InProcessWriteLock } from '../../../server/src/process/write-lock.js';
import type { Snapshots } from '../../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../../server/src/state/memory-store.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { buildFixture, copyFixture, memberByName, type Fixture } from '../../harness/fixtures/index.js';
import { HEAVY_MS } from '../../harness/load.js';
import { git } from '../../harness/run.js';
import { TempWorkspace } from '../../harness/temp-workspace.js';
import { cliBuildFor } from '../../contracts/support.js';
import { FakeProcessRunner } from '../process/fake-runner.js';
import { auditedSnapshots } from '../snapshot/support.js';

const ROOT = '/p';
const PACKAGE = '/x/wingfoil';
const CLI = {
  source: 'path' as const,
  projectRoot: ROOT,
  file: process.execPath,
  prefixArgs: ['/x/cli.js'],
  packageDir: PACKAGE,
};
const ESC = String.fromCharCode(0x1b);
const RLO = String.fromCharCode(0x202e);
const GATE = 'illegal `submit` from "pending": a `gates` state — its forward edge requires `approve`, not `submit`';

async function refusal(stderr: string): Promise<CliRefusedError> {
  const cli = new WingfoilCli({ cli: CLI, runner: new FakeProcessRunner().answer({ exitCode: 1, stderr }) });
  const error = await cli.run('memory submit', { positionals: ['bug-001'] }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(CliRefusedError);
  return error as CliRefusedError;
}

const refused = (details: unknown, error = "illegal transition pending -> (none) for type 'bug'") =>
  JSON.stringify({ error, details });

describe('the reasons of a refusal (fake runner)', () => {
  it('each string detail, in order, sanitised like the message; the files are not passed on', async () => {
    const hostile = `see ${ROOT}/docs/x.md, ${PACKAGE}/dist/cli.js, ${homedir()}/x and https://user:secret@example.com/r ${RLO}txt${ESC}[31m`;
    const error = await refusal(
      refused([
        { file: 'docs/memory/bug/bug-001.md', detail: GATE },
        { file: `${ROOT}/docs/memory/bug/bug-002.md`, detail: hostile },
      ]),
    );
    expect(error.reasons).toEqual([
      GATE,
      'see <project>/docs/x.md, <wingfoil>/dist/cli.js, ~/x and https://example.com/r \\u202etxt\\x1b[31m',
    ]);
    const { status, body } = cliErrorEnvelope(error);
    expect(status).toBe(422);
    expect(body).toEqual({
      error: {
        code: 'cli-refused',
        message: "illegal transition pending -> (none) for type 'bug'",
        detail: { reasons: error.reasons },
      },
    });
    expect(JSON.stringify(body)).not.toContain('bug-001.md');
    expect(JSON.stringify(body)).not.toContain(ROOT);
  });

  it('read from the last line after JSON warning lines, as the message', async () => {
    const stderr = `${JSON.stringify({ warning: 'W_X something' })}\n${refused([{ file: 'f', detail: GATE }])}`;
    expect((await refusal(stderr)).reasons).toEqual([GATE]);
  });

  it('each reason capped at 4 000 characters; at most 200, then one count line', async () => {
    const many = Array.from({ length: 203 }, (_, i) => ({ file: 'f', detail: `reason ${i}` }));
    const error = await refusal(refused([{ file: 'f', detail: 'L'.repeat(10_000) }, ...many]));
    expect(error.reasons).toHaveLength(201);
    expect(error.reasons[0]!.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(error.reasons[199]).toBe('reason 198');
    expect(error.reasons[200]).toBe('4 more reasons omitted');
  });

  it.each([
    ['no details', JSON.stringify({ error: 'missing required field on submit: title' })],
    ['details not an array', refused({ detail: GATE })],
    ['items without a text detail', refused([{ file: 'f' }, { detail: 3 }, 'text', null])],
    ['an empty array', refused([])],
    ['a plain-text refusal', 'plain refusal'],
  ])('%s → no reason, no detail in the body, the message unchanged', async (_l, stderr) => {
    const error = await refusal(stderr);
    expect(error.reasons).toEqual([]);
    const { body } = cliErrorEnvelope(error);
    expect(body.error).not.toHaveProperty('detail');
    expect(Object.keys(body.error)).toEqual(['code', 'message']);
  });

  it('a details item mixing a text detail and other keys gives its detail only', async () => {
    expect((await refusal(refused([{ file: 'f', detail: GATE, extra: { x: 1 } }, { detail: 5 }]))).reasons).toEqual([
      GATE,
    ]);
  });
});

// The real CLIs, through `POST …/submit` of the kanban fixture's `task-001-login-form` (`pending`).
const security = { authentication: createTokenAuthentication('test-token'), port: () => 80 };
const AUTH = { authorization: 'Bearer test-token' };
const LOGIN = 'task-001-login-form';

const ajv = new Ajv({ allErrors: true });
for (const file of await readdir(path.join(REPO_ROOT, 'contracts', 'api'))) {
  ajv.addSchema(JSON.parse(await readFile(path.join(REPO_ROOT, 'contracts', 'api', file), 'utf8')) as object);
}
function expectSchema(file: string, body: unknown): void {
  const validate = ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`)!;
  expect(validate(body), `${file}: ${JSON.stringify(validate.errors)}`).toBe(true);
}

let ws: TempWorkspace;
const templates = new Map<string, Fixture>();
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];
let n = 0;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-070-reasons-');
  const root = await realpath(ws.dir);
  templates.set('0.3.1', await buildFixture('kanban', { root: path.join(root, 'kanban-0.3.1') }));
  templates.set(
    '0.2.2',
    await buildFixture('kanban', {
      root: path.join(root, 'kanban-0.2.2'),
      cli: await cliBuildFor('0.2.2'),
      cliVersion: '0.2.2',
    }),
  );
}, HEAVY_MS);

afterEach(async () => {
  for (const a of apps.splice(0)) await a.close();
});

afterAll(async () => {
  for (const s of registries) await s.closeAll();
  await ws?.dispose();
});

async function submitFromGate(version: string): Promise<{ status: number; body: any; dir: string }> {
  n += 1;
  const fx = await copyFixture(templates.get(version)!, path.join(await realpath(ws.dir), `copy-${n}`));
  await git(fx.dir, ['config', 'user.email', memberByName('Jordan').email], fx.env);
  const audited = auditedSnapshots(fx.env);
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const pid = (await store.add({ path: fx.dir, name: fx.name, remote: '' })).id;
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(new Writable({ write: (_c, _e, cb) => cb() })),
    security,
    register: (a) => {
      registerProjectRoutes(a, { store, snapshots: audited.snapshots });
      registerElementWriteRoutes(a, {
        store,
        snapshots: audited.snapshots,
        writeLock: new InProcessWriteLock(),
        bus: audited.bus,
      });
    },
  });
  apps.push(app);
  const res = await app.inject({
    method: 'POST',
    url: `/api/p/${pid}/elements/${LOGIN}/submit`,
    headers: { ...AUTH, 'content-type': 'application/json' },
    payload: JSON.stringify({ expectedStatus: 'pending' }),
  });
  return { status: res.statusCode, body: res.json(), dir: fx.dir };
}

describe('the 422 cli-refused body of the real CLIs (a submit from a gate state)', () => {
  it(
    'WingFoil 0.3.1: detail.reasons holds the gate sentence; the body passes write.refusal and cli.refusal',
    async () => {
      const { status, body, dir } = await submitFromGate('0.3.1');
      expect(status, JSON.stringify(body)).toBe(422);
      expect(body.error.code).toBe('cli-refused');
      expect(body.error.message).toBe("illegal transition pending -> (none) for type 'task'");
      expect(body.error.detail).toEqual({ reasons: [GATE] });
      expect(JSON.stringify(body)).not.toContain(dir);
      expectSchema('write.refusal.schema.json', body);
      expectSchema('cli.refusal.schema.json', body);
    },
    HEAVY_MS,
  );

  it(
    'WingFoil 0.2.2: no details, so the body is the message alone, as before',
    async () => {
      const { status, body } = await submitFromGate('0.2.2');
      expect(status, JSON.stringify(body)).toBe(422);
      expect(body).toEqual({
        error: { code: 'cli-refused', message: "illegal transition pending -> (none) for type 'task'" },
      });
      expectSchema('write.refusal.schema.json', body);
      expectSchema('cli.refusal.schema.json', body);
    },
    HEAVY_MS,
  );
});
