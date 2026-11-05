// task-044 AC-1 (bug-020): every commit a test makes takes its author name from the harness
// configuration, never from the OS account (a CI runner's account has no full name). Git's
// `user.useConfigOnly` disables the account fallback for the name and the email: with it a commit
// succeeds only when the configuration gives both — the closest local reproduction of the runner.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildFixture, HARNESS_GIT_NAME, harnessEnv } from './fixtures/index.js';
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

/**
 * The identity agent sessions of this repository export (task-050): a stand-in of the same shape,
 * the four variables git reads before any configuration.
 */
const AGENT_IDENTITY = {
  GIT_AUTHOR_NAME: 'Agent Stand-in',
  GIT_AUTHOR_EMAIL: 'agent-stand-in@example.test',
  GIT_COMMITTER_NAME: 'Agent Stand-in',
  GIT_COMMITTER_EMAIL: 'agent-stand-in@example.test',
} as const;

describe("an agent session's identity variables never reach a fixture commit (task-050 AC-4)", () => {
  it('a fixture built under inherited GIT_AUTHOR_* and GIT_COMMITTER_* carries its members as author and committer', async () => {
    const saved = Object.fromEntries(Object.keys(AGENT_IDENTITY).map((key) => [key, process.env[key]]));
    Object.assign(process.env, AGENT_IDENTITY);
    try {
      const fx = await buildFixture('kanban', { root: path.join(ws.dir, 'agent-session') });
      const log = await git(fx.dir, ['log', '--all', '--format=%an <%ae>|%cn <%ce>'], fx.env);
      const identities = new Set(log.stdout.trim().split('\n'));
      expect(identities.size).toBeGreaterThan(0);
      for (const line of identities) {
        expect(line).not.toContain(AGENT_IDENTITY.GIT_AUTHOR_EMAIL);
        expect(line).not.toContain(AGENT_IDENTITY.GIT_AUTHOR_NAME);
      }
      // The current identity of the built fixture is its member's (Alex), not the session's.
      await git(fx.dir, ['commit', '-q', '--allow-empty', '-m', 'as the fixture'], fx.env);
      const last = await git(fx.dir, ['log', '-1', '--format=%an <%ae>|%cn <%ce>'], fx.env);
      expect(last.stdout.trim()).toMatch(/^[^|]*<alex@example\.test>\|[^|]*<alex@example\.test>$/);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }, 120_000);
});
