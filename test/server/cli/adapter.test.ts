// spec-001 §1–2, adr-001 D2/D5, REQ-ARC-02, REQ-INT-04 — invoking the project's CLI on the real
// fixtures: the process audit (TT-ARC-02), the result classification and the 30 s timeout
// (TT-INT-04), S-27.1 on the adapter side.
import { existsSync } from 'node:fs';
import { appendFile, chmod, mkdtemp, readFile, realpath, rm, utimes, writeFile } from 'node:fs/promises';
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
import { binScript, PINNED_PACKAGE_DIR, pinnedVersionText } from '../../harness/cli.js';
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
  it('with the pinned version and wingfoil 0.2.1 first on the PATH, every CLI process runs the pinned binary', async () => {
    const fx = await freshKanban();
    const marker = path.join(root, `marker-${n}`);
    const pkg = path.join(root, `fake-${n}`, 'pkg');
    await writeCliPackage(pkg, '0.2.1', markingCliSource('0.2.1', marker));
    const env = withPathFirst(fx.env, await installGlobally(path.join(root, `fake-${n}`, 'prefix'), pkg));
    const { cli, spawned } = await adapterFor(fx, env);

    expect(await cli.version()).toMatch(pinnedVersionText());
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
    expect(await cli.version()).toMatch(pinnedVersionText());
  });

  it('S-08.2 — runs the PATH CLI, through its package bin script, when the project pins none', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    const base = await envWithoutWingfoil(fx.env, path.join(root, `safe-${n}`));
    const bin = await installGlobally(path.join(root, `global-${n}`), PINNED_PACKAGE_DIR);
    const { cli, spawned } = await adapterFor(fx, withPathFirst(base, bin));
    expect(cli.source).toBe('path');
    expect(await cli.version()).toMatch(pinnedVersionText());
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
          // No absolute path in the body (bug-012, coordinator C2): the install command only.
          detail: { command: 'npm install --save-dev wingfoil' },
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
    // A field WingFoil does not know (0.3 knows `scope`, which 0.2.2 reported).
    await writeFile(directive, text.replace(/^title:/m, 'flavour: whatever\ntitle:'));
    const { cli } = await adapterFor(fx);
    const out = await cli.json(['directives', 'list']);
    expect((out.data as { entries: unknown[] }).entries.length).toBeGreaterThan(0);
    expect(out.warnings).toHaveLength(1);
    // The warning's text, also from WingFoil 0.3, which writes it as `{"warning": "…"}` (task-046).
    expect(out.warnings[0]).toMatch(
      /^\.wingfoil\/directives\/built-in\/testing\.md: unknown field\(s\) ignored: flavour$/,
    );
  });

  // bug-017 (task-040 review round 3, S3-1): a CLI warning goes through the one sanitiser — a field
  // name with a RIGHT-TO-LEFT OVERRIDE comes out as a visible escape, the project root as <project>.
  it('exit 0: a warning quoting a field with a bidi control is escaped, the root redacted', async () => {
    const fx = await freshKanban();
    const directive = path.join(fx.dir, '.wingfoil', 'directives', 'built-in', 'testing.md');
    const text = await readFile(directive, 'utf8');
    await writeFile(directive, text.replace(/^title:/m, `sco\u202epe: whatever\ntitle:`));
    const { cli } = await adapterFor(fx);
    const out = await cli.json(['directives', 'list']);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toContain('sco\\u202epe');
    expect(out.warnings[0]).not.toContain('\u202e');
    expect(out.warnings[0]).not.toContain(fx.dir);
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
      // The kind only (task-032 review I1); the option names are in `options`. WingFoil 0.3 answers
      // `{"error":"unknown option '--bogus'"}`: no kind before a colon, so the generic one.
      stderr: 'usage error',
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

  // The kill comes from the 30 s timer: never before 29 s, and before the stub's 40 s sleep ends.
  // The upper bound is wide for a loaded machine (bug-001); `CLI_TIMEOUT_MS` is the 30 s itself.
  it('kills a CLI stub that sleeps 40 s at the 30 s timeout; the request fails with 504 cli-timeout', async () => {
    const fx = await freshKanban();
    await removeCli(fx);
    await writeCliPackage(cliPackageDir(fx), '0.2.2', sleepingCliSource(40));
    const { cli } = await adapterFor(fx);
    const started = performance.now();
    const error = await cli.json(['memory', 'search']).catch((e: unknown) => e);
    const elapsed = performance.now() - started;
    expect(error).toBeInstanceOf(CliTimeoutError);
    expect(elapsed).toBeGreaterThanOrEqual(29_000);
    expect(elapsed).toBeLessThan(39_000);
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

  it('W4-13: exit 0 with its pipes cut (drained) is a process error, never parsed', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const runner = new FakeProcessRunner().answer({ stdout: '{"id":"x","path":"y"}', drained: true });
    const cli = new WingfoilCli({
      cli: { source: 'project', projectRoot: root, file: process.execPath, prefixArgs: ['/x/cli.js'] },
      runner,
    });
    await expect(cli.json(['paths'])).rejects.toBeInstanceOf(CliProcessError);
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

  it.each([
    [`error: ${'x'.repeat(500)}`, 'error'],
    [
      '{"error":"invalid flag value: --reason must not contain a line starting with \\"Approver:\\""}',
      'invalid flag value',
    ],
    ['{"error":"missing required argument: --reason"}', 'missing required argument'],
    ["error: unknown option '--secret-value'", 'error'],
    ['no colon here secret-value', 'usage error'],
  ])('logs only the kind of an exit-2 message, never a value (task-032 review I1): %s', async (stderr, kind) => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const logger = { error: vi.fn() };
    const cli = new WingfoilCli({
      cli: { source: 'project', projectRoot: root, file: process.execPath, prefixArgs: ['/x/cli.js'] },
      runner: new FakeProcessRunner().answer({ exitCode: 2, stderr }),
      logger,
    });
    await expect(cli.json(['paths'])).rejects.toBeInstanceOf(CliInternalError);
    const logged = logger.error.mock.calls[0]?.[0] as { stderr: string };
    expect(logged.stderr).toBe(kind);
    expect(JSON.stringify(logged)).not.toContain('secret-value');
  });

  it('a refusal quoting the project root and the CLI package keeps its wording, not the folders (task-033 D33-5, bug-012)', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const packageDir = path.join(root, 'elsewhere', 'wingfoil');
    const message = `Command failed: git -C ${root} log -- x\nat ${packageDir}/dist/cli.js:1`;
    const cli = new WingfoilCli({
      cli: { source: 'path', projectRoot: root, file: process.execPath, prefixArgs: ['/x/cli.js'], packageDir },
      runner: new FakeProcessRunner().answer({ exitCode: 1, stderr: JSON.stringify({ error: message }) }),
    });
    const error = (await cli.json(['paths']).catch((e: unknown) => e)) as CliRefusedError;
    expect(error).toBeInstanceOf(CliRefusedError);
    expect(error.cliMessage).toBe(
      'Command failed: git -C <project> log -- x\nat <project>/elsewhere/wingfoil/dist/cli.js:1',
    );
    expect(cliErrorEnvelope(error).body.error.message).not.toContain(root);
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

// task-046 D46-5: WingFoil 0.3.1's `workflow list` runs `git status` with optional locks, which
// rewrites a stale `.git/index`; every WingFoil process runs with `GIT_OPTIONAL_LOCKS=0`, so a read
// leaves the index as it was (task-025 AC-5). Commits take required locks: writes are unaffected.
describe('D46-5 — every WingFoil process runs without optional git locks', () => {
  const resolved = { source: 'project' as const, projectRoot: '/p', file: process.execPath, prefixArgs: ['/p/cli.js'] };

  it('adds GIT_OPTIONAL_LOCKS=0 to the given environment and to the inherited one, for every command', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const runner = new FakeProcessRunner()
      .answer({ stdout: '{}' })
      .answer({ stdout: JSON.stringify({ id: 'x', path: 'x.md', from: 'draft', to: 'pending' }) });
    const given = new WingfoilCli({ cli: resolved, runner, env: { PATH: '/bin', GIT_OPTIONAL_LOCKS: '1' } });
    await given.json(['paths']);
    await given.json(['memory', 'submit'], { positionals: ['x'] });
    const inherited = new WingfoilCli({ cli: resolved, runner: runner.answer({ stdout: '0.3.1' }) });
    await inherited.version();
    expect(runner.requests).toHaveLength(3);
    // GIT_NO_LAZY_FETCH: D46-7 (review round 2).
    expect(runner.requests[0]!.env).toEqual({
      PATH: '/bin',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1',
      GIT_ALLOW_PROTOCOL: 'none',
    });
    expect(runner.requests[1]!.env).toEqual({
      PATH: '/bin',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1',
      GIT_ALLOW_PROTOCOL: 'none',
    });
    expect(runner.requests[2]!.env).toEqual({
      ...withoutCliGitVariables(process.env),
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1',
      GIT_ALLOW_PROTOCOL: 'none',
    });
  });

  // Review round 1 n3: on Windows the variable names are case-insensitive — no second spelling.
  it('replaces a differently-cased GIT_OPTIONAL_LOCKS instead of adding a second one', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const runner = new FakeProcessRunner().answer({ stdout: '{}' });
    await new WingfoilCli({ cli: resolved, runner, env: { PATH: '/bin', git_optional_locks: '1' } }).json(['paths']);
    expect(runner.requests[0]!.env).toEqual({
      PATH: '/bin',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1',
      GIT_ALLOW_PROTOCOL: 'none',
    });
  });

  // Review round 1 M1 (D46-6): no fsmonitor program in any WingFoil process, writes included.
  it('asks the runner for core.fsmonitor=false on every command', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const runner = new FakeProcessRunner()
      .answer({ stdout: '{}' })
      .answer({ stdout: JSON.stringify({ id: 'x', path: 'x.md', from: 'draft', to: 'pending' }) })
      .answer({ stdout: '0.3.1' });
    const cli = new WingfoilCli({ cli: resolved, runner });
    await cli.json(['paths']);
    await cli.json(['memory', 'submit'], { positionals: ['x'] });
    await cli.version();
    for (const r of runner.requests) {
      expect(r.gitConfig).toEqual([
        ['core.fsmonitor', 'false'],
        ['protocol.allow', 'never'],
      ]);
    }
  });

  it('a configured fsmonitor program never runs: the reads and a submit of the pinned CLI (real CLI)', async () => {
    const fx = await freshKanban();
    const marker = path.join(root, `fsmonitor-${n}.log`);
    const program = path.join(root, `fsmonitor-${n}.sh`);
    await writeFile(program, `#!/bin/sh\necho ran >> '${marker}'\nexit 1\n`);
    await chmod(program, 0o755);
    await git(fx.dir, ['config', 'core.fsmonitor', program], fx.env);
    // Stale index entries, so that a git status would consult the fsmonitor.
    const later = new Date(Date.now() + 5_000);
    await utimes(path.join(fx.dir, '.wingfoil', 'dna.yaml'), later, later);
    const { cli } = await adapterFor(fx);
    await cli.json(['workflow', 'list']);
    await cli.json(['dna', 'show']);
    await cli.json(['memory', 'search']);
    await cli.json(['directives', 'list']);
    await cli.json(['memory', 'submit'], { positionals: ['task-004-session-timeout'] });
    expect(existsSync(marker), 'the fsmonitor program ran').toBe(false);
  }, 120_000);

  it('the pinned workflow list leaves a stale .git/index unchanged (real CLI)', async () => {
    const fx = await freshKanban();
    const { cli } = await adapterFor(fx);
    const file = path.join(fx.dir, '.wingfoil', 'dna.yaml');
    for (let i = 0; i < 2; i += 1) {
      // A tracked file whose stat no longer matches the index entry: git would refresh the index.
      const later = new Date(Date.now() + 5_000 * (i + 1));
      await utimes(file, later, later);
      const before = await readFile(path.join(fx.dir, '.git', 'index'));
      await cli.json(['workflow', 'list']);
      expect((await readFile(path.join(fx.dir, '.git', 'index'))).equals(before)).toBe(true);
    }
  }, 120_000);
});

// Review round 1 c4: WingFoil 0.3.1 names its files relative to the project, so the redaction of
// a quoted root is proved on a CLI that quotes it — the 0.2.2 build of the matrix (bug-012, D33-5).
describe('c4 — the root a real CLI quotes in a refusal is redacted (WingFoil 0.2.2 build)', () => {
  it('an invalid dna.yaml: the refusal names <project>, never the folder', async () => {
    const { cliBuildFor } = await import('../../contracts/support.js');
    const fx = await buildFixture('kanban', {
      root: path.join(root, 'kanban-0.2.2'),
      cli: await cliBuildFor('0.2.2'),
      cliVersion: '0.2.2',
    });
    await appendFile(path.join(fx.dir, '.wingfoil', 'dna.yaml'), 'project: [unclosed\n  : :\n');
    const raw = await rawDnaRefusal(fx);
    expect(raw).toContain(fx.dir);
    const { cli } = await adapterFor(fx);
    const error = (await cli.json(['dna', 'show']).catch((e: unknown) => e)) as CliRefusedError;
    expect(error).toBeInstanceOf(CliRefusedError);
    expect(error.cliMessage).toContain('<project>');
    expect(error.cliMessage).not.toContain(fx.dir);
  }, 300_000);
});

/** The raw stderr of `dna show` on `fx` (the CLI's own wording, before the adapter). */
async function rawDnaRefusal(fx: Fixture): Promise<string> {
  const { run } = await import('../../harness/run.js');
  const r = await run(process.execPath, [binScript(cliPackageDir(fx)), '--format', 'json', 'dna', 'show'], {
    cwd: fx.dir,
    env: fx.env,
    allowFailure: true,
  });
  return r.stderr;
}

// Review round 2 M2 (D46-7): a partial clone whose promisor remote names a program — an
// `uploadpack` for a local remote, a `core.sshCommand` for an ssh one — runs it when a read needs a
// missing blob (git's lazy fetch). No WingFoil process and no server git read does any transport:
// `protocol.allow=never` (and `GIT_NO_LAZY_FETCH=1`) refuse it before the program starts.
describe('D46-7 — no lazy fetch: a promisor remote’s program never runs on a read', () => {
  /** `fx` as a partial clone missing the HEAD blobs of `.wingfoil/*.yaml`, with a marker program. */
  async function promisorTrap(
    fx: Fixture,
    variant: 'uploadpack' | 'ssh' | 'file-allowed' | 'ext-allowed' | 'env-allowed',
  ): Promise<string> {
    const marker = path.join(root, `promisor-${variant}-${n}.log`);
    const program = path.join(root, `promisor-${variant}-${n}.sh`);
    await writeFile(program, `#!/bin/sh\necho ran >> '${marker}'\nexit 1\n`);
    await chmod(program, 0o755);
    const tree = (await git(fx.dir, ['ls-tree', 'HEAD', '.wingfoil/'], fx.env)).stdout;
    const blobs = [...tree.matchAll(/^\d+ blob ([0-9a-f]{40})\t.*\.ya?ml$/gm)].map((m) => m[1]!);
    expect(blobs.length).toBeGreaterThan(0);
    for (const sha of blobs) {
      const loose = path.join(fx.dir, '.git', 'objects', sha.slice(0, 2), sha.slice(2));
      expect(existsSync(loose), `${sha} is a loose object`).toBe(true);
      await rm(loose);
    }
    const set = (key: string, value: string) => git(fx.dir, ['config', key, value], fx.env);
    await set('core.repositoryformatversion', '1');
    await set('extensions.partialClone', 'evil');
    await set('remote.evil.promisor', 'true');
    if (variant === 'ssh') {
      await set('remote.evil.url', 'ssh://example.invalid/repo.git');
      await set('core.sshCommand', program);
    } else if (variant === 'ext-allowed') {
      // Review round 3 M1: a per-protocol setting of the repository wins over `protocol.allow`.
      await set('remote.evil.url', `ext::${program} %S`);
      await set('protocol.ext.allow', 'always');
    } else {
      await set('remote.evil.url', fx.remoteDir);
      await set('remote.evil.uploadpack', program);
      if (variant === 'file-allowed') await set('protocol.file.allow', 'always');
    }
    return marker;
  }

  /**
   * A runner standing for a git that ignores `GIT_NO_LAZY_FETCH` (before 2.45.1; e.g. Apple Git
   * 2.39.3): it drops the variable from every request (review round 3 M1).
   */
  function olderGitRunner(): LocalProcessRunner {
    const runner = new LocalProcessRunner();
    runners.push(runner);
    const run = runner.run.bind(runner);
    runner.run = (request) => {
      const env = { ...(request.env ?? process.env) };
      for (const key of Object.keys(env)) if (key.toUpperCase() === 'GIT_NO_LAZY_FETCH') delete env[key];
      return run({ ...request, env });
    };
    return runner;
  }

  // Review round 3 M1: the repository's own per-protocol settings and an inherited
  // GIT_ALLOW_PROTOCOL re-enable a transport `protocol.allow=never` refuses; with a git that ignores
  // GIT_NO_LAZY_FETCH only GIT_ALLOW_PROTOCOL=none stops the lazy fetch.
  for (const variant of ['file-allowed', 'ext-allowed', 'env-allowed'] as const) {
    const inherited = (fx: Fixture): NodeJS.ProcessEnv =>
      variant === 'env-allowed' ? { ...fx.env, GIT_ALLOW_PROTOCOL: 'file:ext' } : fx.env;

    it(`${variant}, a git without GIT_NO_LAZY_FETCH: the pinned CLI's reads never run the program`, async () => {
      const fx = await freshKanban();
      const marker = await promisorTrap(fx, variant);
      const env = inherited(fx);
      const cli = new WingfoilCli({ cli: await discoverCli(fx.dir, { env }), runner: olderGitRunner(), env });
      await cli.json(['workflow', 'list']).catch(() => undefined);
      await cli.json(['memory', 'history'], { positionals: ['task-001-login-form'] }).catch(() => undefined);
      expect(existsSync(marker), 'the promisor program ran').toBe(false);
    }, 120_000);

    it(`${variant}, a git without GIT_NO_LAZY_FETCH: the server's memoryLog and status never run it`, async () => {
      const fx = await freshKanban();
      const marker = await promisorTrap(fx, variant);
      const env = inherited(fx);
      const { GitReads, resolveGit } = await import('../../../server/src/git/git.js');
      const reads = new GitReads({ git: await resolveGit(env), runner: olderGitRunner(), cwd: fx.dir, env });
      const head = (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
      await reads.memoryLog(['.wingfoil'], head).catch(() => undefined);
      await reads.status().catch(() => undefined);
      expect(existsSync(marker), 'the promisor program ran').toBe(false);
    }, 120_000);
  }

  for (const variant of ['uploadpack', 'ssh'] as const) {
    it(`${variant}: workflow list and memory history of the pinned CLI never run it (real CLI)`, async () => {
      const fx = await freshKanban();
      const marker = await promisorTrap(fx, variant);
      const { cli } = await adapterFor(fx);
      // The reads may fail (the blobs are missing): what matters is that nothing was fetched.
      await cli.json(['workflow', 'list']).catch(() => undefined);
      await cli.json(['memory', 'history'], { positionals: ['task-001-login-form'] }).catch(() => undefined);
      expect(existsSync(marker), 'the promisor program ran').toBe(false);
    }, 120_000);

    it(`${variant}: the server's Memory-events read (git log -p) never runs it`, async () => {
      const fx = await freshKanban();
      const marker = await promisorTrap(fx, variant);
      const { GitReads, resolveGit } = await import('../../../server/src/git/git.js');
      const reads = new GitReads({
        git: await resolveGit(fx.env),
        runner: new LocalProcessRunner(),
        cwd: fx.dir,
        env: fx.env,
      });
      const head = (await git(fx.dir, ['rev-parse', 'HEAD'], fx.env)).stdout.trim();
      await reads.memoryLog(['.wingfoil'], head).catch(() => undefined);
      await reads.status().catch(() => undefined);
      expect(existsSync(marker), 'the promisor program ran').toBe(false);
    }, 120_000);
  }

  it('asks the runner for protocol.allow=never and sets GIT_NO_LAZY_FETCH=1 on every command', async () => {
    const { FakeProcessRunner } = await import('../process/fake-runner.js');
    const runner = new FakeProcessRunner().answer({ stdout: '{}' });
    const resolved = {
      source: 'project' as const,
      projectRoot: '/p',
      file: process.execPath,
      prefixArgs: ['/p/cli.js'],
    };
    await new WingfoilCli({
      cli: resolved,
      runner,
      env: { PATH: '/bin', git_no_lazy_fetch: '0', git_allow_protocol: 'file' },
    }).json(['paths']);
    expect(runner.requests[0]!.gitConfig).toEqual([
      ['core.fsmonitor', 'false'],
      ['protocol.allow', 'never'],
    ]);
    expect(runner.requests[0]!.env).toEqual({
      PATH: '/bin',
      GIT_OPTIONAL_LOCKS: '0',
      GIT_NO_LAZY_FETCH: '1',
      GIT_ALLOW_PROTOCOL: 'none',
    });
  });
});

/** `env` without any spelling of GIT_ALLOW_PROTOCOL, GIT_OPTIONAL_LOCKS or GIT_NO_LAZY_FETCH. */
function withoutCliGitVariables(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (!['GIT_ALLOW_PROTOCOL', 'GIT_OPTIONAL_LOCKS', 'GIT_NO_LAZY_FETCH'].includes(k.toUpperCase())) out[k] = v;
  }
  return out;
}

// Review round 4 MAJOR-2 (D46-8): an empty or relative PATH entry would make WingFoil's bare `git`
// (spawned in the project root) run a program the repository ships. Every child of the runner gets
// the absolute PATH entries only.
describe('D46-8 — no relative PATH entry in any child: a git the repository ships never runs', () => {
  async function shippedGit(fx: Fixture): Promise<string> {
    const marker = path.join(root, `shipped-git-${n}.log`);
    const { resolveGit } = await import('../../../server/src/git/git.js');
    const realGit = await resolveGit(fx.env);
    await writeFile(path.join(fx.dir, 'git'), `#!/bin/sh\necho ran >> '${marker}'\nexec '${realGit}' "$@"\n`);
    await chmod(path.join(fx.dir, 'git'), 0o755);
    await git(fx.dir, ['add', 'git'], fx.env);
    await git(fx.dir, ['-c', 'user.name=A', 'commit', '-qm', 'ship a git'], fx.env);
    return marker;
  }

  const reads = async (cli: WingfoilCli) => {
    for (const words of [
      ['dna', 'show'],
      ['paths'],
      ['directives', 'list'],
      ['workflow', 'list'],
      ['memory', 'search'],
    ])
      await cli.json(words).catch(() => undefined);
    await cli.json(['memory', 'history'], { positionals: ['task-001-login-form'] }).catch(() => undefined);
  };

  for (const prefix of [':', '.:']) {
    it(`PATH starting with ${JSON.stringify(prefix)}: the pinned CLI's reads never run it (real CLI)`, async () => {
      const fx = await freshKanban();
      const marker = await shippedGit(fx);
      const env = { ...fx.env, PATH: `${prefix}${fx.env.PATH ?? ''}` };
      const { cli } = await adapterFor(fx, env);
      await reads(cli);
      expect(existsSync(marker), 'the shipped git ran').toBe(false);
    }, 120_000);
  }

  it('PATH starting with ":": the 0.2.2 build’s memory history never runs it (real CLI)', async () => {
    const { cliBuildFor } = await import('../../contracts/support.js');
    const fx = await buildFixture('kanban', {
      root: path.join(root, `kanban-0.2.2-path-${n}`),
      cli: await cliBuildFor('0.2.2'),
      cliVersion: '0.2.2',
    });
    const marker = await shippedGit(fx);
    const env = { ...fx.env, PATH: `:${fx.env.PATH ?? ''}` };
    const { cli } = await adapterFor(fx, env);
    await reads(cli);
    expect(existsSync(marker), 'the shipped git ran').toBe(false);
  }, 300_000);
});
