/**
 * The bare remote of a fixture copy (each copy has its own, `origin`; `test/harness/fixtures`):
 * what the e2e specs read or change on the remote side (task-038, Wave 5 C8; task-039 appends here).
 */
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
