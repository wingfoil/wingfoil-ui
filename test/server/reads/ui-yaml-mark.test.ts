// task-068 AC-2 (D68-5, D68-8; spec-001 §4.4 amended 2026-11-06) — the mark of
// `.wingfoil/ui.yaml` the state check combines into the state key whatever git's status says of
// the file: built on the guarded steps of the read (no symbolic link followed, `.wingfoil`
// included), a file that is not regular or above 64 KiB marked by its `lstat` and never opened, a
// regular file by the SHA-256 of its bytes, a swap seen by the descriptor checks marked as such.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  nodeUiYamlFs,
  readMarkedUiYaml,
  readUiYaml,
  UI_YAML,
  uiYamlMark,
  type UiYamlFs,
} from '../../../server/src/reads/ui-yaml.js';

let base: string;
let outside: string;
let n = 0;

beforeAll(async () => {
  base = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-ui-mark-')));
  outside = path.join(base, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'ui.yaml'), 'version: 1\n# OUTSIDE\n');
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

async function project(wingfoil = true): Promise<string> {
  n += 1;
  const root = path.join(base, `p${n}`);
  await mkdir(wingfoil ? path.join(root, '.wingfoil') : root, { recursive: true });
  return root;
}

const file = (root: string): string => path.join(root, UI_YAML);

/** {@link nodeUiYamlFs} recording the files opened, with an optional hook run before `open`. */
function spyFs(beforeOpen?: (file: string) => Promise<void>): UiYamlFs & { opened: string[] } {
  const opened: string[] = [];
  return {
    opened,
    lstat: (f) => nodeUiYamlFs.lstat(f),
    async open(f, flags) {
      await beforeOpen?.(f);
      opened.push(f);
      return nodeUiYamlFs.open(f, flags);
    },
  };
}

describe('uiYamlMark — the mark of .wingfoil/ui.yaml in the state key', () => {
  it('no .wingfoil, or no entry → absent', async () => {
    expect(await uiYamlMark(await project(false))).toBe('absent');
    expect(await uiYamlMark(await project())).toBe('absent');
  });

  it('a regular file → the SHA-256 of its bytes, new at each edit, also for bytes that are not UTF-8', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    const first = await uiYamlMark(root);
    expect(first).toBe(`sha:${createHash('sha256').update('version: 1\n').digest('hex')}`);
    expect(await uiYamlMark(root)).toBe(first);
    await appendFile(file(root), '# edited\n');
    const second = await uiYamlMark(root);
    expect(second).not.toBe(first);
    const bytes = Buffer.from([0x76, 0xff, 0xfe, 0x0a]);
    await writeFile(file(root), bytes);
    expect(await uiYamlMark(root)).toBe(`sha:${createHash('sha256').update(bytes).digest('hex')}`);
  });

  it('above 64 KiB → marked by its lstat, never opened; the mark moves with the size', async () => {
    const root = await project();
    await writeFile(file(root), 'x'.repeat(65_537));
    const fs = spyFs();
    const one = await uiYamlMark(root, fs);
    expect(one).toMatch(/^large:/);
    await writeFile(file(root), 'y'.repeat(70_000));
    const two = await uiYamlMark(root, fs);
    expect(two).toMatch(/^large:/);
    expect(two).not.toBe(one);
    expect(fs.opened).toEqual([]);
  });

  it('a FIFO and a directory → marked by their lstat, never opened', async () => {
    const root = await project();
    execFileSync('mkfifo', [file(root)]);
    const fs = spyFs();
    expect(await uiYamlMark(root, fs)).toMatch(/^other:/);
    await rm(file(root));
    await mkdir(file(root));
    expect(await uiYamlMark(root, fs)).toMatch(/^other:/);
    expect(fs.opened).toEqual([]);
  });

  it('ui.yaml a symbolic link → its own lstat; an edit of the target leaves the mark unchanged', async () => {
    const root = await project();
    const target = path.join(outside, `target-${n}.yaml`);
    await writeFile(target, 'version: 1\n');
    await symlink(target, file(root));
    const fs = spyFs();
    const before = await uiYamlMark(root, fs);
    expect(before).toMatch(/^link:/);
    await writeFile(target, 'version: 1\n# the target edited\n');
    expect(await uiYamlMark(root, fs)).toBe(before);
    expect(fs.opened).toEqual([]);
  });

  it('.wingfoil a symbolic link to an outside folder → its own lstat; nothing behind it is opened', async () => {
    const root = await project(false);
    const folder = path.join(outside, `wf-${n}`);
    await mkdir(folder);
    await writeFile(path.join(folder, 'ui.yaml'), 'version: 1\n');
    await symlink(folder, path.join(root, '.wingfoil'));
    const fs = spyFs();
    const before = await uiYamlMark(root, fs);
    expect(before).toMatch(/^wingfoil:/);
    await writeFile(path.join(folder, 'ui.yaml'), 'version: 1\n# the outside file edited\n');
    expect(await uiYamlMark(root, fs)).toBe(before);
    expect(fs.opened).toEqual([]);
  });

  it('a file replaced between the lstat and the open → marked as swapped; the next mark is the new content', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    let swap = true;
    const fs = spyFs(async (f) => {
      if (!swap) return;
      swap = false;
      await writeFile(`${f}.new`, 'version: 1\n# swapped\n');
      await rename(`${f}.new`, f);
    });
    expect(await uiYamlMark(root, fs)).toMatch(/^swapped:/);
    expect(await uiYamlMark(root, fs)).toBe(
      `sha:${createHash('sha256').update('version: 1\n# swapped\n').digest('hex')}`,
    );
  });
});

describe('readMarkedUiYaml (bug-034, task-075 D75-3)', () => {
  it("the read's mark equals the check's for each kind; its entry equals readUiYaml's", async () => {
    const roots = [await project(false), await project()];
    const text = await project();
    await writeFile(file(text), 'version: 1\n');
    const binary = await project();
    await writeFile(file(binary), Buffer.from([0xff, 0xfe, 0x00]));
    const large = await project();
    await writeFile(file(large), 'x'.repeat(64 * 1024 + 1));
    const dir = await project();
    await mkdir(file(dir));
    for (const root of [...roots, text, binary, large, dir]) {
      const { entry, mark } = await readMarkedUiYaml(root);
      expect(mark, root).toBe(await uiYamlMark(root));
      expect(entry, root).toEqual(await readUiYaml(root));
    }
    expect((await readMarkedUiYaml(text)).mark).toBe(
      `sha:${createHash('sha256').update('version: 1\n').digest('hex')}`,
    );
  });
});
