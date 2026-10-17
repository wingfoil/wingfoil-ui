/**
 * The bare remote of a fixture copy (each copy has its own, `origin`; `test/harness/fixtures`):
 * what the e2e specs read or change on the remote side (task-038, Wave 5 C8; task-039 and task-040 append here).
 */
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Fixture } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';

/** The commit the remote's `branch` points at (G-13.1: "the remote's branch is at that commit"). */
export async function remoteHead(fixture: Fixture, branch = 'main'): Promise<string> {
  const { stdout } = await git(
    fixture.remoteDir,
    ['rev-parse', '--verify', `refs/heads/${branch}^{commit}`],
    fixture.env,
  );
  return stdout.trim();
}

/**
 * Commit `file` = `content` on the remote's `main` from another clone (task-039; the copy becomes
 * behind once fetched). The clone is made next to the copy and removed after the push.
 */
export async function remoteCommit(fixture: Fixture, file: string, content: string): Promise<void> {
  const dir = await mkdtemp(path.join(path.dirname(fixture.dir), 'other-'));
  try {
    await git(path.dirname(dir), ['clone', '-q', fixture.remoteDir, dir], fixture.env);
    await git(dir, ['config', 'user.email', 'jordan@example.test'], fixture.env);
    await writeFile(path.join(dir, file), content);
    await git(dir, ['add', '--', file], fixture.env);
    await git(dir, ['commit', '-qm', `outside: ${file}`], fixture.env);
    await git(dir, ['push', '-q', 'origin', 'HEAD:main'], fixture.env);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Point the copy's `origin` at `url` (task-039: an unreachable or authenticating remote). */
export async function setRemoteUrl(fixture: Fixture, url: string): Promise<void> {
  await git(fixture.dir, ['remote', 'set-url', 'origin', url], fixture.env);
}

/** Fetch the copy's `origin` with git (task-040: "… and it has been fetched"). */
export async function fetchCopy(fixture: Fixture): Promise<void> {
  await git(fixture.dir, ['fetch', '-q', 'origin'], fixture.env);
}

/**
 * Install `script` as the remote's `pre-receive` hook (task-040, D40-9): `git-receive-pack` runs it
 * for every push to this local remote — to decline a push with a message, or to hold one. Returns the
 * hook's path (a held hook is found by it with `pgrep -f`).
 */
export async function remoteHook(fixture: Fixture, script: string): Promise<string> {
  const hook = path.join(fixture.remoteDir, 'hooks', 'pre-receive');
  await writeFile(hook, `#!/bin/sh\n${script}\n`);
  await chmod(hook, 0o755);
  return hook;
}
