// task-069 AC-2 (D69-9; spec-003 §9) — the contract check on held gates: a copy of the custom fixture
// on the pinned CLI with the sw-life-cycle preset and the Given steps of S-24.5 and S-24.6, its
// descriptors read as the server serves them (`GET /elements`, so the holds, the reference index
// and the count are the route's own). For every element and every `submit`/`approve`/`reject`, run
// on a fresh copy as Morgan, the CLI accepts the verb exactly when the descriptor offers it — except
// the `approve` of a held gate, which the CLI accepts (the hold is the console's, not WingFoil's;
// spec-005 §4a, design probe P4) and the descriptor withholds: listed, never hidden.
/* eslint-disable @typescript-eslint/no-explicit-any -- JSON bodies */
import type { FastifyInstance } from 'fastify';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { Writable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTokenAuthentication } from '../../server/src/auth/authentication.js';
import { CliRefusedError, WingfoilCli } from '../../server/src/cli/adapter.js';
import { discoverCli } from '../../server/src/cli/discovery.js';
import { buildApp } from '../../server/src/http/app.js';
import { registerProjectRoutes } from '../../server/src/http/project-routes.js';
import { createLogger } from '../../server/src/logging.js';
import { LocalProcessRunner } from '../../server/src/process/runner.js';
import type { Snapshots } from '../../server/src/snapshot/snapshots.js';
import { createMemoryStateStore } from '../../server/src/state/memory-store.js';
import {
  addReleaseLine,
  buildFixture,
  copyFixture,
  HELD_RELEASE,
  RELEASE_LINE,
  submitToReleasing,
  usePresetUiConfig,
  type Fixture,
} from '../harness/fixtures/index.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { auditedSnapshots } from '../server/snapshot/support.js';
import { actAs } from './support.js';

const OPS = ['submit', 'approve', 'reject'] as const;
const sink = new Writable({ write: (_c, _e, cb) => cb() });

let ws: TempWorkspace;
let root: string;
let fixture: Fixture;
let descriptors: any[];
const registries: Snapshots[] = [];
const apps: FastifyInstance[] = [];
const runners: LocalProcessRunner[] = [];

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-held-contract-');
  root = await realpath(ws.dir);
  fixture = await buildFixture('custom', { root: path.join(root, 'custom') });
  await usePresetUiConfig(fixture);
  await submitToReleasing(fixture);
  await addReleaseLine(fixture);
  await actAs(fixture, 'Morgan');
  const audited = auditedSnapshots(fixture.env);
  registries.push(audited.snapshots);
  const store = await createMemoryStateStore();
  const entry = await store.add({ path: fixture.dir, name: fixture.name, remote: '' });
  const app = await buildApp({
    staticDir: '/nonexistent',
    logger: createLogger(sink),
    security: { authentication: createTokenAuthentication('t'), port: () => 80 },
    register: (a) => registerProjectRoutes(a, { store, snapshots: audited.snapshots }),
  });
  apps.push(app);
  const res = await app.inject({
    method: 'GET',
    url: `/api/p/${entry.id}/elements`,
    headers: { authorization: 'Bearer t' },
  });
  expect(res.statusCode, res.body).toBe(200);
  descriptors = (res.json() as any).elements.map((e: any) => e.descriptor);
}, 600_000);

afterAll(async () => {
  for (const a of apps) await a.close();
  for (const s of registries) await s.closeAll();
  for (const r of runners) await r.terminateAll();
  await ws?.dispose();
});

describe('spec-003 §9 — held gates against the CLI', () => {
  it('the CLI accepts a verb exactly when it is offered, except the approve of a held gate', async () => {
    let n = 0;
    const fresh = async () => {
      const fx = await copyFixture(fixture, path.join(root, `verbs-${n++}`));
      await actAs(fx, 'Morgan');
      const runner = new LocalProcessRunner();
      runners.push(runner);
      return new WingfoilCli({ cli: await discoverCli(fx.dir, { env: fx.env }), runner, env: fx.env });
    };
    let cli = await fresh();
    const mismatches: string[] = [];
    const heldApproves: string[] = [];
    const contentRefusals: string[] = [];
    for (const d of descriptors) {
      for (const op of OPS) {
        const offered = d.verbs.find((v: any) => v.verb === op);
        let accepted: string | undefined;
        let refusal = '';
        try {
          const out = await cli.run(`memory ${op}`, {
            positionals: [d.id],
            ...(op === 'submit' ? {} : { options: { '--reason': 'Held gates contract test' } }),
          });
          accepted = out.data.to;
        } catch (error) {
          if (!(error instanceof CliRefusedError)) throw error;
          refusal = error.message;
        }
        if (op === 'approve' && d.approveHeld && !offered && accepted !== undefined) {
          heldApproves.push(`${d.id} → ${accepted}`);
        } else if (offered && accepted === undefined && /sard_ref/.test(refusal)) {
          // W-01: custom `adr-001-local-server`'s empty required field, as the main contract check.
          contentRefusals.push(`${d.id} ${op}`);
        } else if (accepted !== offered?.to) {
          mismatches.push(`${d.id} ${op}: CLI ${accepted ?? 'refused'}, offered ${offered?.to ?? 'no'}`);
        }
        if (accepted !== undefined) cli = await fresh();
      }
    }
    expect(mismatches).toEqual([]);
    expect(heldApproves.sort()).toEqual([`${HELD_RELEASE} → released`, `${RELEASE_LINE} → done`]);
    expect(contentRefusals).toEqual(['adr-001-local-server submit']);
  }, 600_000);
});
