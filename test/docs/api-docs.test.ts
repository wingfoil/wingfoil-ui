// dev-loop `refactor` gate `docs.api.public-complete`: an undocumented exported declaration fails
// the TypeDoc build. The full build with the repository configuration (`docs.api.build`) is timed
// in the timing suite (`test/timing/api-docs-build.timing.test.ts`, bug-001). The temporary folder
// is removed even when the test times out (TempWorkspace stops TypeDoc first).
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const TYPEDOC = path.join(REPO_ROOT, 'node_modules', 'typedoc', 'bin', 'typedoc');
let workspace: TempWorkspace;

beforeAll(async () => {
  workspace = await TempWorkspace.create('wfui-typedoc-');
});

afterAll(async () => {
  await workspace.dispose();
});

describe('API docs', () => {
  // Not a timing test: one small file, a generous timeout for a loaded machine.
  it('fail on an undocumented exported declaration', async () => {
    const tmp = workspace.dir;
    const entry = path.join(tmp, 'undocumented.ts');
    await writeFile(entry, '/** Module. @packageDocumentation */\nexport function undocumented(): number {\n  return 1;\n}\n');
    await writeFile(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify({ extends: path.join(REPO_ROOT, 'tsconfig.base.json'), compilerOptions: { noEmit: true, composite: false }, files: [entry] }),
    );
    const result = await workspace.run(
      process.execPath,
      [TYPEDOC, '--options', 'typedoc.json', '--entryPoints', entry, '--tsconfig', path.join(tmp, 'tsconfig.json'), '--out', path.join(tmp, 'out2')],
      { cwd: REPO_ROOT, allowFailure: true, timeoutMs: 120_000 },
    );
    expect(result.code).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/undocumented/);
  }, 120_000);
});
