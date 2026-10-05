// REQ-ARC-04 (TT-ARC-04), adr-001 D1a, spec-001 §4 — every read of the facade on the real
// fixtures under a file-system spy: direct reads only of `.wingfoil/memory.yaml` and of the paths
// the CLI returns, 0 writes; an element whose file `status` differs from `memory search` is a read
// error. API/unit side of S-25.1, M-01.1, R-05.1 (screens: task-017, task-019).
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WingfoilCli } from '../../../server/src/cli/adapter.js';
import { discoverCli } from '../../../server/src/cli/discovery.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';
import { DirectReadError } from '../../../server/src/reads/confine.js';
import { ProjectReads } from '../../../server/src/reads/project-reads.js';
import { buildFixture, copyFixture, type Fixture } from '../../harness/fixtures/index.js';

/** File-system calls recorded while `on`: function name and first argument. */
const spy = vi.hoisted(() => ({ on: false, calls: [] as { fn: string; arg: string }[] }));

function wrapModule(real: Record<string, unknown>, prefix: string): Record<string, unknown> {
  const wrapped: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(real)) {
    if (typeof value !== 'function' || /^[A-Z]/.test(name)) {
      wrapped[name] = value;
      continue;
    }
    const fn = value as (...args: unknown[]) => unknown;
    wrapped[name] = Object.assign((...args: unknown[]) => {
      if (spy.on) spy.calls.push({ fn: `${prefix}${name}`, arg: String(args[0]) });
      return fn(...args);
    }, fn);
  }
  return { ...wrapped, default: wrapped };
}
vi.mock('node:fs/promises', async (importOriginal) => wrapModule(await importOriginal(), 'promises.'));
vi.mock('node:fs', async (importOriginal) => wrapModule(await importOriginal(), 'fs.'));

/** Calls that only read (anything else on a project file is a write or a change). */
const READ_ONLY = new Set([
  'readFile',
  'realpath',
  'stat',
  'lstat',
  'access',
  'readdir',
  'readlink',
  'existsSync',
  'readFileSync',
  'realpathSync',
  'statSync',
  'lstatSync',
  'accessSync',
  'readdirSync',
]);

let root: string;
let kanban: Fixture;
let custom: Fixture;
let n = 0;
const runners: LocalProcessRunner[] = [];

async function readsFor(fx: Fixture): Promise<ProjectReads> {
  const runner = new LocalProcessRunner();
  runners.push(runner);
  const cli = new WingfoilCli({ cli: await discoverCli(fx.dir, { env: fx.env }), runner, env: fx.env });
  return new ProjectReads({ root: fx.dir, cli });
}

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-reads-fx-')));
  kanban = await buildFixture('kanban', { root: path.join(root, 'kanban') });
  custom = await buildFixture('custom', { root: path.join(root, 'custom') });
});

afterAll(async () => {
  for (const r of runners) await r.terminateAll();
  await rm(root, { recursive: true, force: true });
});

describe('TT-ARC-04 — file-system spy over every read', () => {
  it.each(['kanban', 'custom'] as const)(
    '%s: reads only memory.yaml and the paths the CLI returns, writes nothing',
    async (kind) => {
      const fx = kind === 'kanban' ? kanban : custom;
      const reads = await readsFor(fx);
      const abs = (...p: string[]) => path.join(fx.dir, ...p);

      spy.calls.length = 0;
      spy.on = true;
      await reads.dna();
      await reads.paths();
      await reads.workflows();
      const types = await reads.memoryTypes();
      const elements = (await reads.elements()).data.matches;
      const archived = [
        ...(await reads.archivedElements('deprecated')).data.matches,
        ...(await reads.archivedElements('superseded')).data.matches,
      ];
      const directives = (await reads.directives()).data.entries;
      // Every element and directive through the list entry the CLI returned; one of each by id
      // (which asks the CLI for the list again).
      for (const m of elements) expect((await reads.elementFromMatch(m)).frontmatter.status).toBe(m.status);
      for (const d of directives) expect((await reads.directiveFromEntry(d)).frontmatter.id).toBe(d.frontmatter.id);
      expect((await reads.history(elements[0]!.id)).data.entries.length).toBeGreaterThan(0);
      expect((await reads.element(elements[0]!.id))?.content.frontmatter.id).toBe(elements[0]!.id);
      const first = directives[0]!.frontmatter.id;
      expect((await reads.directive(first))?.content.frontmatter.id).toBe(first);
      expect(await reads.element('task-999-not-there')).toBeUndefined();
      expect(await reads.directive('../dna')).toBeUndefined();
      spy.on = false;

      expect(Object.keys(types.types).length).toBeGreaterThan(0);
      expect(elements.length).toBeGreaterThan(0);
      expect(directives.length).toBeGreaterThan(0);
      const onProject = spy.calls.filter((c) => c.arg === fx.dir || c.arg.startsWith(fx.dir + path.sep));
      expect(onProject.length).toBeGreaterThan(0);
      // 0 writes (nor any other change) to a project file.
      expect(onProject.filter((c) => !READ_ONLY.has(c.fn.replace(/^(promises|fs)\./, '')))).toEqual([]);
      // 0 reads of .wingfoil/*.yaml other than ui.yaml and memory.yaml.
      expect(
        onProject.filter((c) => /[\\/]\.wingfoil[\\/][^\\/]+\.ya?ml$/.test(c.arg) && !/(memory|ui)\.yaml$/.test(c.arg)),
      ).toEqual([]);
      // Files are read only at memory.yaml and at the paths the CLI returned (directories are
      // only resolved, for the confinement check).
      const allowed = new Set([
        abs('.wingfoil', 'memory.yaml'),
        ...[...elements, ...archived].map((m) => abs(m.path)),
        ...directives.map((d) => abs('.wingfoil', d.path)),
      ]);
      const fileReads = onProject.filter((c) => c.fn.endsWith('readFile') || c.fn.endsWith('readFileSync'));
      expect(fileReads.filter((c) => !allowed.has(c.arg))).toEqual([]);
      expect(new Set(fileReads.map((c) => c.arg))).toEqual(
        new Set([abs('.wingfoil', 'memory.yaml'), ...elements.map((m) => abs(m.path)), ...directives.map((d) => abs('.wingfoil', d.path))]),
      );
      const resolved = onProject.filter((c) => !c.fn.endsWith('readFile') && !c.fn.endsWith('readFileSync'));
      expect(resolved.filter((c) => !allowed.has(c.arg) && c.arg !== fx.dir && c.arg !== abs('.wingfoil'))).toEqual([]);
    },
    120_000,
  );
});

describe('the status cross-check (REQ-ARC-04)', () => {
  it('an element whose file status changed after memory search is a read error for that element only', async () => {
    n += 1;
    const fx = await copyFixture(kanban, path.join(root, `copy-${n}`));
    const reads = await readsFor(fx);
    const matches = (await reads.elements()).data.matches;
    const login = matches.find((m) => m.id === 'task-001-login-form')!;
    const file = path.join(fx.dir, login.path);
    await writeFile(file, (await readFile(file, 'utf8')).replace(/^status: pending$/m, 'status: approved'));

    const error = await reads.elementFromMatch(login).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DirectReadError);
    expect(error).toMatchObject({ kind: 'mismatch', file: login.path });
    expect((error as Error).message).toBe(
      'docs/memory/task/task-001-login-form.md: status "approved" differs from memory search ("pending")',
    );
    // The other elements read fine.
    for (const m of matches.filter((x) => x !== login)) await expect(reads.elementFromMatch(m)).resolves.toBeDefined();
  });
});

describe('scenarios on the API side', () => {
  it('S-25.1 — an uncommitted title edit is read from the working tree, with no read error', async () => {
    n += 1;
    const fx = await copyFixture(kanban, path.join(root, `copy-${n}`));
    const file = path.join(fx.dir, 'docs/memory/task/task-001-login-form.md');
    await writeFile(file, (await readFile(file, 'utf8')).replace('title: "Login form"', 'title: "Login form v2"'));
    const reads = await readsFor(fx);
    const match = (await reads.elements()).data.matches.find((m) => m.id === 'task-001-login-form');
    expect(match?.title).toBe('Login form v2');
    const el = await reads.element('task-001-login-form');
    expect(el?.content.frontmatter.title).toBe('Login form v2');
  });

  it('M-01.1 — kanban: the type filter counts task 4 and bug 1 (memory search over the memory.yaml types)', async () => {
    const reads = await readsFor(kanban);
    const types = Object.keys((await reads.memoryTypes()).types);
    const matches = (await reads.elements()).data.matches;
    const count = (t: string) => matches.filter((m) => m.type === t).length;
    expect(types).toEqual(expect.arrayContaining(['task', 'bug']));
    expect(count('task')).toBe(4);
    expect(count('bug')).toBe(1);
  });

  it("R-05.1 — custom: the DNA's modules with descriptions and paths, stacks, team roles and paths", async () => {
    const reads = await readsFor(custom);
    const dna = (await reads.dna()).data;
    expect(dna.modules.map((m) => [m.name, m.path])).toEqual([
      ['server', 'server/'],
      ['web', 'web/'],
      ['contracts', 'contracts/'],
    ]);
    expect(dna.modules.every((m) => typeof m.description === 'string' && m.description.length > 0)).toBe(true);
    expect(dna.stacks.technologies.map((t) => t.name)).toContain('TypeScript');
    expect(dna.stacks.methodologies.find((m) => m.name === 'TDD')?.phase).toBe('delivery');
    expect(dna.team.members.find((m) => m.name === 'Morgan')?.roles).toEqual(['approver', 'tech-lead']);
    expect(dna.paths.tests).toEqual(['test/']);
  });
});
