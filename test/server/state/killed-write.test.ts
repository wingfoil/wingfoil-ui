// spec-006 §6 — atomic write: a process killed in the middle of its writes never leaves a partial
// `state.json` (the built adapter, run in a child process that is SIGKILLed).
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { REPO_ROOT } from '../../harness/cli.js';
import { run } from '../../harness/run.js';
import { openFileStateStore } from '../../../server/src/state/file-store.js';

let root: string;
let script: string;

beforeAll(async () => {
  await run(process.execPath, [path.join(REPO_ROOT, 'node_modules/typescript/bin/tsc'), '-b', 'server'], {
    cwd: REPO_ROOT,
    timeoutMs: 120_000,
  });
  root = await mkdtemp(path.join(tmpdir(), 'wfui-kill-'));
  script = path.join(root, 'writer.mjs');
  const adapter = pathToFileURL(path.join(REPO_ROOT, 'server/dist/state/file-store.js')).href;
  // Large names make every write long enough to be cut in the middle.
  await writeFile(
    script,
    `import { openFileStateStore } from ${JSON.stringify(adapter)};
const store = await openFileStateStore({ dir: process.argv[2] });
const big = 'x'.repeat(200_000);
for (let i = 0; ; i++) {
  await store.add({ path: '/home/alex/p' + i, name: big + i, remote: '' });
  if (store.projects().length > 20) await store.remove(store.projects()[0].id);
}
`,
  );
}, 180_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

it('leaves a whole, valid state.json after each of 5 kills', async () => {
  for (let round = 0; round < 5; round++) {
    const dir = path.join(root, `state-${round}`);
    const child = spawn(process.execPath, [script, dir], { stdio: 'ignore' });
    const exited = new Promise((resolve) => child.once('exit', resolve));
    await expect
      .poll(
        () =>
          stat(path.join(dir, 'state.json')).then(
            () => true,
            () => false,
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
    await new Promise((r) => setTimeout(r, 50 + round * 37));
    child.kill('SIGKILL');
    await exited;
    JSON.parse(await readFile(path.join(dir, 'state.json'), 'utf8'));
    const store = await openFileStateStore({ dir });
    expect(store.warnings()).toEqual([]);
    expect(store.projects().length).toBeGreaterThan(0);
  }
});
