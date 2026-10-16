/**
 * The bare `origin` of a fixture copy, moved "by someone else" (Wave 5, C8: the file is task-038's,
 * with `remoteHead`; task-039 appends the functions below).
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { git } from '../../harness/run.js';
import type { Fixture } from '../../harness/fixtures/index.js';

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
