// spec-001 §1–2, adr-001 D2/D5, REQ-ARC-02, REQ-INT-04 — invoking the project's CLI on the real
// fixtures: the process audit (TT-ARC-02), the result classification and the 30 s timeout
// (TT-INT-04), S-27.1 on the adapter side.
import { existsSync } from 'node:fs';
import { appendFile, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  CLI_TIMEOUT_MS,
  CliInternalError,
  CliOutputError,
  CliProcessError,
  CliRefusedError,
  CliTimeoutError,
  cliErrorEnvelope,
  optionArg,
  WingfoilCli,
} from '../../../server/src/cli/adapter.js';
import { CliNotFoundError, discoverCli } from '../../../server/src/cli/discovery.js';
import { LocalProcessRunner, type SpawnRecord } from '../../../server/src/process/runner.js';
import { binScript, PINNED_PACKAGE_DIR, pinnedVersion } from '../../harness/cli.js';
import {
  buildFixture,
  cliPackageDir,
  copyFixture,
  envWithoutWingfoil,
  installCliStub,
  memberByName,
  removeCli,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';
import { installGlobally, markingCliSource, sleepingCliSource, withPathFirst, writeCliPackage } from './fake-cli.js';

let root: string;
let template: Fixture;
let n = 0;
const runners: LocalProcessRunner[] = [];

async function freshKanban(): Promise<Fixture> {
  n += 1;
  return copyFixture(template, path.join(root, `copy-${n}`));
}

/** The adapter for `fx` as the server builds it, with every started process recorded. */
async function adapterFor(fx: Fixture, env: NodeJS.ProcessEnv = fx.env) {
  const spawned: SpawnRecord[] = [];
  const runner = new LocalProcessRunner({ onSpawn: (r) => spawned.push(r) });
  runners.push(runner);
  const logger = { error: vi.fn(), warn: vi.fn() };
  const cli = new WingfoilCli({ cli: await discoverCli(fx.dir, { env }), runner, env, logger });
  return { cli, spawned, logger };
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-adapter-')));
  template = await buildFixture('kanban', { root: path.join(root, 'template') });
});

afterAll(async () => {
  for (const r of runners) await r.terminateAll();
  await rm(root, { recursive: true, force: true });
});

describe('TT-ARC-02 — process audit', () => {
  it('with 0.2.2 pinned and wingfoil 0.2.1 first on the PATH, every CLI process runs the pinned binary', async () => {
    const fx = await freshKanban();
    const marker = path.join(root, `marker-${n}`);
    const pkg = path.join(root, `fake-${n}`, 'pkg');
    await writeCliPackage(pkg, '0.2.1', markingCliSource('0.2.1', marker));
    const env = withPathFirst(fx.env, await installGlobally(path.join(root, `fake-${n}`, 'prefix'), pkg));
    const { cli, spawned } = await adapterFor(fx, env);

    expect(await cli.version()).toBe('0.2.2');
    await cli.json(['dna', 'show']);
    await cli.json(['paths']);
    await cli.json(['directives', 'list']);
    await cli.json(['workflow', 'list']);
    await cli.json(['memory', 'search']);
    await cli.json(['memory', 'search'], { options: { '--status': 'deprecated' } });
    await cli.json(['memory', 'history'], { positionals: ['task-001-login-form'] });

    const pinned = binScript(cliPackageDir(fx));
    expect(spawned).toHaveLength(8);
    for (const p of spawned) {
      expect(p.file).toBe(process.execPath);
      expect(p.args[0]).toBe(pinned);
      expect(p.cwd).toBe(fx.dir);
    }
    expect(existsSync(marker)).toBe(false);

    // Positive control: without the pinned CLI the same PATH runs the fake, and the marker shows it.
    await removeCli(fx);
    const fallback = new WingfoilCli({ cli: await discoverCli(fx.dir, { env }), runner: runners[0]!, env });
    expect(fallback.source).toBe('path');
    expect(await fallback.version()).toBe('0.2.1');
    expect(existsSync(marker)).toBe(true);
  }, 90_000); // ten CLI processes: ~8 s idle, ~26 s measured under a load average of 60

  it('places --format json before the command, and runs --version alone', async () => {
    const fx = await freshKanban();
    const { cli, spawned } = await adapterFor(fx);
    await cli.version();
    await cli.json(['memory', 'search']);
    expect(spawned.map((p) => p.args.slice(1))).toEqual([['--version'], ['--format', 'json', 'memory', 'search']]);
  });

  it('the package wingfoil-ui and its workspaces declare no dependency on wingfoil', async () => {
    const repo = path.resolve(import.meta.dirname, '../../..');
    const occurrences: string[] = [];
    for (const file of ['package.json', 'server/package.json', 'contracts/package.json', 'web/package.json']) {
      const pkg = JSON.parse(await readFile(path.join(repo, file), 'utf8')) as Record<string, unknown>;
      if (file === 'package.json') expect(pkg.name).toBe('wingfoil-ui');
      for (const field of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
        if ('wingfoil' in ((pkg[field] as Record<string, string> | undefined) ?? {}))
          occurrences.push(`${file} ${field}`);
      }
      for (const field of ['bundleDependencies', 'bundledDependencies']) {
        if (((pkg[field] ?? []) as string[]).includes('wingfoil')) occurrences.push(`${file} ${field}`);
      }
    }
    // The only one allowed: this repository's own governance CLI (directive `wingfoil-cli`), a
    // devDependency of the root, never installed by `npx wingfoil-ui`.
    expect(occurrences).toEqual(['package.json devDependencies']);
  });
});

describe('S-08 / S-10 — the CLI that runs (adapter side)', () => {
  it('S-08.1 — reads the pinned version as plain text', async () => {
    const fx = await freshKanban();
    const { cli } = await adapterFor(fx);
    expect(cli.source).toBe('project');
    expect(await cli.version()).toBe(pinnedVersion());
  });

  it('S-08.2 — runs the PATH CLI, through its package bin script, when the project pins none', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const base = await envWithoutWingfoil(fx.env, path.join(root, `safe-${n}`));
    const bin = await installGlobally(path.join(root, `global-${n}`), PINNED_PACKAGE_DIR);
    const { cli, spawned } = await adapterFor(fx, withPathFirst(base, bin));
    expect(cli.source).toBe('path');
    expect(await cli.version()).toBe(pinnedVersion());
    expect(spawned[0]?.file).toBe(process.execPath);
  });

  it('S-10.1 — maps a missing CLI to 422 cli-not-found with the install command', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const env = await envWithoutWingfoil(fx.env, path.join(root, `safe-${n}`));
    const error = await discoverCli(fx.dir, { env }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliNotFoundError);
    expect(cliErrorEnvelope(error as CliNotFoundError)).toEqual({
      status: 422,
      body: {
        error: {
          code: 'cli-not-found',
          message: 'WingFoil CLI not found for this project',
          detail: { path: fx.dir, command: 'npm install --save-dev wingfoil' },
        },
      },
    });
  });
});

describe('TT-INT-04 — result classification (spec-001 §2)', () => {
  it('exit 0: returns the parsed JSON and the stderr lines as warnings', async () => {
    const fx = await freshKanban();
    const directive = path.join(fx.dir, '.wingfoil', 'directives', 'built-in', 'testing.md');
    const text = await readFile(directive, 'utf8');
    await writeFile(directive, text.replace(/^title:/m, 'scope: whatever\ntitle:'));
    const { cli } = await adapterFor(fx);
    const out = await cli.json(['directives', 'list']);
    expect((out.data as { entries: unknown[] }).entries.length).toBeGreaterThan(0);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/unknown field\(s\) ignored: scope$/);
  });

  it('exit 1: a refusal with the CLI message verbatim (real CLI), mapped to 422 cli-refused', async () => {
    const fx = await freshKanban();
    const { cli } = await adapterFor(fx);
    const error = await cli.json(['memory', 'submit'], { positionals: ['task-999-nope'] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliRefusedError);
    expect((error as CliRefusedError).cliMessage).toBe('document not found: task-999-nope');
    expect(cliErrorEnvelope(error as CliRefusedError)).toEqual({
      status: 422,
      body: { error: { code: 'cli-refused', message: 'document not found: task-999-nope' } },
    });
  });

  it('exit 1 from the CLI stub: the stderr JSON message, or the stderr text when it is not JSON', async () => {
    const fx = await freshKanban();
    await installCliStub(fx, {
      failures: [
        { command: ['memory', 'approve'], exitCode: 1, stderr: '{"error":"simulated refusal"}' },
        { command: ['memory', 'reject'], exitCode: 1, stderr: 'plain refusal' },
      ],
    });
    const { cli } = await adapterFor(fx);
    await expect(
      cli.json(['memory', 'approve'], { options: { '--reason': 'ok' }, positionals: ['task-001-login-form'] }),
    ).rejects.toMatchObject({
      cliMessage: 'simulated refusal',
    });
    await expect(
      cli.json(['memory', 'reject'], { options: { '--reason': 'no' }, positionals: ['task-001-login-form'] }),
    ).rejects.toMatchObject({
      cliMessage: 'plain refusal',
    });
  });

  it('exit 2: an internal error, logged with the command line, mapped to 500 internal', async () => {
    const fx = await freshKanban();
    const { cli, logger } = await adapterFor(fx);
    const error = await cli.json(['dna', 'show'], { options: { '--bogus': 'x' } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliInternalError);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0]?.[0]).toMatchObject({
      words: ['dna', 'show'],
      options: ['--bogus'],
      exitCode: 2,
      stderr: "error: unknown option '--bogus'",
    });
    expect(cliErrorEnvelope(error as CliInternalError)).toEqual({
      status: 500,
      body: { error: { code: 'internal', message: 'Internal error' } },
    });
  });

  it('another exit status: a process error with the reason', async () => {
    const fx = await freshKanban();
    await installCliStub(fx, { failures: [{ command: ['paths'], exitCode: 3, stderr: 'boom' }] });
    const { cli } = await adapterFor(fx);
    const error = await cli.json(['paths']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliProcessError);
    expect((error as CliProcessError).reason).toBe('WingFoil exited with status 3');
    expect(cliErrorEnvelope(error as CliProcessError).status).toBe(500);
  });

  it('S-27.1 — an invalid dna.yaml refuses dna show with the CLI message; memory search still answers', async () => {
    const fx = await freshKanban();
    await appendFile(path.join(fx.dir, '.wingfoil', 'dna.yaml'), 'project: [unclosed\n  : :\n');
    const { cli } = await adapterFor(fx);
    const error = await cli.json(['dna', 'show']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliRefusedError);
    expect((error as CliRefusedError).cliMessage).toMatch(
      /^E_YAML_PARSE_ERROR \(.*dna\.yaml\): invalid DNA: YAML parse error/,
    );
    const search = await cli.json(['memory', 'search']);
    expect((search.data as { matches: unknown[] }).matches.length).toBeGreaterThan(0);
  });
});

describe('spec-001 §1 — user values', () => {
  it('passes a value that starts with "-" as --name=value, so the CLI reads it as the value', async () => {
    const fx = await freshKanban();
    const morgan = memberByName('Morgan');
    await git(fx.dir, ['config', 'user.email', morgan.email], fx.env);
    await git(fx.dir, ['config', 'user.name', morgan.name], fx.env);
    const { cli } = await adapterFor(fx);
    expect(optionArg('--reason', 'fine')).toEqual(['--reason', 'fine']);
    expect(optionArg('--reason', '-x dash first')).toEqual(['--reason=-x dash first']);
    const out = await cli.json(['memory', 'reject'], {
      options: { '--reason': '-x dash first' },
      positionals: ['task-001-login-form'],
    });
    expect(out.data).toMatchObject({ id: 'task-001-login-form', reason: '-x dash first' });
  });

  it('passes user positionals after "--": one starting with "-" reaches the CLI as a value', async () => {
    const fx = await freshKanban();
    const { cli, spawned } = await adapterFor(fx);
    const error = await cli.json(['memory', 'history'], { positionals: ['--version'] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliRefusedError);
    expect((error as CliRefusedError).cliMessage).toBe('document not found: --version');
    expect(spawned[0]?.args.slice(1)).toEqual(['--format', 'json', 'memory', 'history', '--', '--version']);
    const out = await cli.json(['memory', 'history'], { positionals: ['task-001-login-form'] });
    expect(out.data).toMatchObject({ id: 'task-001-login-form' });
  });

  it('refuses a word that starts with "-", or an option without "--", before starting any process', async () => {
    const fx = await freshKanban();
    const { cli, spawned } = await adapterFor(fx);
    await expect(cli.json(['memory', 'history', '--help'])).rejects.toBeInstanceOf(CliInternalError);
    await expect(cli.json(['memory', 'search'], { options: { status: 'x' } })).rejects.toBeInstanceOf(CliInternalError);
    expect(spawned).toEqual([]);
  });
});

describe('TT-INT-04 — 30 s timeout', () => {
  it('uses 30 s', () => {
    expect(CLI_TIMEOUT_MS).toBe(30_000);
  });

  it('kills a CLI stub that sleeps 40 s at 30 s ± 1 s; the request fails with 504 cli-timeout', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    await writeCliPackage(cliPackageDir(fx), '0.2.2', sleepingCliSource(40));
    const { cli } = await adapterFor(fx);
    const started = performance.now();
    const error = await cli.json(['memory', 'search']).catch((e: unknown) => e);
    const elapsed = performance.now() - started;
    expect(error).toBeInstanceOf(CliTimeoutError);
    expect(elapsed).toBeGreaterThanOrEqual(29_000);
    expect(elapsed).toBeLessThanOrEqual(31_000);
    expect(cliErrorEnvelope(error as CliTimeoutError)).toEqual({
      status: 504,
      body: { error: { code: 'cli-timeout', message: 'WingFoil did not answer within 30 s' } },
    });
  }, 45_000);
});

describe('classification without processes (fake runner)', () => {
  it('exit 0 with output that is not JSON is an output error, mapped to 502 cli-output', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const runner = new FakeProcessRunner().answer({ stdout: 'not json' });
    const cli = new WingfoilCli({
      cli: { source: 'project', projectRoot: root, file: process.execPath, prefixArgs: ['/x/cli.js'] },
      runner,
    });
    const error = await cli.json(['dna', 'show']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliOutputError);
    expect(cliErrorEnvelope(error as CliOutputError)).toEqual({
      status: 502,
      body: { error: { code: 'cli-output', message: 'Unexpected output of dna show' } },
    });
    expect(runner.requests[0]).toMatchObject({
      file: process.execPath,
      args: ['/x/cli.js', '--format', 'json', 'dna', 'show'],
      cwd: root,
      timeoutMs: CLI_TIMEOUT_MS,
    });
  });

  it('a process killed by a signal, cancelled or with runaway output is a process error', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const cliInfo = {
      source: 'project' as const,
      projectRoot: root,
      file: process.execPath,
      prefixArgs: ['/x/cli.js'],
    };
    for (const [answer, reason] of [
      [{ exitCode: null, signal: 'SIGKILL' as const }, 'WingFoil was killed by SIGKILL'],
      [{ exitCode: null, ended: 'cancelled' as const }, 'WingFoil was cancelled'],
      [{ exitCode: null, ended: 'terminated' as const }, 'WingFoil was stopped with the server'],
      [{ exitCode: null, ended: 'overflow' as const }, 'WingFoil wrote too much output'],
    ] as const) {
      const cli = new WingfoilCli({ cli: cliInfo, runner: new FakeProcessRunner().answer(answer) });
      await expect(cli.json(['paths'])).rejects.toMatchObject({ reason });
    }
  });

  it('renders options after the words, a repeated option once per value', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const runner = new FakeProcessRunner().answer({ stdout: '{"id":"x","path":"y"}' });
    const cli = new WingfoilCli({
      cli: { source: 'path', projectRoot: root, file: '/usr/bin/wingfoil', prefixArgs: [] },
      runner,
      timeoutMs: 1234,
    });
    await cli.json(['memory', 'add'], { options: { '--type': 'adr', '--title': '-dash', '--set': ['a=1', 'b=2'] } });
    expect(runner.requests[0]).toMatchObject({
      file: '/usr/bin/wingfoil',
      args: ['--format', 'json', 'memory', 'add', '--type', 'adr', '--title=-dash', '--set', 'a=1', '--set', 'b=2'],
      timeoutMs: 1234,
    });
  });

  it('logs every process error and timeout with the command words and option names, never their values', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const cliInfo = {
      source: 'project' as const,
      projectRoot: root,
      file: process.execPath,
      prefixArgs: ['/x/cli.js'],
    };
    for (const [answer, reason] of [
      [{ exitCode: 3 }, 'WingFoil exited with status 3'],
      [{ exitCode: null, ended: 'cancelled' as const }, 'WingFoil was cancelled'],
      [{ exitCode: null, ended: 'timeout' as const }, 'WingFoil did not answer within 30 s'],
    ] as const) {
      const logger = { error: vi.fn() };
      const cli = new WingfoilCli({ cli: cliInfo, runner: new FakeProcessRunner().answer(answer), logger });
      await expect(
        cli.json(['memory', 'reject'], { options: { '--reason': 'secret-reason' }, positionals: ['secret-title'] }),
      ).rejects.toThrow(reason);
      expect(logger.error).toHaveBeenCalledTimes(1);
      const [logged, message] = logger.error.mock.calls[0] as [object, string];
      expect(logged).toMatchObject({ words: ['memory', 'reject'], options: ['--reason'], reason });
      expect(message).toBe(reason);
      expect(JSON.stringify(logged)).not.toMatch(/secret/);
    }
  });

  it('logs at most the first 200 characters of an exit-2 stderr', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const logger = { error: vi.fn() };
    const cli = new WingfoilCli({
      cli: { source: 'project', projectRoot: root, file: process.execPath, prefixArgs: ['/x/cli.js'] },
      runner: new FakeProcessRunner().answer({ exitCode: 2, stderr: `error: ${'x'.repeat(500)}` }),
      logger,
    });
    await expect(cli.json(['paths'])).rejects.toBeInstanceOf(CliInternalError);
    const logged = logger.error.mock.calls[0]?.[0] as { stderr: string };
    expect(logged.stderr).toHaveLength(200);
    expect(logged.stderr.startsWith('error: xxx')).toBe(true);
  });

  it('exit 1 with an empty stderr is a refusal that says so', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const cli = new WingfoilCli({
      cli: { source: 'project', projectRoot: root, file: process.execPath, prefixArgs: ['/x/cli.js'] },
      runner: new FakeProcessRunner().answer({ exitCode: 1, stderr: ' \n' }),
    });
    await expect(cli.json(['paths'])).rejects.toMatchObject({
      cliMessage: 'WingFoil refused (exit status 1) without a message',
    });
  });

  it('an empty --version answer is an output error', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const cli = new WingfoilCli({
      cli: { source: 'path', projectRoot: root, file: '/usr/bin/wingfoil', prefixArgs: [] },
      runner: new FakeProcessRunner().answer({ stdout: '\n' }),
    });
    await expect(cli.version()).rejects.toBeInstanceOf(CliOutputError);
  });
});
