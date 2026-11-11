// spec-001 §2–§3, REQ-INT-01 — the static list of consumed commands, enforced by the adapter,
// and the validation of every exit-0 output against the command's schema (fake runner).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CliInternalError, CliOutputError, cliErrorEnvelope, WingfoilCli } from '../../../server/src/cli/adapter.js';
import { CLI_COMMANDS, commandFor, outputProblem } from '../../../server/src/cli/commands.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { FakeProcessRunner } from '../process/fake-runner.js';

const SAMPLES = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.2.2/kanban');
const sampleText = (f: string) => readFileSync(path.join(SAMPLES, f), 'utf8');
const CLI = { source: 'project' as const, projectRoot: '/p', file: process.execPath, prefixArgs: ['/x/cli.js'] };

function cliAnswering(stdout: string, logger = { error: vi.fn() }) {
  const runner = new FakeProcessRunner().answer({ stdout });
  return { cli: new WingfoilCli({ cli: CLI, runner, logger }), runner, logger };
}

describe('the static list', () => {
  it('maps command words to a listed command, and nothing else', () => {
    expect(commandFor(['memory', 'search'])).toBe('memory search');
    expect(commandFor(['paths'])).toBe('paths');
    expect(commandFor(['memory', 'deprecate'])).toBeUndefined();
    expect(commandFor(['memory'])).toBeUndefined();
    expect(commandFor(['dna', 'set'])).toBeUndefined();
    expect(commandFor(['--version'])).toBe('--version');
  });

  it('records the release each command is used from (spec-001 §3 "Since")', () => {
    expect(CLI_COMMANDS['memory search'].since).toBe('v0.1');
    expect(CLI_COMMANDS['memory approve'].since).toBe('v0.2');
    expect(CLI_COMMANDS['memory add'].since).toBe('v0.3');
  });

  it('refuses a command that is not on the list before starting any process (internal error)', async () => {
    const { cli, runner, logger } = cliAnswering('{}');
    const error = await cli.json(['memory', 'deprecate'], { positionals: ['x'] }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliInternalError);
    expect((error as CliInternalError).detail).toBe('command not on the static list: memory deprecate');
    expect(runner.requests).toEqual([]);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(cliErrorEnvelope(error as CliInternalError).status).toBe(500);
  });
});

describe('schema validation of exit-0 output (spec-001 §2)', () => {
  it('returns output that validates, typed by the command', async () => {
    const { cli } = cliAnswering(sampleText('memory-search.json'));
    const out = await cli.run('memory search');
    expect(out.data.matches.map((m) => m.id)).toContain('task-001-login-form');
  });

  // task-070 D70-10: `memory search` is validated per match since bug-024 (its twin is in
  // `memory-search-matches.test.ts`); `dna show` stays strict, as every other command.
  it('JSON failing the schema is an output error → 502 cli-output, logged without values', async () => {
    const data = JSON.parse(sampleText('dna-show.json')) as Record<string, unknown> & { project: { name: unknown } };
    delete data.stacks;
    data.version = 'Login form';
    const { cli, logger } = cliAnswering(JSON.stringify(data));
    const error = await cli.json(['dna', 'show']).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CliOutputError);
    expect(cliErrorEnvelope(error as CliOutputError)).toEqual({
      status: 502,
      body: { error: { code: 'cli-output', message: 'Unexpected output of dna show' } },
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
    const [logged] = logger.error.mock.calls[0] as [{ problems: string[] }];
    expect(logged.problems).toEqual(["/ must have required property 'stacks'", '/version must be number']);
    expect(JSON.stringify(logged)).not.toContain('Login form');
  });

  it('validates every command against its own schema (a search shape is not a history)', async () => {
    const { cli } = cliAnswering(sampleText('memory-search.json'));
    await expect(cli.json(['memory', 'history'], { positionals: ['task-001-login-form'] })).rejects.toBeInstanceOf(
      CliOutputError,
    );
  });

  it('the --version text is checked too: one non-empty line', async () => {
    await expect(cliAnswering('0.2.2\n').cli.version()).resolves.toBe('0.2.2');
    await expect(cliAnswering('0.2.2\nextra line\n').cli.version()).rejects.toBeInstanceOf(CliOutputError);
  });

  it('outputProblem names the failing paths, or undefined', () => {
    expect(outputProblem('paths', { sources: ['server/'] })).toBeUndefined();
    expect(outputProblem('paths', { sources: 'server/' })).toEqual(['/sources must be array']);
  });
});
