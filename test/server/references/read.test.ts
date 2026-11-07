// spec-001 §4.2 bulk reader (amended 2026-11-06, Q3-a), task-055 AC-2, AC-10, D55-5 — the index's
// read of one element file: confined to the project, checked against its `memory search` match,
// the values only (no body), a frontmatter above 64 KiB refused as `shape`.
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { MemoryMatch } from '@wingfoil-ui/contracts';
import { beforeAll, describe, expect, it } from 'vitest';
import { DirectReadError } from '../../../server/src/reads/confine.js';
import { MAX_INDEX_FRONTMATTER } from '../../../server/src/references/index.js';
import { readIndexEntry } from '../../../server/src/references/read.js';

let root: string;
let outside: string;

const match = (p: string, id = 'task-001-a'): MemoryMatch => ({
  id,
  type: 'task',
  status: 'draft',
  title: 'A',
  path: p,
  tags: [],
});
const head = '---\nid: task-001-a\ntype: task\ntitle: A\nstatus: draft\n';

beforeAll(async () => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-index-read-')));
  root = path.join(base, 'project');
  outside = path.join(base, 'outside');
  await mkdir(path.join(root, 'm'), { recursive: true });
  await mkdir(outside);
  await writeFile(path.join(root, 'm', 'a.md'), `${head}release: v0.1\nrefs: [US-1]\n---\nbody US-2\n`);
  await writeFile(path.join(outside, 'o.md'), `${head}---\n`);
  await symlink(path.join(outside, 'o.md'), path.join(root, 'm', 'out.md'));
  await writeFile(path.join(root, 'm', 'other.md'), `${head.replace('draft', 'pending')}---\n`);
  const keys = (bytes: number) => {
    let s = '';
    for (let i = 0; s.length < bytes; i += 1) s += `k${i}: v${i}\n`;
    return s;
  };
  await writeFile(path.join(root, 'm', 'big.md'), `${head}${'x: "'}${'a'.repeat(MAX_INDEX_FRONTMATTER)}"\n---\n`);
  await writeFile(path.join(root, 'm', 'keys.md'), `${head}${keys(MAX_INDEX_FRONTMATTER - head.length - 200)}---\n`);
  // Review round 1 F1: three spellings where the bound and the parse once disagreed on the
  // delimiters, each with more than 64 KiB of keys before the close the parse uses.
  const over = keys(MAX_INDEX_FRONTMATTER + 4096);
  await writeFile(path.join(root, 'm', 'nbsp-close.md'), `${head}${over}---\u00a0\nbody\n`);
  await writeFile(path.join(root, 'm', 'ls-close.md'), `${head}a: x\u2028---\n${over}---\nbody\n`);
  await writeFile(path.join(root, 'm', 'space-open.md'), `--- \n${head.slice(4)}${over}---\nbody\n`);
  await writeFile(path.join(root, 'm', 'bigbody.md'), `${head}---\n${'b'.repeat(1024 * 1024)}\n`);
  return () => rm(base, { recursive: true, force: true });
});

describe('readIndexEntry', () => {
  it('the values of the frontmatter only, not the body; the text read for the blob check', async () => {
    const r = await readIndexEntry(root, match('m/a.md'));
    expect(r.values).toEqual({ values: ['v0.1', 'US-1'], capped: false });
    expect(r.text.startsWith('---\n')).toBe(true);
  });

  it('confined: a link out of the project is `outside`; a path with .. is `outside`', async () => {
    await expect(readIndexEntry(root, match('m/out.md'))).rejects.toMatchObject({ kind: 'outside' });
    await expect(readIndexEntry(root, match('../outside/o.md'))).rejects.toMatchObject({ kind: 'outside' });
  });

  it('checked against the match: another status is `mismatch`; a missing file `missing`', async () => {
    await expect(readIndexEntry(root, match('m/other.md'))).rejects.toMatchObject({ kind: 'mismatch' });
    await expect(readIndexEntry(root, match('m/none.md'))).rejects.toBeInstanceOf(DirectReadError);
  });

  it(`AC-10: a frontmatter above ${MAX_INDEX_FRONTMATTER} bytes is \`shape\`, not parsed; a large body is fine`, async () => {
    expect(MAX_INDEX_FRONTMATTER).toBe(65_536);
    await expect(readIndexEntry(root, match('m/big.md'))).rejects.toMatchObject({ kind: 'shape' });
    await expect(readIndexEntry(root, match('m/bigbody.md'))).resolves.toMatchObject({ values: { values: [] } });
    // F1: the bound measures exactly the text the parse reads, whatever the delimiter spelling.
    for (const file of ['nbsp-close.md', 'ls-close.md', 'space-open.md']) {
      await expect(readIndexEntry(root, match(`m/${file}`)), file).rejects.toMatchObject({ kind: 'shape' });
    }
    // Just under the bound: thousands of keys, parsed.
    const r = await readIndexEntry(root, match('m/keys.md'));
    expect(r.values.values.length).toBe(200);
    expect(r.values.capped).toBe(true);
  });
});
