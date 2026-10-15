// The undo of a refused clone (REQ-STATE-07, review round 1 item 2): `CloneTarget.discard` removes
// the working directory and the ancestors the clone created, but never what someone else created
// in those ancestors meanwhile. task-026 / bug-008: the hooks path of a clone is a regular file of
// the console (nothing below it, nothing created); a hooks path that is not one refuses the clone
// before any git process (fail closed).
import { lstat, mkdir, mkdtemp, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CloneTarget,
  GitCloneError,
  HooksPathError,
  NO_HOOKS_PATH,
  noHooksPath,
  runClone,
} from '../../../server/src/projects/clone.js';
import { FakeProcessRunner } from '../process/fake-runner.js';

let root: string;
beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'wfui-clone-target-'));
});
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('CloneTarget', () => {
  it('removes the directory and the empty ancestors it created, keeping a sibling created meanwhile', async () => {
    const base = path.join(root, 'a');
    const target = (await CloneTarget.inspect(path.join(base, 'projects', 'deep', 'kanban')))!;
    expect(target.createdRoot).toBe(base);
    // What git creates, and what another process creates next to it during the clone.
    await mkdir(path.join(target.directory, '.git'), { recursive: true });
    await writeFile(path.join(target.directory, 'README.md'), 'x');
    await writeFile(path.join(base, 'projects', 'sibling.txt'), 'mine');
    await target.discard();
    expect(await readdir(root)).toEqual(['a']);
    expect(await readdir(base)).toEqual(['projects']);
    expect(await readdir(path.join(base, 'projects'))).toEqual(['sibling.txt']);
  });

  it('removes every created ancestor when nothing else was added', async () => {
    const target = (await CloneTarget.inspect(path.join(root, 'b', 'c', 'd')))!;
    await mkdir(target.directory, { recursive: true });
    await writeFile(path.join(target.directory, 'f'), 'x');
    await target.discard();
    expect(await readdir(root)).not.toContain('b');
  });

  it('empties an existing empty folder again, and refuses a folder that is not empty or a file', async () => {
    const dir = path.join(root, 'empty');
    await mkdir(dir);
    const target = (await CloneTarget.inspect(dir))!;
    expect(target.existed).toBe(true);
    await writeFile(path.join(dir, 'f'), 'x');
    await target.discard();
    expect(await readdir(dir)).toEqual([]);
    await writeFile(path.join(dir, 'g'), 'x');
    expect(await CloneTarget.inspect(dir)).toBeUndefined();
    expect(await CloneTarget.inspect(path.join(dir, 'g'))).toBeUndefined();
  });
});

describe('the hooks path of a clone (bug-008)', () => {
  it('is an existing regular file of the console: no hook can exist below it', async () => {
    expect(path.isAbsolute(NO_HOOKS_PATH)).toBe(true);
    expect((await lstat(NO_HOOKS_PATH)).isFile()).toBe(true);
    // Git looks for `<hooks path>/<hook>`: below a regular file there is nothing (ENOTDIR).
    for (const hook of ['post-checkout', 'reference-transaction']) {
      await expect(stat(path.join(NO_HOOKS_PATH, hook))).rejects.toMatchObject({ code: 'ENOTDIR' });
    }
    expect(await noHooksPath()).toBe(NO_HOOKS_PATH);
  });

  it('runs git with core.hooksPath set to it, creating no folder', async () => {
    const runner = new FakeProcessRunner().answer({ exitCode: 0 });
    const before = await readdir(tmpdir());
    const target = (await CloneTarget.inspect(path.join(root, 'hooks-ok', 'kanban')))!;
    await runClone('file:///nowhere/kanban.git', target, { git: '/usr/bin/git', runner, env: {} });
    expect(runner.requests).toHaveLength(1);
    expect(runner.requests[0]!.args).toContain(`core.hooksPath=${NO_HOOKS_PATH}`);
    expect((await readdir(tmpdir())).filter((e) => e.startsWith('wfui-no-hooks-') && !before.includes(e))).toEqual([]);
  });

  it('sets GIT_ALLOW_PROTOCOL to the allowed list whatever the server environment holds (task-033 D33-2, bug-013)', async () => {
    const runner = new FakeProcessRunner().answer({ exitCode: 0 });
    const target = (await CloneTarget.inspect(path.join(root, 'protocols', 'kanban')))!;
    await runClone('file:///nowhere/kanban.git', target, {
      git: 'git',
      runner,
      env: { GIT_ALLOW_PROTOCOL: 'ext:fd', PATH: 'x' },
    });
    expect(runner.requests[0]!.env).toMatchObject({ GIT_ALLOW_PROTOCOL: 'https:http:ssh:git:file', PATH: 'x' });
  });

  it('F5: a real clone of an ext:: URL with GIT_ALLOW_PROTOCOL=ext in its environment is refused and runs nothing (bug-013)', async () => {
    const { LocalProcessRunner } = await import('../../../server/src/process/runner.js');
    const { resolveGit } = await import('../../../server/src/git/git.js');
    const marker = path.join(root, 'f5-ext-ran');
    const target = (await CloneTarget.inspect(path.join(root, 'f5', 'kanban')))!;
    const error = await runClone(`ext::sh -c touch% ${marker}`, target, {
      git: await resolveGit(),
      runner: new LocalProcessRunner(),
      env: { ...process.env, GIT_ALLOW_PROTOCOL: 'ext' },
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GitCloneError);
    expect((error as Error).message).toMatch(/transport 'ext' not allowed/);
    await expect(stat(marker)).rejects.toThrow();
  });

  it.each([
    ['missing', async () => path.join(root, 'no-such-file')],
    [
      'a folder',
      async () => {
        const dir = path.join(root, 'hooks-folder');
        await mkdir(dir, { recursive: true });
        return dir;
      },
    ],
    [
      'a link to a folder',
      async () => {
        const dir = path.join(root, 'hooks-folder-2');
        await mkdir(dir, { recursive: true });
        const link = path.join(root, 'hooks-link');
        await symlink(dir, link);
        return link;
      },
    ],
  ])('refuses the clone with no git process when the hooks path is %s (fail closed)', async (_, make) => {
    const hooksPath = await make();
    await expect(noHooksPath(hooksPath)).rejects.toBeInstanceOf(HooksPathError);
    const runner = new FakeProcessRunner().answer({ exitCode: 0 });
    const target = (await CloneTarget.inspect(path.join(root, 'hooks-refused', 'kanban')))!;
    const cloning = runClone('file:///nowhere/kanban.git', target, { git: '/usr/bin/git', runner, env: {}, hooksPath });
    // Not git's refusal (review round 1 F1): an internal error, answered as spec-004 §5 `internal`.
    await expect(cloning).rejects.toBeInstanceOf(HooksPathError);
    await expect(cloning).rejects.not.toBeInstanceOf(GitCloneError);
    expect(runner.requests).toEqual([]);
  });
});
