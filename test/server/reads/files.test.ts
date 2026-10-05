// spec-001 §4.2–§4.3, REQ-ARC-04 — element and directive files: frontmatter parsing, the
// `id`/`type`/`status` cross-check with `memory search`, and confinement of every path the CLI
// returns to the project (lexically and by realpath).
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { confinedPath, DirectReadError, nodeReadFs, type ReadFs } from '../../../server/src/reads/confine.js';
import { parseDirective, readDirective } from '../../../server/src/reads/directive.js';
import { parseElement, readElement } from '../../../server/src/reads/element.js';
import { readMemoryYaml } from '../../../server/src/reads/memory-yaml.js';

let base: string;
let root: string;
let outside: string;

const ELEMENT = [
  '---',
  'id: task-001-login-form',
  'type: task',
  'title: "Login form"',
  'status: pending   # trailing comment',
  'release: "v0.1"',
  'depends_on: []         # optional',
  '---',
  '',
  '## Description',
  '',
  'Body --- with dashes',
  '---',
  'not frontmatter',
  '',
].join('\n');
const MATCH = {
  path: 'docs/memory/task/task-001-login-form.md',
  id: 'task-001-login-form',
  title: 'Login form',
  type: 'task',
  status: 'pending',
  tags: [],
};
const DIRECTIVE = '---\nid: determinism\nname: determinism\ntype: directive\nkind: custom\ntitle: "Determinism"\n---\n\n# Determinism\n';
const ENTRY = {
  path: 'directives/custom/determinism.md',
  frontmatter: { id: 'determinism', name: 'determinism', type: 'directive', kind: 'custom', title: 'Determinism' },
  roles: ['developer'],
  global: false,
  assignment: 'developer',
};

/** A ReadFs that records every path it is asked for. */
function recording(): ReadFs & { paths: string[] } {
  const paths: string[] = [];
  return {
    paths,
    readFile: (p) => (paths.push(p), nodeReadFs.readFile(p)),
    realpath: (p) => (paths.push(p), nodeReadFs.realpath(p)),
  };
}

beforeAll(async () => {
  base = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-reads-')));
  root = path.join(base, 'project');
  outside = path.join(base, 'outside');
  await mkdir(path.join(root, 'docs/memory/task'), { recursive: true });
  await mkdir(path.join(root, '.wingfoil/directives/custom'), { recursive: true });
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(root, MATCH.path), ELEMENT);
  await writeFile(path.join(root, '.wingfoil', ENTRY.path), DIRECTIVE);
  await writeFile(path.join(outside, 'secret.md'), '---\nid: secret\ntype: task\ntitle: s\nstatus: pending\n---\nSECRET\n');
  await writeFile(path.join(outside, 'memory.yaml'), 'version: 1\ntypes: {}\n');
  await symlink(path.join(outside, 'secret.md'), path.join(root, 'docs/memory/task/escape.md'));
  await symlink(outside, path.join(root, 'docs/memory/linked'));
});

afterAll(async () => {
  await rm(base, { recursive: true, force: true });
});

describe('parseElement', () => {
  it('splits the frontmatter between the first two --- lines from the Markdown body; comments ignored', () => {
    const el = parseElement(ELEMENT, MATCH.path);
    expect(el.frontmatter).toEqual({
      id: 'task-001-login-form',
      type: 'task',
      title: 'Login form',
      status: 'pending',
      release: 'v0.1',
      depends_on: [],
    });
    expect(el.body).toBe('\n## Description\n\nBody --- with dashes\n---\nnot frontmatter\n');
  });

  it('keeps dates and versions as written (YAML 1.2 core, no timestamp type)', () => {
    const el = parseElement('---\nid: a\ntype: t\ntitle: a\nstatus: s\ndate: 2026-10-02\nversion: 0.10\n---\n', 'a.md');
    expect(el.frontmatter.date).toBe('2026-10-02');
  });

  it.each([
    ['no frontmatter', '# Title\n'],
    ['an unclosed frontmatter', '---\nid: a\ntype: t\n'],
    ['invalid YAML', '---\nid: [a\n---\n'],
    ['a missing status', '---\nid: a\ntype: t\ntitle: a\n---\n'],
    ['a status that is not a string', '---\nid: a\ntype: t\ntitle: a\nstatus: [x]\n---\n'],
    ['a frontmatter that is a list', '---\n- a\n---\n'],
  ])('refuses %s with a shape error', (_label, text) => {
    expect(() => parseElement(text, 'x.md')).toThrow(expect.objectContaining({ kind: 'shape', file: 'x.md' }));
  });
});

describe('readElement — only at the path memory search returns, cross-checked with it', () => {
  it('reads the element and its body', async () => {
    const el = await readElement(root, MATCH);
    expect(el).toMatchObject({ path: MATCH.path, frontmatter: { id: MATCH.id, status: 'pending' } });
  });

  it.each([
    ['status', { status: 'approved' }],
    ['id', { id: 'task-009-other' }],
    ['type', { type: 'bug' }],
  ])('a %s that differs from memory search is a read error for that element', async (field, patch) => {
    const error = await readElement(root, { ...MATCH, ...patch }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DirectReadError);
    expect(error).toMatchObject({ kind: 'mismatch', file: MATCH.path });
    expect((error as Error).message).toContain(field);
  });

  it.each([
    ['a parent traversal', '../outside/secret.md'],
    ['a traversal inside the path', 'docs/memory/../../../outside/secret.md'],
    ['an absolute path', path.join(base, 'outside', 'secret.md')],
    ['a symlink that escapes', 'docs/memory/task/escape.md'],
    ['a path through a linked directory', 'docs/memory/linked/secret.md'],
  ])('refuses %s without reading the target', async (_label, p) => {
    const fs = recording();
    const error = await readElement(root, { ...MATCH, path: p }, fs).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DirectReadError);
    expect(error).toMatchObject({ kind: 'outside' });
    expect(fs.paths.filter((x) => x.includes('secret') && !x.startsWith(root))).toEqual([]);
    expect(fs.paths.some((x) => x === path.join(outside, 'secret.md'))).toBe(false);
  });

  it('a file that does not exist is a read error', async () => {
    await expect(readElement(root, { ...MATCH, path: 'docs/memory/task/nope.md' })).rejects.toMatchObject({
      kind: 'missing',
    });
  });
});

describe('directives — only at .wingfoil/<path> of directives list', () => {
  it('parses the frontmatter and the body', async () => {
    expect(parseDirective(DIRECTIVE, ENTRY.path).frontmatter).toEqual(ENTRY.frontmatter);
    const d = await readDirective(root, ENTRY);
    expect(d).toEqual({ path: ENTRY.path, frontmatter: ENTRY.frontmatter, body: '\n# Determinism\n' });
  });

  it('a file whose id differs from the list entry is a read error', async () => {
    await expect(
      readDirective(root, { ...ENTRY, frontmatter: { ...ENTRY.frontmatter, id: 'other' } }),
    ).rejects.toMatchObject({ kind: 'mismatch' });
  });

  it.each([
    ['a path leaving .wingfoil', '../docs/memory/task/task-001-login-form.md'],
    ['a parent traversal', '../../outside/secret.md'],
    ['an absolute path', path.join(base, 'outside', 'secret.md')],
  ])('refuses %s', async (_label, p) => {
    await expect(readDirective(root, { ...ENTRY, path: p })).rejects.toMatchObject({ kind: 'outside' });
  });

  it('refuses a directive without title', () => {
    expect(() => parseDirective('---\nid: a\nname: a\ntype: directive\nkind: custom\n---\n', 'a.md')).toThrow(
      DirectReadError,
    );
  });
});

describe('memory.yaml and confinedPath', () => {
  it('reads .wingfoil/memory.yaml, and refuses one that is a link out of the project', async () => {
    const other = path.join(base, 'p2');
    await mkdir(path.join(other, '.wingfoil'), { recursive: true });
    await writeFile(
      path.join(other, '.wingfoil', 'memory.yaml'),
      'version: 1\ntypes:\n  a:\n    path: a/{id}.md\n    id_pattern: "a-{n}"\n',
    );
    expect(Object.keys((await readMemoryYaml(other)).types)).toEqual(['a']);
    const linked = path.join(base, 'p3');
    await mkdir(path.join(linked, '.wingfoil'), { recursive: true });
    await symlink(path.join(outside, 'memory.yaml'), path.join(linked, '.wingfoil', 'memory.yaml'));
    await expect(readMemoryYaml(linked)).rejects.toMatchObject({ kind: 'outside' });
    await expect(readMemoryYaml(path.join(base, 'none'))).rejects.toMatchObject({ kind: 'missing' });
  });

  it('confinedPath resolves inside the base only', async () => {
    expect(await confinedPath(root, root, MATCH.path)).toBe(path.join(root, MATCH.path));
    await expect(confinedPath(root, root, '')).rejects.toMatchObject({ kind: 'outside' });
    await expect(confinedPath(root, root, 'a\0b')).rejects.toMatchObject({ kind: 'outside' });
  });
});
