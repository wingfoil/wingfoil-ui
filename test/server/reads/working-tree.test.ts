// REQ-SEC-06 (TT-SEC-06, R-09.3 API half) — confinement of the documentation index, the tree and the
// file content to the repository: every traversal case (`..`, encoded `..` once decoded by the
// query parser, absolute paths, NUL, escaping symlinks to a file or a folder) is refused as
// `outside` with 0 bytes of the target read (a recording read port); REQ-ARC-04 — the v0.1 content
// route reads only documentation files, never a Memory, `.wingfoil/` or `.git` file.
import { link, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  inDocumentationScope,
  documentationIndex,
  documentationScope,
  listDirectory,
  nodeTreeFs,
  readWorkingTreeFile,
  WorkingTreeError,
  type TreeFs,
} from '../../../server/src/reads/working-tree.js';

let base: string;
let root: string;
let outside: string;

/** The local port, recording every path whose content is read. */
function recording(): TreeFs & { read: string[] } {
  const read: string[] = [];
  return {
    read,
    readFile: (f) => {
      read.push(f);
      return nodeTreeFs.readFile(f);
    },
    realpath: (f) => nodeTreeFs.realpath(f),
    size: (f) => nodeTreeFs.size(f),
    kind: (f) => nodeTreeFs.kind(f),
    list: (d) => nodeTreeFs.list(d),
    links: (f) => nodeTreeFs.links(f),
  };
}

beforeAll(async () => {
  base = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-tree-')));
  root = path.join(base, 'project');
  outside = path.join(base, 'outside');
  await mkdir(path.join(outside, 'dir'), { recursive: true });
  await writeFile(path.join(outside, 'secret.md'), 'SECRET-OUTSIDE\n');
  await writeFile(path.join(outside, 'dir', 'inner.md'), 'SECRET-INNER\n');
  for (const d of [
    'docs/01_vision',
    'docs/04_memory/task',
    'docs/05_plans',
    '.wingfoil',
    '.git',
    'src',
    'docs/node_modules/x',
  ]) {
    await mkdir(path.join(root, d), { recursive: true });
  }
  await writeFile(path.join(root, 'docs/01_vision/00_index.md'), '# Index\n[v](02_product-vision.md)\n');
  await writeFile(path.join(root, 'docs/01_vision/02_product-vision.md'), '# Vision\n');
  await writeFile(path.join(root, 'docs/01_vision/diagram.png'), 'PNG');
  await writeFile(path.join(root, 'docs/README.markdown'), '# Readme\n');
  await writeFile(path.join(root, 'docs/04_memory/task/task-001.md'), '---\nid: task-001\n---\n');
  await writeFile(path.join(root, 'docs/05_plans/plan.md'), '# Plan\n');
  await writeFile(path.join(root, 'docs/node_modules/x/dep.md'), '# dep\n');
  await writeFile(path.join(root, '.wingfoil/dna.yaml'), 'version: 1\n');
  await writeFile(path.join(root, '.git/config'), '[core]\n');
  await writeFile(path.join(root, 'src/code.md'), '# not a doc\n');
  await symlink(path.join(outside, 'secret.md'), path.join(root, 'docs/link.md'));
  await symlink(path.join(outside, 'dir'), path.join(root, 'docs/linkdir'));
  await symlink(path.join(root, 'docs/01_vision/02_product-vision.md'), path.join(root, 'docs/inside-link.md'));
  // Review round 1 (finding 3, 8): files of the docs folder that are not documents, a hard link,
  // a governance folder named by paths.governance.
  await writeFile(path.join(root, 'docs/.env'), 'TOKEN=secret\n');
  await link(path.join(outside, 'secret.md'), path.join(root, 'docs/hard.md'));
  await mkdir(path.join(root, 'docs/gov'), { recursive: true });
  await writeFile(path.join(root, 'docs/gov/rules.md'), '# governance\n');
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

const scope = () =>
  documentationScope({
    docs: ['docs/'],
    memoryDirectories: ['docs/04_memory', 'docs/05_plans'],
    governance: ['docs/gov/'],
  });

describe('documentationIndex (R-08.1)', () => {
  it('lists the Markdown files under paths.docs without the Memory and plan files, symlinks not followed', async () => {
    const fs = recording();
    const docs = await documentationIndex(root, scope(), fs);
    expect(docs.map((d) => d.path)).toEqual([
      'docs/01_vision/00_index.md',
      'docs/01_vision/02_product-vision.md',
      'docs/README.markdown',
    ]);
    expect(fs.read).toEqual([]);
  });

  it('is empty without paths.docs, and ignores a docs root leaving the repository', async () => {
    expect(await documentationIndex(root, documentationScope({ docs: [], memoryDirectories: [] }))).toEqual([]);
    const escaping = documentationScope({ docs: ['../outside/', '/etc/'], memoryDirectories: [] });
    expect(await documentationIndex(root, escaping)).toEqual([]);
  });
});

const TRAVERSALS = [
  '../outside/secret.md',
  'docs/../../outside/secret.md',
  '..%2Foutside%2Fsecret.md',
  decodeURIComponent('%2e%2e/outside/secret.md'),
  decodeURIComponent('docs%2F%2E%2E%2F%2E%2E%2Foutside%2Fsecret.md'),
  '/etc/hosts',
  'C:\\Windows\\win.ini',
  'docs/link.md',
  'docs/linkdir/inner.md',
  'docs/a\0.md',
  '',
  '../../../etc/hosts',
];

describe('readWorkingTreeFile (REQ-SEC-06)', () => {
  it('reads a documentation file, also through a symlink that stays inside', async () => {
    expect(await readWorkingTreeFile(root, 'docs/01_vision/00_index.md', scope())).toEqual({
      path: 'docs/01_vision/00_index.md',
      size: Buffer.byteLength('# Index\n[v](02_product-vision.md)\n'),
      content: '# Index\n[v](02_product-vision.md)\n',
    });
    expect((await readWorkingTreeFile(root, 'docs/inside-link.md', scope())).content).toBe('# Vision\n');
  });

  it.each(TRAVERSALS)('refuses %j as outside the repository, reading 0 bytes of the target', async (rel) => {
    const fs = recording();
    const refusal = await readWorkingTreeFile(root, rel, scope(), fs).catch((e: unknown) => e);
    expect(refusal).toBeInstanceOf(WorkingTreeError);
    // `..%2F…` is a file name with `%` in it: missing, never decoded twice.
    expect((refusal as WorkingTreeError).kind).toBe(rel.startsWith('..%2F') ? 'missing' : 'outside');
    expect(fs.read).toEqual([]);
  });

  it.each([
    ['docs/04_memory/task/task-001.md', 'not-allowed'],
    ['docs/05_plans/plan.md', 'not-allowed'],
    ['.wingfoil/dna.yaml', 'not-allowed'],
    ['.git/config', 'not-allowed'],
    ['src/code.md', 'not-allowed'],
    ['docs/node_modules/x/dep.md', 'not-allowed'],
    ['docs/missing.md', 'missing'],
    ['docs/01_vision', 'not-allowed'],
    ['docs/01_vision/missing.md', 'missing'],
  ] as const)('refuses %s (%s) without reading it', async (rel, kind) => {
    const fs = recording();
    const refusal = (await readWorkingTreeFile(root, rel, scope(), fs).catch((e: unknown) => e)) as WorkingTreeError;
    expect(refusal.kind).toBe(kind);
    expect(fs.read).toEqual([]);
  });
});

describe('the v0.1 scope (review round 1, findings 3, 8)', () => {
  it.each([
    'docs/.env',
    'docs/01_vision/diagram.png',
    'docs/01_vision/00_index.md/',
    'docs/hard.md',
    'docs/gov/rules.md',
  ])('refuses %j as not-allowed without reading it', async (rel) => {
    const fs = recording();
    const refusal = (await readWorkingTreeFile(root, rel, scope(), fs).catch((e: unknown) => e)) as WorkingTreeError;
    expect(refusal).toBeInstanceOf(WorkingTreeError);
    expect(refusal.kind).toBe('not-allowed');
    expect(fs.read).toEqual([]);
  });

  it('serves only documents with paths.docs ["."], and compares folders in NFC', async () => {
    const whole = documentationScope({
      docs: ['.'],
      memoryDirectories: ['docs/caf\u00e9'],
      governance: ['.wingfoil/'],
    });
    expect(inDocumentationScope(whole, 'package.json')).toBe(false);
    expect(inDocumentationScope(whole, 'docs/01_vision/00_index.md')).toBe(true);
    expect(inDocumentationScope(whole, 'docs/cafe\u0301/x.md')).toBe(false);
    expect(inDocumentationScope(whole, '.wingfoil/x.md')).toBe(false);
  });

  it('leaves the governance folders out of the index', async () => {
    expect((await documentationIndex(root, scope())).map((d) => d.path)).not.toContain('docs/gov/rules.md');
  });
});

describe('listDirectory (REQ-SEC-06)', () => {
  it('lists one level of a documentation folder: its folders and documents, by name and kind', async () => {
    const docs = await listDirectory(root, 'docs', scope());
    expect(docs.path).toBe('docs');
    expect(docs.entries.map((e) => [e.name, e.kind])).toEqual([
      ['01_vision', 'directory'],
      ['README.markdown', 'file'],
      ['hard.md', 'file'],
      ['inside-link.md', 'symlink'],
      ['link.md', 'symlink'],
    ]);
    expect((await listDirectory(root, 'docs/01_vision', scope())).entries.map((e) => e.path)).toEqual([
      'docs/01_vision/00_index.md',
      'docs/01_vision/02_product-vision.md',
    ]);
  });

  it.each([
    ['..', 'outside'],
    ['../outside', 'outside'],
    ['docs/linkdir', 'outside'],
    ['/etc', 'outside'],
    ['docs/../..', 'outside'],
    ['.git', 'not-allowed'],
    ['', 'not-allowed'],
    ['src', 'not-allowed'],
    ['.wingfoil', 'not-allowed'],
    ['docs/04_memory', 'not-allowed'],
    ['docs/gov', 'not-allowed'],
    ['docs/node_modules', 'not-allowed'],
    ['docs/01_vision/00_index.md', 'missing'],
  ] as const)('refuses %j (%s)', async (rel, kind) => {
    const refusal = (await listDirectory(root, rel, scope()).catch((e: unknown) => e)) as WorkingTreeError;
    expect(refusal).toBeInstanceOf(WorkingTreeError);
    expect(refusal.kind).toBe(kind);
  });
});
