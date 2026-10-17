// task-029 (AC-1, D29-13) — `scripts/check-release-tag.mjs`, the tag checks of the publish
// pipeline's gate job: the tag is `v` + the version of the root and of every workspace
// `package.json`, it is annotated, it points at the commit the run builds, and that commit is on
// `origin/main` (release-publishing `tag`). Run on a throwaway repository with a bare `origin`.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { REPO_ROOT } from '../harness/cli.js';
import { harnessEnv } from '../harness/fixtures/index.js';
import { git, run } from '../harness/run.js';
import { TempWorkspace } from '../harness/temp-workspace.js';

const SCRIPT = path.join(REPO_ROOT, 'scripts', 'check-release-tag.mjs');
let ws: TempWorkspace;
let repo: string;
let env: NodeJS.ProcessEnv;
/** Commit on `main` (pushed) and on a side branch (pushed, never merged). */
let onMain: string;
let onSide: string;

interface Versions {
  /** The `version` of `web/package.json` (default: the root's). */
  web?: string;
  /** `package-lock.json` `version`, `packages[""].version`, `packages.web.version` (default: the root's). */
  lock?: string;
  lockRoot?: string;
  lockWeb?: string;
  /** The root `workspaces` (default: the three folders). */
  workspaces?: string[];
}

async function manifests(root: string, rootVersion: string, v: Versions = {}): Promise<void> {
  const workspaces = v.workspaces ?? ['contracts', 'server', 'web'];
  await writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'wingfoil-ui', version: rootVersion, workspaces }),
  );
  const lockPackages: Record<string, { name?: string; version: string }> = {
    '': { name: 'wingfoil-ui', version: v.lockRoot ?? rootVersion },
  };
  for (const ws of ['contracts', 'server', 'web']) {
    await mkdir(path.join(root, ws), { recursive: true });
    await writeFile(
      path.join(root, ws, 'package.json'),
      JSON.stringify({ name: `@wingfoil-ui/${ws}`, version: ws === 'web' ? (v.web ?? rootVersion) : rootVersion }),
    );
    lockPackages[ws] = { name: `@wingfoil-ui/${ws}`, version: ws === 'web' ? (v.lockWeb ?? rootVersion) : rootVersion };
  }
  await writeFile(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ name: 'wingfoil-ui', version: v.lock ?? rootVersion, lockfileVersion: 3, packages: lockPackages }),
  );
}

async function commitAll(subject: string): Promise<string> {
  await git(repo, ['add', '-A'], env);
  await git(repo, ['commit', '--quiet', '-m', subject], env);
  return (await git(repo, ['rev-parse', 'HEAD'], env)).stdout.trim();
}

function check(tag: string, sha: string) {
  return run(process.execPath, [SCRIPT, tag, sha], { cwd: repo, env, allowFailure: true });
}

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-029-tag-');
  env = (await harnessEnv(path.join(ws.dir, 'user'))).env;
  const origin = path.join(ws.dir, 'origin.git');
  repo = path.join(ws.dir, 'repo');
  await git(ws.dir, ['init', '--quiet', '--bare', '--initial-branch=main', origin], env);
  await git(ws.dir, ['init', '--quiet', '--initial-branch=main', repo], env);
  await git(repo, ['config', 'user.email', 'alex@example.test'], env);
  await git(repo, ['config', 'user.name', 'Alex'], env);
  await git(repo, ['remote', 'add', 'origin', origin], env);
  await manifests(repo, '0.2.0');
  onMain = await commitAll('chore(release): v0.2.0');
  await git(repo, ['push', '--quiet', 'origin', 'main'], env);
  await git(repo, ['tag', '-a', '-m', 'v0.2.0', 'v0.2.0'], env);
  await git(repo, ['tag', 'v0.2.0-light'], env);
  await git(repo, ['checkout', '--quiet', '-b', 'task/side'], env);
  await writeFile(path.join(repo, 'side.txt'), 'side\n');
  onSide = await commitAll('side');
  await git(repo, ['push', '--quiet', 'origin', 'task/side'], env);
  await git(repo, ['tag', '-a', '-m', 'side', 'v0.2.0-side'], env);
  await git(repo, ['checkout', '--quiet', 'main'], env);
}, 120_000);

afterAll(async () => {
  await ws?.dispose();
});

describe('check-release-tag (task-029, D29-13)', () => {
  it('accepts an annotated v<version> tag on the pushed main commit it points at', async () => {
    const r = await check('v0.2.0', onMain);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
    expect(r.stdout).toContain('v0.2.0');
  });

  it('refuses a tag that is not v<package.json version>', async () => {
    await git(repo, ['tag', '-a', '-m', 'v0.3.0', 'v0.3.0', onMain], env);
    const r = await check('v0.3.0', onMain);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/v0\.3\.0.*0\.2\.0/);
  });

  it('refuses when a workspace version differs from the root version', async () => {
    await manifests(repo, '0.2.0', { web: '0.1.0' });
    try {
      const r = await check('v0.2.0', onMain);
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(/web\/package\.json.*0\.1\.0/);
    } finally {
      await manifests(repo, '0.2.0');
    }
  });

  it('refuses a lightweight tag', async () => {
    // The version check reads the tag's version from its name: a light tag named like a release.
    await git(repo, ['tag', '-d', 'v0.2.0-light'], env);
    await git(repo, ['tag', '-d', 'v0.2.0'], env);
    await git(repo, ['tag', 'v0.2.0', onMain], env);
    try {
      const r = await check('v0.2.0', onMain);
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(/not an annotated tag/);
    } finally {
      await git(repo, ['tag', '-d', 'v0.2.0'], env);
      await git(repo, ['tag', '-a', '-m', 'v0.2.0', 'v0.2.0', onMain], env);
    }
  });

  it('refuses a tag that does not point at the commit the run builds', async () => {
    const r = await check('v0.2.0', onSide);
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/points at/);
  });

  it('refuses a tag whose commit is not on origin/main', async () => {
    await git(repo, ['tag', '-d', 'v0.2.0'], env);
    await git(repo, ['tag', '-a', '-m', 'v0.2.0', 'v0.2.0', onSide], env);
    try {
      const r = await check('v0.2.0', onSide);
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(/not on origin\/main/);
    } finally {
      await git(repo, ['tag', '-d', 'v0.2.0'], env);
      await git(repo, ['tag', '-a', '-m', 'v0.2.0', 'v0.2.0', onMain], env);
    }
  });

  it('peels the commit given as an annotated tag object id (review R8)', async () => {
    const object = (await git(repo, ['rev-parse', 'refs/tags/v0.2.0'], env)).stdout.trim();
    expect(object).not.toBe(onMain);
    const r = await check('v0.2.0', object);
    expect(r.stderr).toBe('');
    expect(r.code).toBe(0);
  });

  it.each([
    ['package-lock.json version', { lock: '0.1.0' }, /package-lock\.json version 0\.1\.0/],
    ['package-lock.json packages[""]', { lockRoot: '0.1.0' }, /package-lock\.json packages\[""\] version 0\.1\.0/],
    ['package-lock.json packages.web', { lockWeb: '0.1.0' }, /package-lock\.json packages\["web"\] version 0\.1\.0/],
  ] as const)('refuses when the %s differs from the tag (review R8)', async (_what, versions, message) => {
    await manifests(repo, '0.2.0', versions);
    try {
      const r = await check('v0.2.0', onMain);
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(message);
    } finally {
      await manifests(repo, '0.2.0');
    }
  });

  it('refuses a glob workspace entry clearly instead of guessing its folders (review R8)', async () => {
    await manifests(repo, '0.2.0', { workspaces: ['packages/*'] });
    try {
      const r = await check('v0.2.0', onMain);
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(/workspace entry packages\/\* is a glob/);
    } finally {
      await manifests(repo, '0.2.0');
    }
  });

  it.each([
    ['package-lock.json', 'package-lock.json'],
    ['a workspace package.json', path.join('server', 'package.json')],
  ])('refuses with a refused: line, not a stack trace, when %s is missing (review round 2)', async (_what, file) => {
    await rm(path.join(repo, file));
    try {
      const r = await check('v0.2.0', onMain);
      expect(r.code).toBe(1);
      expect(r.stderr).toMatch(new RegExp(`^refused: .*${file.replace(/[./\\]/g, '.')}.*cannot be read`, 'm'));
      expect(r.stderr).not.toMatch(/\n\s+at /);
    } finally {
      await manifests(repo, '0.2.0');
    }
  });

  it('refuses a tag name that is not v<major>.<minor>.<patch>, and missing arguments', async () => {
    expect((await check('v0.2', onMain)).code).toBe(1);
    expect((await check('release-0.2.0', onMain)).code).toBe(1);
    const none = await run(process.execPath, [SCRIPT], { cwd: repo, env, allowFailure: true });
    expect(none.code).toBe(2);
    expect(none.stderr).toMatch(/usage/i);
  });
});
