// bug-003 (absorbed into task-012, decided by the user 2026-10-06) — a confined read refers to the
// object that was checked and is bounded: the file swapped after the checks for a FIFO is refused
// without blocking, a symlink to /dev/zero is refused (never followed), a non-regular file is never
// read, a regular file is read at most MAX_DIRECT_READ_BYTES + 1 bytes from its descriptor.
import { execFileSync } from 'node:child_process';
import { mkdtemp, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DirectReadError,
  MAX_DIRECT_READ_BYTES,
  nodeReadFs,
  NotRegularFileError,
  readConfined,
  type ReadFs,
} from '../../../server/src/reads/confine.js';
import { documentationScope, nodeTreeFs, readWorkingTreeFile } from '../../../server/src/reads/working-tree.js';

const POSIX = process.platform !== 'win32';
let root: string;
let n = 0;

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-swap-')));
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A read port that swaps the file for `swap()` after the checks, just before the read. */
function swapping(swap: (file: string) => Promise<void>): ReadFs {
  return {
    ...nodeReadFs,
    readFile: async (file) => {
      await swap(file);
      return nodeReadFs.readFile(file);
    },
  };
}

const toFifo = async (file: string) => {
  await unlink(file);
  execFileSync('mkfifo', [file]);
};
const toDevZero = async (file: string) => {
  await unlink(file);
  await symlink('/dev/zero', file);
};

async function doc(content = '# doc\n'): Promise<string> {
  n += 1;
  const rel = `doc-${n}.md`;
  await writeFile(path.join(root, rel), content);
  return rel;
}

/** Fails the test instead of hanging when the read blocks. */
function withinSeconds<T>(p: Promise<T>, seconds = 5): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_r, reject) => setTimeout(() => reject(new Error(`blocked over ${seconds} s`)), seconds * 1000)),
  ]);
}

describe.skipIf(!POSIX)('bug-003 — the read port', () => {
  it('refuses a FIFO without blocking, and a character device', async () => {
    const fifo = path.join(root, 'pipe');
    execFileSync('mkfifo', [fifo]);
    await expect(withinSeconds(nodeReadFs.readFile(fifo))).rejects.toBeInstanceOf(NotRegularFileError);
    await expect(withinSeconds(nodeReadFs.readFile('/dev/zero'))).rejects.toBeInstanceOf(NotRegularFileError);
  });

  it('never follows a symlink as the last component', async () => {
    const link = path.join(root, 'zero-link');
    await symlink('/dev/zero', link);
    await expect(withinSeconds(nodeReadFs.readFile(link))).rejects.toBeInstanceOf(NotRegularFileError);
  });

  it('reads a regular file whole, and at most MAX + 1 bytes of a larger one', async () => {
    const small = path.join(root, await doc('# small\n'));
    expect(await nodeReadFs.readFile(small)).toBe('# small\n');
    const big = path.join(root, 'big.md');
    await writeFile(big, Buffer.alloc(MAX_DIRECT_READ_BYTES + 4096, 0x61));
    expect((await nodeReadFs.readFile(big)).length).toBe(MAX_DIRECT_READ_BYTES + 1);
  });
});

describe.skipIf(!POSIX)('bug-003 — swapped after the checks', () => {
  it.each([
    ['a FIFO', toFifo],
    ['a symlink to /dev/zero', toDevZero],
  ])('readConfined refuses %s without blocking', async (_name, swap) => {
    const rel = await doc();
    const refusal = await withinSeconds(readConfined(root, root, rel, swapping(swap)).catch((e: unknown) => e));
    expect(refusal).toBeInstanceOf(DirectReadError);
    expect((refusal as DirectReadError).cause).toBeInstanceOf(NotRegularFileError);
  });

  it.each([
    ['a FIFO', toFifo],
    ['a symlink to /dev/zero', toDevZero],
  ])('/files/content refuses %s as not-allowed without blocking', async (_name, swap) => {
    const rel = await doc();
    const scope = documentationScope({ docs: ['.'], memoryDirectories: [] });
    const fs = { ...nodeTreeFs, readFile: swapping(swap).readFile };
    const refusal = await withinSeconds(readWorkingTreeFile(root, rel, scope, fs).catch((e: unknown) => e));
    expect(refusal).toMatchObject({ name: 'WorkingTreeError', kind: 'not-allowed' });
  });

  it('reads a regular file that was not swapped', async () => {
    const rel = await doc('# unchanged\n');
    expect(await readConfined(root, root, rel)).toBe('# unchanged\n');
  });
});
