// task-052 (AC-2, AC-3; D52-2) — `scripts/changelog-section.mjs`, the notes of the GitHub Release:
// the CHANGELOG section of the tag's version, its heading dropped, its relative links made absolute
// to the tag (as the hand-made `v0.2.0` Release), after a short generated preface. Run by the
// gate on a tag, so a tag with no section fails before anything is staged.
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'changelog-section.mjs');
const RUN_URL = 'https://github.com/wingfoil/wingfoil-ui/actions/runs/39497286374';
const BLOB = 'https://github.com/wingfoil/wingfoil-ui/blob';
const MANIFEST = JSON.stringify({
  name: 'wingfoil-ui',
  version: '1.2.3',
  repository: { type: 'git', url: 'git+https://github.com/wingfoil/wingfoil-ui.git' },
});
const CHANGELOG = `# Changelog

Intro with a [link](docs/intro.md).

## [Unreleased]

- next thing

## [1.2.3] - 2026-11-20

**Title.** See the [README](README.md#from-npm), the [guide](./docs/user-guide.md "Guide"),
the [site](https://example.com/x), the [anchor](#added), [mail](mailto:a@example.com) and [ref][r].

[r]: docs/ref.md

### Added

- a thing ([user guide](docs/user-guide.md#known-limitations))

## [1.2.2] - 2026-11-01

- older

## [1.0.0] - 2026-10-01

- first

[Unreleased]: https://github.com/wingfoil/wingfoil-ui/compare/v1.2.3...HEAD
[1.2.3]: https://github.com/wingfoil/wingfoil-ui/releases/tag/v1.2.3
`;
let ws: TempWorkspace;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-052-notes-');
});

afterAll(async () => {
  await ws?.dispose();
});

async function notes(changelog: string, tag: string, args: string[] = ['--run-url', RUN_URL]) {
  const dir = path.join(ws.dir, Math.random().toString(36).slice(2));
  await mkdir(dir);
  await writeFile(path.join(dir, 'package.json'), MANIFEST);
  await writeFile(path.join(dir, 'CHANGELOG.md'), changelog);
  return ws.run(process.execPath, [SCRIPT, tag, ...args], { cwd: dir, allowFailure: true });
}

describe('changelog-section.mjs (task-052, D52-2)', () => {
  it('prints a preface, then the section of the version without its heading, up to the next section', async () => {
    const result = await notes(CHANGELOG, 'v1.2.3');
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    const [preface, section] = result.stdout.split('\n\n---\n\n');
    expect(preface).toContain('WingFoil UI v1.2.3.');
    expect(preface).toContain('`npx wingfoil-ui@1.2.3` ([npm](https://www.npmjs.com/package/wingfoil-ui/v/1.2.3))');
    expect(preface).toContain(`[run 39497286374](${RUN_URL})`);
    expect(section!.startsWith('**Title.**')).toBe(true);
    expect(section).toContain('### Added');
    expect(section).not.toMatch(/## \[1\.2\.3\]|older|next thing|Intro|\[Unreleased\]:/);
    expect(section!.endsWith('known-limitations))\n')).toBe(true);
  });

  it('makes relative links absolute to the tag; leaves URLs, anchors and mail links alone', async () => {
    const out = (await notes(CHANGELOG, 'v1.2.3')).stdout;
    expect(out).toContain(`[README](${BLOB}/v1.2.3/README.md#from-npm)`);
    expect(out).toContain(`[guide](${BLOB}/v1.2.3/docs/user-guide.md "Guide")`);
    expect(out).toContain(`[user guide](${BLOB}/v1.2.3/docs/user-guide.md#known-limitations)`);
    expect(out).toContain(`[r]: ${BLOB}/v1.2.3/docs/ref.md`);
    expect(out).toContain('[site](https://example.com/x)');
    expect(out).toContain('[anchor](#added)');
    expect(out).toContain('[mail](mailto:a@example.com)');
  });

  it('the last section stops before the link definitions', async () => {
    const out = (await notes(CHANGELOG, 'v1.0.0')).stdout;
    expect(out.split('\n\n---\n\n')[1]).toBe('- first\n');
  });

  it("gives the real CHANGELOG's [0.2.0] README link as the hand-made v0.2.0 Release has it", async () => {
    const dir = path.join(ws.dir, 'real');
    await mkdir(dir);
    await copyFile(path.join(REPO_ROOT, 'CHANGELOG.md'), path.join(dir, 'CHANGELOG.md'));
    await copyFile(path.join(REPO_ROOT, 'package.json'), path.join(dir, 'package.json'));
    const result = await ws.run(process.execPath, [SCRIPT, 'v0.2.0', '--run-url', RUN_URL], {
      cwd: dir,
      allowFailure: true,
    });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain(
      '`npx wingfoil-ui` ([README](https://github.com/wingfoil/wingfoil-ui/blob/v0.2.0/README.md#from-npm))',
    );
    expect(result.stdout).toContain(`(${BLOB}/v0.2.0/docs/user-guide.md#known-limitations)`);
  });

  it.each([
    ['a version with no section', CHANGELOG, 'v9.9.9'],
    ['an empty section', '## [1.2.3] - 2026-11-20\n\n## [1.2.2]\n- x\n', 'v1.2.3'],
    ['a tag that is not vX.Y.Z', CHANGELOG, 'main'],
    ['a pre-release tag', CHANGELOG, 'v1.2.3-rc.1'],
  ])('refuses %s with one line and exit 1', async (_, changelog, tag) => {
    const result = await notes(changelog, tag);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^refused: [^\n]+\n$/);
  });

  it.each([
    ['another scheme', '[x](javascript:alert(1))'],
    ['plain http', '[x](http://example.com/a)'],
    ['a protocol-relative target', '[x](//example.com/a)'],
    ['a root-relative target', '[x](/etc/passwd)'],
    ['a parent segment', '[x](../outside.md)'],
    ['a parent segment inside the path', '[x](docs/../../outside.md)'],
    ['a reference definition with another scheme', '[x]: file:///etc/passwd'],
    ['a reference definition with a parent segment', '[x]: ../outside.md'],
  ])('refuses a link target with %s (review N1)', async (_, line) => {
    const result = await notes(
      `## [1.2.3] - 2026-11-20\n\n- ${line.startsWith('[x]:') ? 'a' : line}\n${line.startsWith('[x]:') ? `\n${line}\n` : ''}`,
      'v1.2.3',
    );
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^refused: [^\n]+\n$/);
  });

  it('a code span stops at a blank line: stray backticks in two paragraphs hide no link (review round 2, R2-1)', async () => {
    const changelog =
      '## [1.2.3] - 2026-11-20\n\n- a stray ` backtick\n\n- [x](javascript:alert(1)) and [y](../../../evil)\n\n- another ` stray\n';
    const result = await notes(changelog, 'v1.2.3');
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^refused: [^\n]+\n$/);
  });

  it('leaves links inside inline code spans as they are (review N1)', async () => {
    const out = (
      await notes('## [1.2.3] - 2026-11-20\n\n- write `[a](b.md)` or ``[c](../d.md)``, see [e](e.md)\n', 'v1.2.3')
    ).stdout;
    expect(out).toContain('- write `[a](b.md)` or ``[c](../d.md)``, see [e](' + BLOB + '/v1.2.3/e.md)');
  });

  it('refuses a run URL that is not a run of a GitHub repository; a usage error exits 2', async () => {
    const bad = await notes(CHANGELOG, 'v1.2.3', ['--run-url', 'https://example.com/x']);
    expect(bad.code).toBe(1);
    const usage = await ws.run(process.execPath, [SCRIPT], { cwd: ws.dir, allowFailure: true });
    expect(usage.code).toBe(2);
    expect(usage.stderr).toMatch(/^usage: /);
  });
});
