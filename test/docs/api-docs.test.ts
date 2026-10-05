// dev-loop `refactor` gates `docs.api.public-complete` and `docs.api.build`: TypeDoc builds the API
// docs of server/ and contracts/, and an undocumented exported declaration fails the build.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { run } from '../harness/run.js';

const TYPEDOC = path.join(REPO_ROOT, 'node_modules', 'typedoc', 'bin', 'typedoc');
let tmp: string;

beforeAll(async () => {
  tmp = await mkdtemp(path.join(tmpdir(), 'wfui-typedoc-'));
});

afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

describe('API docs', () => {
  it('build with the repository configuration', async () => {
    const result = await run(
      process.execPath,
      [TYPEDOC, '--options', 'typedoc.json', '--out', path.join(tmp, 'out'), '--logLevel', 'Warn'],
      { cwd: REPO_ROOT, allowFailure: true, timeoutMs: 120_000 },
    );
    expect(result.stdout + result.stderr).not.toMatch(/\[(warning|error)\]/);
    expect(result.code).toBe(0);
  });

  it('fail on an undocumented exported declaration', async () => {
    const entry = path.join(tmp, 'undocumented.ts');
    await writeFile(entry, '/** Module. @packageDocumentation */\nexport function undocumented(): number {\n  return 1;\n}\n');
    await writeFile(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(REPO_ROOT, 'tsconfig.base.json'), compilerOptions: { noEmit: true, composite: false }, files: [entry] }),
    );
    const result = await run(
      process.execPath,
      [TYPEDOC, '--options', 'typedoc.json', '--entryPoints', entry, '--tsconfig', path.join(tmp, 'tsconfig.json'), '--out', path.join(tmp, 'out2')],
      { cwd: REPO_ROOT, allowFailure: true, timeoutMs: 120_000 },
    );
    expect(result.code).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/undocumented/);
  });
});
