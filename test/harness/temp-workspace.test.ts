// bug-001: a test that times out must still leave no temporary directory behind. The TypeDoc
// test's process kept writing into its folder after the 30 s timeout, so the `afterAll` removal
// raced with it and `/tmp/wfui-typedoc-*` stayed. `TempWorkspace.dispose()` stops the processes
// first, then removes the folder.
import { stat } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { TempWorkspace } from './temp-workspace.js';

/** A process that creates a file in `dir` every 20 ms, forever. */
const WRITER = `
const fs = require('node:fs');
const path = require('node:path');
let n = 0;
setInterval(() => {
  fs.mkdirSync(process.argv[1], { recursive: true });
  fs.writeFileSync(path.join(process.argv[1], 'f' + n++), 'x');
}, 20);
`;

async function exists(file: string): Promise<boolean> {
  return stat(file).then(
    () => true,
    () => false,
  );
}

const open: TempWorkspace[] = [];
afterEach(async () => {
  await Promise.all(open.map((w) => w.dispose()));
});

describe('TempWorkspace', () => {
  it('removes its folder for good although one of its processes is still writing into it', async () => {
    const workspace = await TempWorkspace.create('wfui-tempws-');
    open.push(workspace);
    const out = `${workspace.dir}/out`;
    const running = workspace.run(process.execPath, ['-e', WRITER, out], { allowFailure: true, timeoutMs: 60_000 });
    await expect.poll(() => exists(out), { timeout: 10_000 }).toBe(true);
    // As after a test timeout: the process has not ended.
    await workspace.dispose();
    expect(await exists(workspace.dir)).toBe(false);
    await new Promise((r) => setTimeout(r, 300));
    expect(await exists(workspace.dir)).toBe(false);
    const result = await running;
    expect(result.code).not.toBe(0);
  });

  it('can be disposed twice', async () => {
    const workspace = await TempWorkspace.create('wfui-tempws-');
    await workspace.dispose();
    await workspace.dispose();
    expect(await exists(workspace.dir)).toBe(false);
  });
});
