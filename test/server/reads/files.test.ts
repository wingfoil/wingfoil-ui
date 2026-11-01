// spec-001 §4.2–§4.3, REQ-ARC-04 — element and directive files: frontmatter parsing, the
// `id`/`type`/`status` cross-check with `memory search`, and confinement of every path the CLI
// returns to the project (lexically and by realpath).
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  confinedPath,
  DirectReadError,
  MAX_DIRECT_READ_BYTES,
  nodeReadFs,
  type ReadFs,
} from '../../../server/src/reads/confine.js';
import { parseDirective, readDirective } from '../../../server/src/reads/directive.js';
import { parseElement, readElement } from '../../../server/src/reads/element.js';
import { readMemoryYaml } from '../../../server/src/reads/memory-yaml.js';
import { directiveInForce, directivesInForce, ProjectReads } from '../../../server/src/reads/project-reads.js';
import type { DirectivesList } from '@wingfoil-ui/contracts';
import { WingfoilCli } from '../../../server/src/cli/adapter.js';
import { REPO_ROOT } from '../../harness/cli.js';
import { FakeProcessRunner } from '../process/fake-runner.js';

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
const DIRECTIVE =
  '---\nid: determinism\nname: determinism\ntype: directive\nkind: custom\ntitle: "Determinism"\n---\n\n# Determinism\n';
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
    size: (p) => (paths.push(p), nodeReadFs.size(p)),
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
  await writeFile(
    path.join(outside, 'secret.md'),
    '---\nid: secret\ntype: task\ntitle: s\nstatus: pending\n---\nSECRET\n',
  );
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
    ['an absolute path', '<base>/outside/secret.md'],
    ['a symlink that escapes', 'docs/memory/task/escape.md'],
    ['a path through a linked directory', 'docs/memory/linked/secret.md'],
  ])('refuses %s without reading the target', async (_label, rel) => {
    const p = rel.replace('<base>', base);
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
    ['an absolute path', '<base>/outside/secret.md'],
  ])('refuses %s', async (_label, rel) => {
    const p = rel.replace('<base>', base);
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
    await expect(confinedPath(root, root, 'C:\\Windows\\win.ini')).rejects.toMatchObject({ kind: 'outside' });
    const none = path.join(base, 'none');
    await expect(confinedPath(none, none, 'a.md')).rejects.toMatchObject({ kind: 'missing' });
    // A base that is not inside the project root.
    await expect(confinedPath(root, outside, 'secret.md')).rejects.toMatchObject({ kind: 'outside' });
  });
});

describe('review fixes: CRLF, linked .wingfoil, size cap, names starting with ..', () => {
  it('reads a CRLF element: the frontmatter values carry no \\r, the body keeps its text', () => {
    const el = parseElement(ELEMENT.replace(/\n/g, '\r\n'), MATCH.path);
    expect(el.frontmatter.status).toBe('pending');
    expect(el.frontmatter.title).toBe('Login form');
    expect(el.body).toBe('\n## Description\n\nBody --- with dashes\n---\nnot frontmatter\n');
  });

  it('a .wingfoil folder linked out of the project is outside (memory.yaml and directives)', async () => {
    const p = path.join(base, 'linked-wingfoil');
    const target = path.join(base, 'elsewhere', '.wingfoil');
    await mkdir(path.join(target, 'directives/custom'), { recursive: true });
    await writeFile(path.join(target, 'memory.yaml'), 'version: 1\ntypes:\n  a:\n    path: a/{id}.md\n');
    await writeFile(path.join(target, ENTRY.path), DIRECTIVE);
    await mkdir(p, { recursive: true });
    await symlink(target, path.join(p, '.wingfoil'));
    const fs = recording();
    await expect(readMemoryYaml(p, fs)).rejects.toMatchObject({ kind: 'outside' });
    await expect(readDirective(p, ENTRY, fs)).rejects.toMatchObject({ kind: 'outside' });
    expect(fs.paths.some((x) => x.startsWith(target))).toBe(false);
  });

  it(`a file over ${MAX_DIRECT_READ_BYTES} bytes is a shape error "too large", not read`, async () => {
    const big = 'docs/memory/task/big.md';
    await writeFile(path.join(root, big), Buffer.alloc(MAX_DIRECT_READ_BYTES + 1, 'a'));
    const fs = recording();
    const reads: string[] = [];
    const error = await readElement(
      root,
      { ...MATCH, path: big },
      {
        ...fs,
        readFile: (p) => (reads.push(p), fs.readFile(p)),
      },
    ).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'shape', file: big });
    expect((error as Error).message).toBe(`${big}: too large (over ${MAX_DIRECT_READ_BYTES} bytes)`);
    expect(reads).toEqual([]);
  });

  it('a folder whose name starts with ".." is inside the project', async () => {
    await mkdir(path.join(root, 'docs/..notes'), { recursive: true });
    await writeFile(path.join(root, 'docs/..notes/task-001-login-form.md'), ELEMENT);
    const el = await readElement(root, { ...MATCH, path: 'docs/..notes/task-001-login-form.md' });
    expect(el.frontmatter.id).toBe(MATCH.id);
    expect(await confinedPath(root, root, '..notes-at-root.md').catch((e: unknown) => e)).toMatchObject({
      kind: 'missing',
    });
  });

  it('a file swapped for a link out of the project between resolution and read is refused', async () => {
    const swapped = 'docs/memory/task/swapped.md';
    await writeFile(path.join(root, swapped), ELEMENT);
    const fs: ReadFs = {
      ...nodeReadFs,
      readFile: async (p) => {
        const text = await nodeReadFs.readFile(p);
        await rm(path.join(root, swapped));
        await symlink(path.join(outside, 'secret.md'), path.join(root, swapped));
        return text;
      },
    };
    await expect(readElement(root, { ...MATCH, path: swapped }, fs)).rejects.toMatchObject({ kind: 'outside' });
  });
});

describe('ProjectReads lookups by id (fake CLI answers captured from 0.2.2)', () => {
  const SAMPLES = path.join(REPO_ROOT, 'test/contracts/samples/wingfoil-0.2.2/kanban');
  const sampleText = (f: string) => readFileSync(path.join(SAMPLES, f), 'utf8');
  function readsAnswering(dir: string, answer: (args: readonly string[]) => string) {
    const runner = new FakeProcessRunner().answer((request) => ({ stdout: answer(request.args) }));
    const cli = new WingfoilCli({
      cli: { source: 'project', projectRoot: dir, file: process.execPath, prefixArgs: ['/x/cli.js'] },
      runner,
    });
    return { reads: new ProjectReads({ root: dir, cli }), runner };
  }

  it('a directive id defined by a built-in and a custom file: the custom one, in force, is read', async () => {
    const dir = path.join(base, 'shadow');
    const builtIn = path.join(SAMPLES, 'files/directives/built-in/testing.md');
    await mkdir(path.join(dir, '.wingfoil/directives/built-in'), { recursive: true });
    await mkdir(path.join(dir, '.wingfoil/directives/custom'), { recursive: true });
    await cp(builtIn, path.join(dir, '.wingfoil/directives/built-in/testing.md'));
    await writeFile(
      path.join(dir, '.wingfoil/directives/custom/testing.md'),
      (await readFile(builtIn, 'utf8')).replace('# Directive — Testing', '# Our testing rules'),
    );
    const listed = sampleText('directives-list-shadowed.json');
    expect(JSON.parse(listed).warnings).toEqual([
      "directive 'testing' defined in directives/built-in/testing.md, directives/custom/testing.md; using directives/custom/testing.md",
    ]);
    const { reads } = readsAnswering(dir, () => listed);
    const d = await reads.directive('testing');
    expect(d?.entry.path).toBe('directives/custom/testing.md');
    expect(d?.content.body).toContain('# Our testing rules');

    // The path named by the warning wins over the list order.
    const reversed = JSON.parse(listed) as { entries: unknown[] };
    reversed.entries.reverse();
    const r = readsAnswering(dir, () => JSON.stringify(reversed)).reads;
    expect((await r.directive('testing'))?.entry.path).toBe('directives/custom/testing.md');
  });

  it('an element not in the default search is looked up in the archived searches, lazily', async () => {
    const dir = path.join(base, 'archived');
    await mkdir(path.join(dir, 'docs/memory/bug'), { recursive: true });
    const archived = JSON.stringify({
      query: '',
      matches: [{ ...MATCH, path: 'docs/memory/bug/b.md', id: 'bug-001-b', type: 'bug', status: 'deprecated' }],
    });
    await writeFile(
      path.join(dir, 'docs/memory/bug/b.md'),
      '---\nid: bug-001-b\ntype: bug\ntitle: B\nstatus: deprecated\n---\n',
    );
    const search = sampleText('memory-search.json');
    const { reads, runner } = readsAnswering(dir, (args) => (args.includes('deprecated') ? archived : search));
    expect((await reads.element('bug-001-b'))?.content.frontmatter.status).toBe('deprecated');
    expect(runner.requests.map((r) => r.args.slice(3).join(' '))).toEqual([
      'memory search',
      'memory search --status deprecated',
    ]);
    runner.requests.length = 0;
    await reads.element('task-001-login-form').catch(() => undefined);
    expect(runner.requests).toHaveLength(1);
  });
});

describe('directivesInForce — one entry per directive id (bug-025, task-047 D47-1, D47-2)', () => {
  const sample = (version: string): DirectivesList =>
    JSON.parse(
      readFileSync(
        path.join(REPO_ROOT, `test/contracts/samples/wingfoil-${version}/kanban/directives-list-shadowed.json`),
        'utf8',
      ),
    ) as DirectivesList;
  const ids = (list: DirectivesList) => list.entries.map((e) => `${e.frontmatter.id} ${e.path}`);

  it.each(['0.2.2', '0.3.1'])('keeps the custom file in force and drops the shadowed one (WingFoil %s)', (version) => {
    const list = sample(version);
    const shadowed = 'testing directives/built-in/testing.md';
    expect(ids(list)).toContain(shadowed);
    const inForce = directivesInForce(list);
    // The CLI's order, the shadowed entry dropped, nothing moved.
    expect(ids({ ...list, entries: inForce })).toEqual(ids(list).filter((e) => e !== shadowed));
    expect(inForce.filter((e) => e.frontmatter.id === 'testing').map((e) => e.path)).toEqual([
      'directives/custom/testing.md',
    ]);
    // The single read agrees with the list for every id.
    for (const e of inForce) expect(directiveInForce(list, e.frontmatter.id)).toBe(e);
  });

  it('answers a list without duplicates as it is', () => {
    const list = sample('0.3.1');
    const plain = { entries: list.entries.filter((e) => e.path !== 'directives/built-in/testing.md'), warnings: [] };
    expect(directivesInForce(plain)).toEqual(plain.entries);
  });

  it('keeps the file the warning names, at its place, even when it is the built-in', () => {
    const list = sample('0.3.1');
    const warnings = [
      "directive 'testing' defined in directives/built-in/testing.md, directives/custom/testing.md; using directives/built-in/testing.md",
    ];
    const inForce = directivesInForce({ ...list, warnings });
    expect(ids({ ...list, entries: inForce })).toEqual(
      ids(list).filter((e) => e !== 'testing directives/custom/testing.md'),
    );
  });

  /** A `testing` entry of the 0.3.1 sample at `path`. */
  const testingAt = (list: DirectivesList, path: string) => ({
    ...list.entries.find((e) => e.path === 'directives/custom/testing.md')!,
    path,
  });

  it("falls back to WingFoil's precedence when the warning is cut: the first custom file listed", () => {
    // `directives list` lists the files by path; WingFoil's rule (`compareDirectivePrecedence`): a
    // `custom/` file first, then the smallest path. Past the cap no warning names the file in force.
    const list = sample('0.3.1');
    const cut = directivesInForce({ ...list, warnings: ['… 1 more warning'] });
    expect(cut.filter((e) => e.frontmatter.id === 'testing').map((e) => e.path)).toEqual([
      'directives/custom/testing.md',
    ]);
    const twoCustom = {
      entries: [...list.entries, testingAt(list, 'directives/custom/zz-testing.md')],
      warnings: [],
    };
    expect(
      directivesInForce(twoCustom)
        .filter((e) => e.frontmatter.id === 'testing')
        .map((e) => e.path),
    ).toEqual(['directives/custom/testing.md']);
    // No custom file: the first listed.
    const builtIns = {
      entries: [testingAt(list, 'directives/built-in/a-testing.md'), testingAt(list, 'directives/built-in/testing.md')],
      warnings: [],
    };
    expect(directivesInForce(builtIns).map((e) => e.path)).toEqual(['directives/built-in/a-testing.md']);
  });

  it('keeps the file the warning names when two custom files declare the id', () => {
    const list = sample('0.3.1');
    const entries = [...list.entries, testingAt(list, 'directives/custom/zz-testing.md')];
    const warnings = [
      "directive 'testing' defined in directives/built-in/testing.md, directives/custom/testing.md, directives/custom/zz-testing.md; using directives/custom/zz-testing.md",
    ];
    expect(
      directivesInForce({ entries, warnings })
        .filter((e) => e.frontmatter.id === 'testing')
        .map((e) => e.path),
    ).toEqual(['directives/custom/zz-testing.md']);
  });

  it('without a warning, keeps the smallest path, not the first listed (WingFoil walks folder by folder)', () => {
    // 0.3.1 lists `custom/team/x.md` before `custom/team.md` (names sorted per folder while walking),
    // but WingFoil's winner is the smallest full path (`compareDirectivePrecedence`): `team.md`.
    const list = sample('0.3.1');
    const entries = [
      testingAt(list, 'directives/built-in/testing.md'),
      testingAt(list, 'directives/custom/team/x.md'),
      testingAt(list, 'directives/custom/team.md'),
    ];
    expect(directivesInForce({ entries, warnings: ['… 1 more warning'] }).map((e) => e.path)).toEqual([
      'directives/custom/team.md',
    ]);
    // No custom file: the smallest path among all.
    const builtIns = [testingAt(list, 'directives/built-in/team/x.md'), testingAt(list, 'directives/built-in/team.md')];
    expect(directivesInForce({ entries: builtIns, warnings: [] }).map((e) => e.path)).toEqual([
      'directives/built-in/team.md',
    ]);
  });

  it('reads a path with a space in the warning', () => {
    const list = sample('0.3.1');
    const entries = [
      ...list.entries.filter((e) => e.path !== 'directives/custom/testing.md'),
      testingAt(list, 'directives/custom/my testing.md'),
      testingAt(list, 'directives/custom/testing.md'),
    ];
    const warnings = [
      "directive 'testing' defined in directives/built-in/testing.md, directives/custom/my testing.md, directives/custom/testing.md; using directives/custom/testing.md",
    ];
    expect(
      directivesInForce({ entries, warnings })
        .filter((e) => e.frontmatter.id === 'testing')
        .map((e) => e.path),
    ).toEqual(['directives/custom/testing.md']);
    const named = [warnings[0]!.replace(/using .*$/, 'using directives/custom/my testing.md')];
    expect(
      directivesInForce({ entries, warnings: named })
        .filter((e) => e.frontmatter.id === 'testing')
        .map((e) => e.path),
    ).toEqual(['directives/custom/my testing.md']);
  });
});
