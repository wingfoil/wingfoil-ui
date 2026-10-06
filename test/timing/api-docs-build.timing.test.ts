// dev-loop `refactor` gate `docs.api.build`: TypeDoc builds the API docs of server/ and contracts/
// with the repository configuration within the 30 s test timeout. Timing suite (bug-001): the
// build time is printed with the load average; the temporary folder is removed even when the test
// times out (TempWorkspace stops TypeDoc first). `npm run docs:api` is the gate itself.
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { report } from './load.js';

const TYPEDOC = path.join(REPO_ROOT, 'node_modules', 'typedoc', 'bin', 'typedoc');
let workspace: TempWorkspace;

beforeAll(async () => {
  workspace = await TempWorkspace.create('wfui-typedoc-');
});

afterAll(async () => {
  await workspace.dispose();
});

// TypeDoc is killed at 28 s, before the 30 s test timeout, so the failure names the build.
describe('API docs', () => {
  it('build with the repository configuration', async () => {
    const t0 = performance.now();
    const result = await workspace.run(
      process.execPath,
      [TYPEDOC, '--options', 'typedoc.json', '--out', path.join(workspace.dir, 'out'), '--logLevel', 'Warn'],
      { cwd: REPO_ROOT, allowFailure: true, timeoutMs: 28_000 },
    );
    const ms = String(Math.round(performance.now() - t0));
    report('TypeDoc build (ms)', result.code === 0 ? ms : `${ms} (exit ${String(result.code)})`);
    expect(result.stdout + result.stderr).not.toMatch(/\[(warning|error)\]/);
    expect(result.code).toBe(0);
  });
});
