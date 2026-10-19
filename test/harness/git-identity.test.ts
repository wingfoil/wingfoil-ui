// task-044 AC-1 (bug-020): every commit a test makes takes its author name from the harness
// configuration, never from the OS account (a CI runner's account has no full name). Git's
// `user.useConfigOnly` disables the account fallback for the name and the email: with it a commit
// succeeds only when the configuration gives both — the closest local reproduction of the runner.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HARNESS_GIT_NAME, harnessEnv } from './fixtures/index.js';
import { git } from './run.js';
import { TempWorkspace } from './temp-workspace.js';

let ws: TempWorkspace;
let env: NodeJS.ProcessEnv;

beforeAll(async () => {
  ws = await TempWorkspace.create('wfui-task-044-identity-');
  ({ env } = await harnessEnv(ws.dir));
});

afterAll(async () => {
  await ws.dispose();
});

/** `git config --global --get <key>` with the harness environment (`undefined` when unset). */
async function harnessSetting(key: string): Promise<string | undefined> {
  const result = await ws.run('git', ['config', '--global', '--get', key], { cwd: ws.dir, env, allowFailure: true });
  return result.code === 0 ? result.stdout.trim() : undefined;
}

describe('git identity of the test harness (task-044 AC-1, bug-020)', () => {
  it('the harness configuration gives a user.name, no user.email, and turns the account fallback off', async () => {
    expect(await harnessSetting('user.name')).toBe(HARNESS_GIT_NAME);
    // Tests of unidentified users rely on no email being set.
    expect(await harnessSetting('user.email')).toBeUndefined();
    expect(await harnessSetting('user.useConfigOnly')).toBe('true');
  });

  it('a commit in a fresh clone with only user.email succeeds with the account fallback off', async () => {
    const remote = path.join(ws.dir, 'remote.git');
    const clone = path.join(ws.dir, 'clone');
    await git(ws.dir, ['init', '-q', '--bare', '-b', 'main', remote], env);
    await git(ws.dir, ['clone', '-q', remote, clone], env);
    await git(clone, ['config', 'user.email', 'jordan@example.test'], env);
    await writeFile(path.join(clone, 'from-jordan.md'), 'hi\n');
    await git(clone, ['add', '--', 'from-jordan.md'], env);
    // Explicit on the command line: the check holds whatever the harness file says about it.
    await git(clone, ['-c', 'user.useConfigOnly=true', 'commit', '-qm', 'outside: from-jordan.md'], env);
    const author = await git(clone, ['log', '-1', '--format=%an <%ae>'], env);
    expect(author.stdout.trim()).toBe(`${HARNESS_GIT_NAME} <jordan@example.test>`);
  });

  it('a commit with no email anywhere is refused: git guesses nothing from the account', async () => {
    const repo = path.join(ws.dir, 'unidentified');
    await git(ws.dir, ['init', '-q', '-b', 'main', repo], env);
    const result = await git(repo, ['commit', '-q', '--allow-empty', '-m', 'nobody'], env).catch(
      (error: unknown) => error,
    );
    expect(result).toBeInstanceOf(Error);
    expect(String(result)).toMatch(/no email was given and auto-detection is disabled/);
  });
});
