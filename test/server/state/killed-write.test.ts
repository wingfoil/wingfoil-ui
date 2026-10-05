// spec-006 §4, §6 — the built adapter in child processes: a process killed in the middle of its
// writes never leaves a partial `state.json`, and two processes adding at once lose nothing.
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { REPO_ROOT } from '../../harness/cli.js';
import { openFileStateStore } from '../../../server/src/state/file-store.js';

let root: string;
let writer: string;
let adder: string;

beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-kill-'));
  const adapter = JSON.stringify(pathToFileURL(path.join(REPO_ROOT, 'server/dist/state/file-store.js')).href);
  writer = path.join(root, 'writer.mjs');
  // Large names make every write long enough to be cut in the middle.
  await writeFile(
    writer,
    `import { openFileStateStore } from ${adapter};
const store = await openFileStateStore({ dir: process.argv[2] });
const big = 'x'.repeat(200_000);
for (let i = 0; ; i++) {
  await store.add({ path: '/home/alex/p' + i, name: big + i, remote: '' });
  if (store.projects().length > 20) await store.remove(store.projects()[0].id);
}
`,
  );
  adder = path.join(root, 'adder.mjs');
  await writeFile(
    adder,
    `import { openFileStateStore } from ${adapter};
const [, , dir, tag, count] = process.argv;
const store = await openFileStateStore({ dir });
for (let i = 0; i < Number(count); i++) {
  await store.add({ path: '/home/alex/' + tag + '-' + i, name: tag + i + 'y'.repeat(20_000), remote: '' });
}
`,
  );
}, 60_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

function exitOf(child: ReturnType<typeof spawn>): Promise<number | null> {
  return new Promise((resolve) => child.once('exit', (code) => resolve(code)));
}

it('leaves a whole, valid state.json when killed in the middle of a write (≥ 2 kills inside a write)', async () => {
  let cutInWrite = 0;
  let rounds = 0;
  for (; rounds < 40 && cutInWrite < 2; rounds++) {
    const dir = path.join(root, `state-${rounds}`);
    const child = spawn(process.execPath, [writer, dir], { stdio: 'ignore' });
    const exited = exitOf(child);
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
    await new Promise((r) => setTimeout(r, 20 + ((rounds * 37) % 150)));
    child.kill('SIGKILL');
    await exited;
    // A temporary file left behind proves the kill landed between its creation and the rename.
    if ((await readdir(dir)).some((f) => f.startsWith('state.json.tmp-'))) cutInWrite++;
    JSON.parse(await readFile(path.join(dir, 'state.json'), 'utf8'));
    const store = await openFileStateStore({ dir });
    expect(store.warnings()).toEqual([]);
    expect(store.projects().length).toBeGreaterThan(0);
    // The killed process's temporary file is swept when the state is opened again.
    expect((await readdir(dir)).filter((f) => f.startsWith('state.json.tmp-'))).toEqual([]);
  }
  expect(cutInWrite).toBeGreaterThanOrEqual(2);
}, 120_000);

it('two processes adding at the same time lose nothing (2 × 25 adds → 50 entries)', async () => {
  const dir = path.join(root, 'two');
  const children = ['a', 'b'].map((tag) => spawn(process.execPath, [adder, dir, tag, '25'], { stdio: 'inherit' }));
  expect(await Promise.all(children.map(exitOf))).toEqual([0, 0]);
  const store = await openFileStateStore({ dir });
  expect(store.projects()).toHaveLength(50);
  expect(new Set(store.projects().map((p) => p.id)).size).toBe(50);
  expect(await readdir(dir)).toEqual(['state.json']);
}, 60_000);
