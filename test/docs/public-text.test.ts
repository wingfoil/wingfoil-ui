// task-028 — the public-text check (dl-006 action 4, dl-005): no tracked text file names an
// absolute filesystem path outside the repository, except the fictitious or generic examples of
// `public-text.allow-list.ts`. The scanner is `public-text.ts`.
import { rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/builder.js';
import { TempWorkspace } from '../harness/temp-workspace.js';
import { ALLOWED } from './public-text.allow-list.js';
import { allowedBy, CHECKED_ROOTS, findPaths, formatFindings, scanRepository, type Scan } from './public-text.js';

/** Real-looking paths outside any repository, built at run time so that no committed text holds them. */
const OUTSIDE = ['', 'home', 'jo-probe', 'notes', 'plan.md'].join('/');
const OUTSIDE_WINDOWS = ['C:', 'Users', 'jo-probe', 'notes'].join('\\');
const OUTSIDE_HOME = ['~', 'jo-probe', 'notes'].join('/');

// Not allow-listed, so built at run time: in committed text the tracked-tree check would flag them.
const JDOE = ['', 'home', 'jdoe'].join('/');
const JDOE_TILDE = ['~', 'jdoe'].join('/');
const JDOE_WINDOWS = ['C:', 'Users', 'jdoe'].join('\\');
const JDOE_WINDOWS_SLASH = ['C:', 'Users', 'jdoe', 'x'].join('/');
const JDOE_MACOS_LOWER = ['', 'users', 'jdoe'].join('/');
const JDOE_DRIVE_URL = ['c:', 'users', 'jdoe', 'x'].join('/');
const JDOE_TMP = ['', 'tmp', 'jdoe-err.log'].join('/');
const DOLLAR_HOME = '$' + 'HOME';
const BRACED_HOME = '$' + '{HOME}';
const USERPROFILE = '%' + 'USERPROFILE%';
const ENV_PROFILE = '$' + 'env:USERPROFILE';

describe('findPaths', () => {
  it.each([
    ['a POSIX home path', 'see /home/alex/projects/kanban here', ['/home/alex/projects/kanban']],
    ['a macOS home path', "path: '/Users/alex'", ['/Users/alex']],
    ['a macOS root in another case', `see ${JDOE_MACOS_LOWER}`, [JDOE_MACOS_LOWER]],
    ['a root-level system path', 'reads /proc/loadavg', ['/proc/loadavg']],
    ['a temporary folder', '`/tmp/pwned`', ['/tmp/pwned']],
    ['a bare root directory', 'PATH: "/bin"', ['/bin']],
    ['a file URL', 'open file:///home/alex/x.md', ['/home/alex/x.md']],
    ['a file URL with a drive, once', `open file:///${JDOE_DRIVE_URL}`, [JDOE_DRIVE_URL]],
    ['a path in a JSON string', '"at \\"/home/test/projects/kanban\\""', ['/home/test/projects/kanban']],
    ['a Windows drive path', 'C:\\Users\\alex\\kanban', ['C:\\Users\\alex\\kanban']],
    ['an escaped Windows drive path', String.raw`'C:\\remotes\\kanban.git'`, ['C:\\remotes\\kanban.git']],
    ['a Windows drive path with slashes, once', JDOE_WINDOWS_SLASH, [JDOE_WINDOWS_SLASH]],
    ['a drive-like YAML key before a path, once', `a:${JDOE}/x`, [`a:${JDOE}/x`]],
    ['a home-relative path', 'clone into ~/projects/kanban.', ['~/projects/kanban']],
    ['a $HOME path', `${DOLLAR_HOME}/x and ${BRACED_HOME}/y`, [`${DOLLAR_HOME}/x`, `${BRACED_HOME}/y`]],
    ['a %USERPROFILE% path', `${USERPROFILE}\\x`, [`${USERPROFILE}\\x`]],
    ['a POSIX path before an escape', String.raw`'#!/bin/sh\necho'`, ['/bin/sh']],
    ['a path in Markdown bold', `**${JDOE}/x**`, [`${JDOE}/x`]],
    ['a path in Markdown emphasis', `*${JDOE}/x*`, [`${JDOE}/x`]],
    ['a path in underscore emphasis', `_${JDOE}/x_`, [`${JDOE}/x`]],
    ['a home path in Markdown bold', `**${JDOE_TILDE}/x**`, [`${JDOE_TILDE}/x`]],
    ['a Windows path in Markdown emphasis', `*${JDOE_WINDOWS}*`, [JDOE_WINDOWS]],
    ['a redirection target', `cmd 2>${JDOE_TMP}`, [JDOE_TMP]],
    ['a path after >', `>${JDOE}/x`, [`${JDOE}/x`]],
    ['a path in an HTML cell', `<td>${JDOE}</td>`, [JDOE]],
    ['a path in HTML code', `<code>${JDOE}/x</code>`, [`${JDOE}/x`]],
    ['a path glued to an option', `git -C${JDOE}/x status`, [`${JDOE}/x`]],
    ['a path glued to a volume option', `docker -v${JDOE}/x:/data`, [`${JDOE}/x`]],
    ['a path after $', `$${JDOE}/x`, [`${JDOE}/x`]],
    ['two paths joined by a colon', `docker run -v /home/alex/x:${JDOE}/secret`, ['/home/alex/x', `${JDOE}/secret`]],
    ['a temporary path joined to a home path', `/tmp/x:${JDOE}`, ['/tmp/x', JDOE]],
    ['a colon inside a segment', "remote '/srv/a:b@c:x'", ['/srv/a:b@c:x']],
    ['a path after an allowed home path and =', `~/projects/kanban=${JDOE}`, ['~/projects/kanban', JDOE]],
    ['a home path after an allowed path and =', `/tmp/x/a=${JDOE_TILDE}`, ['/tmp/x/a', JDOE_TILDE]],
    ['a $HOME path after an allowed path and =', `/home/alex/x=${DOLLAR_HOME}/jdoe`, ['/home/alex/x', `${DOLLAR_HOME}/jdoe`]],
    ['a path after an allowed drive path and =', `C:/work/x=${JDOE}`, ['C:/work/x', JDOE]],
    ['a path inside an allowed drive path', `C:/A/-${JDOE}`, [`C:/A/-${JDOE}`, JDOE]],
    ['a path after an allowed path and @', `/home/alex/x@${JDOE}`, ['/home/alex/x', JDOE]],
    ['a colon path after a dash, not a drive', `/tmp/wfui-a:${JDOE}`, ['/tmp/wfui-a', JDOE]],
    ['a colon path after @, not a drive', `/srv/a:b@c:${JDOE}`, ['/srv/a:b@c', JDOE]],
    ['a quoted ${HOME} path', `"${BRACED_HOME}"/x`, [`"${BRACED_HOME}"/x`]],
    ['a %userprofile% path in any case', `${USERPROFILE.toLowerCase()}\\x`, [`${USERPROFILE.toLowerCase()}\\x`]],
    ['a PowerShell $env:USERPROFILE path', `${ENV_PROFILE}\\x`, [`${ENV_PROFILE}\\x`]],
    ['a lower-case $home path', `${DOLLAR_HOME.toLowerCase()}/x`, [`${DOLLAR_HOME.toLowerCase()}/x`]],
    ['a path glued to an option in parentheses', `(-C${JDOE})`, [JDOE]],
    ['a path glued to an option after =', `opt=-C${JDOE}`, [JDOE]],
  ])('finds %s', (_name, text, expected) => {
    expect(findPaths(text).map((m) => m.path)).toEqual(expected);
  });

  it.each([
    ['an API route', 'GET /api/p/:pid/elements'],
    ['a URL path', 'https://git.example.test/srv/remotes/home/x.git'],
    ['a repository-relative path', 'docs/tmp/x and test/server/process/runner.ts'],
    ['a parent-relative path', "the id '../../etc'"],
    ['a template placeholder', '`${dir}/tmp/x`'],
    ['a word continued by an underscore', 'snake_/tmp/x'],
    ['an escaped regex', 'expect(x).toMatch(/^\\/home\\/alex\\//)'],
    ['a data URL', 'src="data:image/png;base64,AAAA"'],
    ['a YAML escape after a one-letter key', String.raw`'types:\n  a:\n    path: a/{id}.md'`],
    ['an unlisted root directory', '/assets/index.js and /docs/guide'],
    ['a word that only starts like a root', '/homepage and /tmpl/x'],
    ['the bare home notation', `a \`~/\` path, the regex ~/\\.config/, ${DOLLAR_HOME}/ alone`],
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

  it('allows no path with a parent segment', () => {
    // Split so that the committed text holds no `..` path below an allowed folder.
    for (const probe of ['/home/alex/' + '../jdoe', '~/projects/' + '../jdoe', '/tmp/wfui-x/' + '../../home/jdoe']) {
      expect(allowedBy(probe), probe).toBeUndefined();
    }
    expect(allowedBy('/home/alex/kanban/..state')).toBeDefined();
  });
});

describe('scanRepository', () => {
  let workspace: TempWorkspace | undefined;
  let repo: string;
  let env: NodeJS.ProcessEnv;
  let scan: Scan;

  beforeAll(async () => {
    workspace = await TempWorkspace.create('wfui-public-text-');
    ({ env } = await harnessEnv(path.join(workspace.dir, 'harness')));
    repo = path.join(workspace.dir, 'repo');
    await workspace.run('git', ['init', '-q', repo], { env });
    // One path per rule; none depends on this machine's home or temporary folder.
    const text = `# Notes\n\nSee ${OUTSIDE}.\nAlso (${OUTSIDE_WINDOWS}) and "${OUTSIDE_HOME}"\n`;
    await writeFile(path.join(repo, 'tracked.md'), text);
    await writeFile(path.join(repo, 'untracked.md'), text);
    await writeFile(path.join(repo, 'image.bin'), Buffer.from([0x89, 0x50, 0x00, 0x00, ...Buffer.from(OUTSIDE)]));
    // git stores a link's target as its text; a tracked file deleted from the working tree has none.
    await symlink(OUTSIDE, path.join(repo, 'link'));
    await writeFile(path.join(repo, 'gone.md'), text);
    await workspace.run('git', ['add', 'tracked.md', 'image.bin', 'link', 'gone.md'], { cwd: repo, env });
    await rm(path.join(repo, 'gone.md'));
    scan = await scanRepository(repo, env);
  });

  afterAll(async () => {
    await workspace?.dispose();
  });

  it('fails on a tracked file holding an outside path, naming file and line (AC-2)', () => {
    expect(formatFindings(scan.findings).split('\n')).toEqual([
      `link:1: ${OUTSIDE}`,
      `tracked.md:3: ${OUTSIDE}`,
      `tracked.md:4: ${OUTSIDE_WINDOWS}`,
      `tracked.md:4: ${OUTSIDE_HOME}`,
    ]);
  });

  it('never reads an untracked file, a binary one or a deleted one', () => {
    expect(scan.files).toBe(2);
    expect(scan.findings.filter((f) => !['link', 'tracked.md'].includes(f.file))).toEqual([]);
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
