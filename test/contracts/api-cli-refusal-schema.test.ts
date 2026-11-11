// task-070 AC-2 (spec-004 §5; D70-6, D70-7) — `cli.refusal.schema.json`, the 422 `cli-refused`
// envelope of every route, and the `cli-refused` branch of `write.refusal.schema.json`: the captured
// refusals of every matrix version (`kanban/memory-submit-refused.stderr.txt`) mapped through the
// adapter and `cliErrorEnvelope` pass both; the shapes the server never sends are refused.
import { Ajv } from 'ajv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CliRefusedError, cliErrorEnvelope, WingfoilCli } from '../../server/src/cli/adapter.js';
import { REPO_ROOT } from '../harness/cli.js';
import { FakeProcessRunner } from '../server/process/fake-runner.js';

const ajv = new Ajv({ allErrors: true });
for (const file of readdirSync(path.join(REPO_ROOT, 'contracts', 'api'))) {
  ajv.addSchema(JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'api', file), 'utf8')) as object);
}
const byId = (file: string) => ajv.getSchema(`https://wingfoil-ui.local/contracts/api/${file}`)!;
const cliRefusal = byId('cli.refusal.schema.json');
const writeRefusal = byId('write.refusal.schema.json');

const matrix = JSON.parse(readFileSync(path.join(REPO_ROOT, 'contracts', 'matrix.json'), 'utf8')) as {
  versions: string[];
};
const sample = (version: string) =>
  readFileSync(
    path.join(
      REPO_ROOT,
      'test',
      'contracts',
      'samples',
      `wingfoil-${version}`,
      'kanban',
      'memory-submit-refused.stderr.txt',
    ),
    'utf8',
  );

async function bodyOf(stderr: string) {
  const cli = new WingfoilCli({
    cli: { source: 'project', projectRoot: '/p', file: process.execPath, prefixArgs: ['/x/cli.js'] },
    runner: new FakeProcessRunner().answer({ exitCode: 1, stderr }),
  });
  const error = await cli.run('memory submit', { positionals: ['task-001-login-form'] }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(CliRefusedError);
  return cliErrorEnvelope(error as CliRefusedError).body;
}

const refused = (detail?: unknown) => ({
  error: { code: 'cli-refused', message: 'refused', ...(detail === undefined ? {} : { detail }) },
});

describe.each(matrix.versions)('the captured refusal of wingfoil %s', (version) => {
  it('mapped by the adapter, passes cli.refusal and write.refusal', async () => {
    const body = await bodyOf(sample(version));
    expect(cliRefusal(body), JSON.stringify(cliRefusal.errors)).toBe(true);
    expect(writeRefusal(body), JSON.stringify(writeRefusal.errors)).toBe(true);
    const hasDetails = 'details' in (JSON.parse(sample(version)) as object);
    expect('detail' in body.error).toBe(hasDetails);
  });
});

describe('cli.refusal.schema.json', () => {
  it('accepts a message alone, and reasons', () => {
    expect(cliRefusal(refused())).toBe(true);
    expect(cliRefusal(refused({ reasons: ['why'] }))).toBe(true);
    expect(cliRefusal(refused({ reasons: Array.from({ length: 201 }, () => 'r') }))).toBe(true);
  });

  it.each([
    ['another code', { error: { code: 'cli-output', message: 'x' } }],
    ['an empty reasons list', refused({ reasons: [] })],
    ['a 202nd reason', refused({ reasons: Array.from({ length: 202 }, () => 'r') })],
    ['a reason that is not text', refused({ reasons: [3] })],
    ['a reason over 4 000 characters', refused({ reasons: ['r'.repeat(4_001)] })],
    ['a message over 4 000 characters', { error: { code: 'cli-refused', message: 'm'.repeat(4_001) } }],
    ['the files of details', refused({ reasons: ['r'], files: ['docs/x.md'] })],
    ['a detail without reasons', refused({})],
    ['another key', { error: { code: 'cli-refused', message: 'x', extra: 1 } }],
  ])('refuses %s', (_l, body) => {
    expect(cliRefusal(body)).toBe(false);
  });

  it('write.refusal takes the same cli-refused detail, and nothing else for that code', () => {
    expect(writeRefusal(refused({ reasons: ['why'] }))).toBe(true);
    expect(writeRefusal(refused({ reasons: [] }))).toBe(false);
    expect(writeRefusal(refused({ created: { id: 'x', path: 'y' } }))).toBe(false);
    // The other codes without a detail keep refusing one.
    expect(writeRefusal({ error: { code: 'cli-output', message: 'x', detail: { reasons: ['r'] } } })).toBe(false);
  });
});

describe('the captured samples (W-20)', () => {
  it('0.3.1 carries details[].detail; 0.2.2 the error only', () => {
    const v031 = JSON.parse(sample('0.3.1')) as { details?: { file: unknown; detail: unknown }[] };
    expect(v031.details?.map((d) => typeof d.detail)).toEqual(['string']);
    expect(Object.keys(JSON.parse(sample('0.2.2')) as object)).toEqual(['error']);
  });
});
