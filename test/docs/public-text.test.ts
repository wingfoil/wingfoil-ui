// task-028 — the public-text check (dl-006 action 4, dl-005): no tracked text file names an
// absolute filesystem path outside the repository, except the fictitious or generic examples of
// `public-text.allow-list.ts`. The scanner is `public-text.ts`.
import { writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/builder.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { ALLOWED } from './public-text.allow-list.js';
import { allowedBy, CHECKED_ROOTS, findPaths, formatFindings, scanRepository, type Scan } from './public-text.js';

/** A path outside any repository, built at run time so that no committed text holds it. */
const OUTSIDE = ['', 'home', 'jo-' + 'probe', 'notes', 'plan.md'].join('/');

describe('findPaths', () => {
  it.each([
    ['a POSIX home path', 'see /home/alex/projects/kanban here', '/home/alex/projects/kanban'],
    ['a macOS home path', "path: '/Users/alex'", '/Users/alex'],
    ['a root-level system path', 'reads /proc/loadavg', '/proc/loadavg'],
    ['a temporary folder', '`/tmp/pwned`', '/tmp/pwned'],
    ['a bare root directory', 'PATH: "/bin"', '/bin'],
    ['a file URL', 'open file:///home/alex/x.md', '/home/alex/x.md'],
    ['a path in a JSON string', '"at \\"/home/test/projects/kanban\\""', '/home/test/projects/kanban'],
    ['a Windows drive path', 'C:\\Users\\alex\\kanban', 'C:\\Users\\alex\\kanban'],
    ['an escaped Windows drive path', "'C:\\\\remotes\\\\kanban.git'", 'C:\\remotes\\kanban.git'],
    ['a Windows drive path with slashes', 'C:/work/kanban', 'C:/work/kanban'],
    ['a home-relative path', 'clone into ~/projects/kanban.', '~/projects/kanban'],
  ])('finds %s', (_name, text, expected) => {
    expect(findPaths(text).map((m) => m.path)).toEqual([expected]);
  });

  it.each([
    ['an API route', 'GET /api/p/:pid/elements'],
    ['a URL path', 'https://git.example.test/srv/remotes/home/x.git'],
    ['a repository-relative path', 'docs/tmp/x and test/server/process/runner.ts'],
    ['a parent-relative path', "the id '../../etc'"],
    ['a placeholder prefix', '`<prefix>/bin/wingfoil` and `${dir}/tmp/x`'],
    ['an escaped regex', 'expect(x).toMatch(/^\\/home\\/alex\\//)'],
    ['a data URL', 'src="data:image/png;base64,AAAA"'],
    ['a YAML escape after a one-letter key', "'types:\\n  a:\\n    path: a/{id}.md'"],
    ['an unlisted root directory', '/assets/index.js and /docs/guide'],
    ['a word that only starts like a root', '/homepage and /tmpl/x'],
  ])('ignores %s', (_name, text) => {
    expect(findPaths(text)).toEqual([]);
  });

  it('numbers lines from 1', () => {
    expect(findPaths('one\ntwo /etc/hosts\r\nthree ~/x')).toEqual([
      { line: 2, path: '/etc/hosts', rule: 'posix' },
      { line: 3, path: '~/x', rule: 'home' },
    ]);
  });
});

describe('the allow-list', () => {
  it('gives every entry a reason', () => {
    for (const entry of ALLOWED) expect(entry.reason.trim().length, String(entry.pattern)).toBeGreaterThan(10);
  });

  it('allows no whole root', () => {
    // Built at run time: the probes are not allow-listed, so the tracked-tree check would flag them.
    const leaf = 'zz-probe';
    const roots = [...CHECKED_ROOTS.map((root) => '/' + root), '~', 'C:'];
    const probes = roots.flatMap((root) => [root + '/' + leaf, root + '\\' + leaf]);
    for (const probe of probes) expect(allowedBy(probe), probe).toBeUndefined();
  });

  it('matches whole segments only', () => {
    expect(allowedBy('/home/alex/kanban')).toBeDefined();
    expect(allowedBy(['', 'home', 'alexandra', 'kanban'].join('/'))).toBeUndefined();
    expect(allowedBy(OUTSIDE)).toBeUndefined();
  });
});

describe('scanRepository', () => {
  let workspace: TempWorkspace;
  let repo: string;
  let env: NodeJS.ProcessEnv;
  let scan: Scan;

  beforeAll(async () => {
    workspace = await TempWorkspace.create('wfui-public-text-');
    ({ env } = await harnessEnv(path.join(workspace.dir, 'harness')));
    repo = path.join(workspace.dir, 'repo');
    await workspace.run('git', ['init', '-q', repo], { env });
    // Two real-looking outside paths: this machine's home folder and one built from segments.
    const text = `# Notes\n\nSee ${path.join(homedir(), 'private-notes')}.\nAlso ${OUTSIDE}\n`;
    await writeFile(path.join(repo, 'tracked.md'), text);
    await writeFile(path.join(repo, 'untracked.md'), text);
    await writeFile(path.join(repo, 'image.bin'), Buffer.from([0x89, 0x50, 0x00, 0x00, ...Buffer.from(OUTSIDE)]));
    await workspace.run('git', ['add', 'tracked.md', 'image.bin'], { cwd: repo, env });
    scan = await scanRepository(repo, env);
  });

  afterAll(async () => {
    await workspace.dispose();
  });

  it('fails on a tracked file holding an outside path, naming file and line (AC-2)', () => {
    expect(scan.findings.map((f) => `${f.file}:${f.line}`)).toEqual(['tracked.md:3', 'tracked.md:4']);
    expect(formatFindings(scan.findings)).toContain(`tracked.md:4: ${OUTSIDE}`);
  });

  it('never reads an untracked file nor a binary one', () => {
    expect(scan.files).toBe(1);
    expect(scan.findings.some((f) => f.file !== 'tracked.md')).toBe(false);
  });
});

describe('the tracked tree', () => {
  let scan: Scan;

  beforeAll(async () => {
    scan = await scanRepository(REPO_ROOT);
  });

  it('names no absolute path outside the repository (AC-1)', () => {
    expect(scan.findings, formatFindings(scan.findings)).toEqual([]);
  });

  it('uses every allow-list entry', () => {
    const stale = ALLOWED.filter((entry) => !scan.used.has(entry)).map(
      (entry) => `${String(entry.pattern)} (${entry.reason}) matches no tracked path any more: delete it from test/docs/public-text.allow-list.ts`,
    );
    expect(stale).toEqual([]);
  });
});
