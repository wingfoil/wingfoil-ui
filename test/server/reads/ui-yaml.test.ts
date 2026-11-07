// spec-005 §2 (amended 2026-11-05), spec-001 §4.5, AC-3, task-054 D54-2 — the direct read of
// `.wingfoil/ui.yaml`: the fixed path, no symbolic link followed at any step (`.wingfoil` itself
// included), the size bound before any read, the descriptor checked against the path (a swap
// between the checks and the read, the ABA swap of design probe P1), strict UTF-8.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, chmod, mkdir, mkdtemp, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  MAX_UI_YAML_BYTES,
  nodeUiYamlFs,
  readUiYaml,
  UI_YAML,
  type UiYamlFs,
} from '../../../server/src/reads/ui-yaml.js';

let base: string;
let outside: string;
let n = 0;

beforeAll(async () => {
  base = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-ui-yaml-')));
  outside = path.join(base, 'outside');
  await mkdir(outside);
  await writeFile(path.join(outside, 'ui.yaml'), 'version: 1\n# OUTSIDE\n');
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

/** A fresh project folder with `.wingfoil/` (unless `wingfoil` is false). */
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

describe('readUiYaml — the entry at .wingfoil/ui.yaml', () => {
  it('the path is fixed', () => {
    expect(UI_YAML).toBe('.wingfoil/ui.yaml');
    expect(MAX_UI_YAML_BYTES).toBe(65_536);
  });

  it('no .wingfoil, or no entry → absent', async () => {
    expect(await readUiYaml(await project(false))).toEqual({ kind: 'absent' });
    expect(await readUiYaml(await project())).toEqual({ kind: 'absent' });
  });

  it('a regular file → its text and the SHA-256 of its bytes; a BOM is dropped', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    expect(await readUiYaml(root)).toEqual({
      kind: 'text',
      text: 'version: 1\n',
      sha256: createHash('sha256').update('version: 1\n').digest('hex'),
    });
    const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('version: 1\n')]);
    await writeFile(file(root), bom);
    expect(await readUiYaml(root)).toMatchObject({ kind: 'text', text: 'version: 1\n' });
  });

  it('exactly 64 KiB is read; one byte more is "larger than 64 KiB", never opened', async () => {
    const root = await project();
    await writeFile(file(root), `#${'x'.repeat(MAX_UI_YAML_BYTES - 1)}`);
    expect(await readUiYaml(root)).toMatchObject({ kind: 'text' });
    await writeFile(file(root), `#${'x'.repeat(MAX_UI_YAML_BYTES)}`);
    const fs = spyFs();
    expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'larger than 64 KiB' });
    expect(fs.opened).toEqual([]);
  });

  it('a file that grows past the bound between the checks and the read → "larger than 64 KiB"', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    const fs = spyFs((f) => appendFile(f, 'x'.repeat(MAX_UI_YAML_BYTES)));
    expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'larger than 64 KiB' });
  });

  it('a symbolic link (to a file outside or inside) → "not a regular file", the target never opened', async () => {
    for (const target of [path.join(outside, 'ui.yaml'), 'memory.yaml']) {
      const root = await project();
      await writeFile(path.join(root, '.wingfoil', 'memory.yaml'), 'version: 1\n');
      await symlink(target, file(root));
      const fs = spyFs();
      expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'not a regular file' });
      expect(fs.opened).toEqual([]);
    }
  });

  it('a .wingfoil that is a symbolic link (design probe P1: O_NOFOLLOW would pass it) → "not a regular file"', async () => {
    const root = await project(false);
    await symlink(outside, path.join(root, '.wingfoil'));
    const fs = spyFs();
    expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'not a regular file' });
    expect(fs.opened).toEqual([]);
  });

  it('a .wingfoil that is a file → "not a regular file"', async () => {
    const root = await project(false);
    await writeFile(path.join(root, '.wingfoil'), 'x');
    expect(await readUiYaml(root)).toEqual({ kind: 'refused', failure: 'not a regular file' });
  });

  it('a directory or a FIFO → "not a regular file" (the FIFO without blocking)', async () => {
    const dir = await project();
    await mkdir(file(dir));
    expect(await readUiYaml(dir)).toEqual({ kind: 'refused', failure: 'not a regular file' });
    if (process.platform !== 'win32') {
      const fifo = await project();
      execFileSync('mkfifo', [file(fifo)]);
      expect(await readUiYaml(fifo)).toEqual({ kind: 'refused', failure: 'not a regular file' });
    }
  });

  it('a regular file swapped for a link between the checks and the open → "not a regular file"', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    const fs = spyFs(async (f) => {
      await rm(f);
      await symlink(path.join(outside, 'ui.yaml'), f);
    });
    expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'not a regular file' });
  });

  it('a regular file replaced by another one between the checks and the open → "not a regular file"', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    const fs = spyFs(async (f) => {
      await writeFile(`${f}.new`, 'version: 1\n# other\n');
      await rename(`${f}.new`, f);
    });
    expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'not a regular file' });
  });

  it('the ABA swap: .wingfoil replaced by a link to an outside folder for the open, then put back', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    const wf = path.join(root, '.wingfoil');
    let swapped = false;
    const fs: UiYamlFs = {
      lstat: (f) => nodeUiYamlFs.lstat(f),
      async open(f, flags) {
        await rename(wf, `${wf}.real`);
        await symlink(outside, wf);
        try {
          return await nodeUiYamlFs.open(f, flags);
        } finally {
          await rm(wf);
          await rename(`${wf}.real`, wf);
          swapped = true;
        }
      },
    };
    expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'not a regular file' });
    expect(swapped).toBe(true);
  });

  it('.wingfoil replaced by another directory after the open → "not a regular file"', async () => {
    const root = await project();
    await writeFile(file(root), 'version: 1\n');
    const wf = path.join(root, '.wingfoil');
    const fs: UiYamlFs = {
      lstat: (f) => nodeUiYamlFs.lstat(f),
      async open(f, flags) {
        const handle = await nodeUiYamlFs.open(f, flags);
        await rename(wf, `${wf}.old`);
        await mkdir(wf);
        await writeFile(path.join(wf, 'ui.yaml'), 'version: 1\n');
        return handle;
      },
    };
    expect(await readUiYaml(root, fs)).toEqual({ kind: 'refused', failure: 'not a regular file' });
  });

  it('bytes that are not UTF-8 → "not valid UTF-8"', async () => {
    const root = await project();
    await writeFile(file(root), Buffer.from([0x76, 0x3a, 0x20, 0xff, 0xfe, 0x0a]));
    expect(await readUiYaml(root)).toEqual({ kind: 'refused', failure: 'not valid UTF-8' });
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'an unreadable file → "cannot be read"',
    async () => {
      const root = await project();
      await writeFile(file(root), 'version: 1\n');
      await chmod(file(root), 0o000);
      try {
        expect(await readUiYaml(root)).toEqual({ kind: 'refused', failure: 'cannot be read' });
      } finally {
        await chmod(file(root), 0o644);
      }
    },
  );
});
