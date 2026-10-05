// adr-001 D3, REQ-INT-02, REQ-INT-03 — the version of a project's own `wingfoil`, detected once
// per resolution, against the supported range, with the capabilities it gives (API side of
// S-08.1, S-08.2, S-09.1, S-09.2; the header texts close in task-016).
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WingfoilCli } from '../../../server/src/cli/adapter.js';
import { evaluateCapabilities } from '../../../server/src/cli/capabilities.js';
import { discoverCli } from '../../../server/src/cli/discovery.js';
import { detectVersion, supportedRange, VersionCache } from '../../../server/src/cli/version.js';
import { LocalProcessRunner, type SpawnRecord } from '../../../server/src/process/runner.js';
import { PINNED_PACKAGE_DIR } from '../../harness/cli.js';
import {
  buildFixture,
  copyFixture,
  envWithoutWingfoil,
  installCliStub,
  removeCli,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { FakeProcessRunner } from '../process/fake-runner.js';
import { installGlobally, withPathFirst } from './fake-cli.js';

let root: string;
let template: Fixture;
let n = 0;
const runners: LocalProcessRunner[] = [];

async function freshKanban(): Promise<Fixture> {
  n += 1;
  return copyFixture(template, path.join(root, `copy-${n}`));
}

async function cliOf(fx: Fixture, env: NodeJS.ProcessEnv = fx.env, spawned?: SpawnRecord[]): Promise<WingfoilCli> {
  const runner = new LocalProcessRunner(spawned ? { onSpawn: (r) => spawned.push(r) } : {});
  runners.push(runner);
  return new WingfoilCli({ cli: await discoverCli(fx.dir, { env }), runner, env });
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-ver-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
}, 600_000);

afterAll(async () => {
  for (const r of runners) await r.terminateAll();
  await rm(root, { recursive: true, force: true });
});

const RELEASE_CAPABILITIES = ['type-definitions', 'element-content', 'directive-body', 'gate-decision'];

describe('detectVersion on the kanban fixture', () => {
  it('S-08.1 — the pinned 0.2.2: in range, from the project, nothing of this release missing', async () => {
    const fx = await freshKanban();
    const detected = await detectVersion(await cliOf(fx));
    expect(detected).toEqual({ text: '0.2.2', version: '0.2.2', state: 'in-range', inRange: true, source: 'project' });
    const result = evaluateCapabilities(detected, supportedRange());
    expect(result.missing).toEqual([]);
    const enabled = result.capabilities.filter((c) => c.state === 'enabled').map((c) => c.id);
    expect(enabled).toEqual(RELEASE_CAPABILITIES);
  }, 120_000);

  it('S-08.2 — no CLI in node_modules, 0.2.2 on the PATH: in range, source "path"', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const bin = await installGlobally(path.join(root, `global-${n}`), PINNED_PACKAGE_DIR);
    const env = withPathFirst(await envWithoutWingfoil(fx.env, path.join(root, `safe-bin-${n}`)), bin);
    expect(await detectVersion(await cliOf(fx, env))).toMatchObject({
      version: '0.2.2',
      state: 'in-range',
      source: 'path',
    });
  }, 120_000);

  it.each([
    ['S-09.1', '0.4.0', 'above'],
    ['S-09.2', '0.2.0', 'below'],
  ] as const)(
    '%s — a fixture pinning %s opens read-only: 0 enabled capabilities, the reason names the range',
    async (_id, version, state) => {
      const fx = await freshKanban();
      await installCliStub(fx, { version });
      const detected = await detectVersion(await cliOf(fx));
      expect(detected).toEqual({ text: version, version, state, inRange: false, source: 'project' });
      const result = evaluateCapabilities(detected, supportedRange());
      expect(result.capabilities.filter((c) => c.state === 'enabled')).toHaveLength(0);
      for (const c of result.capabilities) {
        expect(c.reason).toEqual({ code: 'unsupported-version', range: { min: '0.2.2', max: '0.2.x' } });
      }
    },
    120_000,
  );

  it('runs --version once per resolution; a new resolution runs it again', async () => {
    const fx = await freshKanban();
    const spawned: SpawnRecord[] = [];
    const cache = new VersionCache();
    const first = await cliOf(fx, fx.env, spawned);
    const [a, b] = await Promise.all([cache.detect(first), cache.detect(first)]);
    expect(await cache.detect(first)).toBe(a);
    expect(b).toBe(a);
    expect(spawned.filter((s) => s.args.includes('--version'))).toHaveLength(1);
    await installCliStub(fx, { version: '0.4.0' });
    const again = await cliOf(fx, fx.env, spawned);
    expect((await cache.detect(again)).state).toBe('above');
    expect(spawned.filter((s) => s.args.includes('--version'))).toHaveLength(2);
    // The first resolution keeps its cached answer.
    expect((await cache.detect(first)).version).toBe('0.2.2');
  }, 120_000);
});

describe('detectVersion (fake runner)', () => {
  const resolved = { source: 'project' as const, projectRoot: '/p', file: process.execPath, prefixArgs: ['/p/cli.js'] };

  it.each([
    ['banana\n', 'banana'],
    ['v0.2.2\n', 'v0.2.2'],
  ])(
    'a --version answer %j that is not a semantic version is "unrecognised", outside the range',
    async (stdout, text) => {
      const cli = new WingfoilCli({ cli: resolved, runner: new FakeProcessRunner().answer({ stdout }) });
      expect(await detectVersion(cli)).toEqual({
        text,
        version: null,
        state: 'unrecognised',
        inRange: false,
        source: 'project',
      });
    },
  );

  it.each([[''], ['0.2.2\n0.2.3\n']])(
    'an empty or multi-line --version answer %j is "unrecognised"',
    async (stdout) => {
      const errors: string[] = [];
      const cli = new WingfoilCli({
        cli: resolved,
        runner: new FakeProcessRunner().answer({ stdout }),
        logger: { error: (_o, m) => errors.push(m) },
      });
      expect(await detectVersion(cli)).toEqual({
        text: null,
        version: null,
        state: 'unrecognised',
        inRange: false,
        source: 'project',
      });
      // The adapter logs the output error (no value); detection turns it into "unrecognised".
      expect(errors).toEqual(['Unexpected output of --version']);
    },
  );

  it('the cache is keyed by the ResolvedCli: two adapters of one resolution share one --version', async () => {
    const runner = new FakeProcessRunner().answer({ stdout: '0.2.2\n' });
    const cache = new VersionCache();
    const a = await cache.detect(new WingfoilCli({ cli: resolved, runner }));
    const b = await cache.detect(new WingfoilCli({ cli: resolved, runner }));
    expect(b).toBe(a);
    expect(runner.requests).toHaveLength(1);
    // An equal but new resolution object (a re-run of discoverCli) is detected again.
    await cache.detect(new WingfoilCli({ cli: { ...resolved }, runner }));
    expect(runner.requests).toHaveLength(2);
  });

  it('a --version that fails to run propagates, and the cache does not keep the failure', async () => {
    const runner = new FakeProcessRunner()
      .answer({ exitCode: 1, stderr: '{"error":"boom"}' })
      .answer({ stdout: '0.2.2\n' });
    const cli = new WingfoilCli({ cli: resolved, runner });
    const cache = new VersionCache();
    await expect(cache.detect(cli)).rejects.toThrow(/boom/);
    expect((await cache.detect(cli)).state).toBe('in-range');
    expect(runner.requests).toHaveLength(2);
  });
});
