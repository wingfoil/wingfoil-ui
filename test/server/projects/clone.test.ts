// The undo of a refused clone (REQ-STATE-07, review round 1 item 2): `CloneTarget.discard` removes
// the working directory and the ancestors the clone created, but never what someone else created
// in those ancestors meanwhile.
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CloneTarget } from '../../../server/src/projects/clone.js';

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-clone-target-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('CloneTarget', () => {
  it('removes the directory and the empty ancestors it created, keeping a sibling created meanwhile', async () => {
    const base = path.join(root, 'a');
    const target = (await CloneTarget.inspect(path.join(base, 'projects', 'deep', 'kanban')))!;
    expect(target.createdRoot).toBe(base);
    // What git creates, and what another process creates next to it during the clone.
    await mkdir(path.join(target.directory, '.git'), { recursive: true });
    await writeFile(path.join(target.directory, 'README.md'), 'x');
    await writeFile(path.join(base, 'projects', 'sibling.txt'), 'mine');
    await target.discard();
    expect(await readdir(root)).toEqual(['a']);
    expect(await readdir(base)).toEqual(['projects']);
    expect(await readdir(path.join(base, 'projects'))).toEqual(['sibling.txt']);
  });

  it('removes every created ancestor when nothing else was added', async () => {
    const target = (await CloneTarget.inspect(path.join(root, 'b', 'c', 'd')))!;
    await mkdir(target.directory, { recursive: true });
    await writeFile(path.join(target.directory, 'f'), 'x');
    await target.discard();
    expect(await readdir(root)).not.toContain('b');
  });

  it('empties an existing empty folder again, and refuses a folder that is not empty or a file', async () => {
    const dir = path.join(root, 'empty');
    await mkdir(dir);
    const target = (await CloneTarget.inspect(dir))!;
    expect(target.existed).toBe(true);
    await writeFile(path.join(dir, 'f'), 'x');
    await target.discard();
    expect(await readdir(dir)).toEqual([]);
    await writeFile(path.join(dir, 'g'), 'x');
    expect(await CloneTarget.inspect(dir)).toBeUndefined();
    expect(await CloneTarget.inspect(path.join(dir, 'g'))).toBeUndefined();
  });
});
