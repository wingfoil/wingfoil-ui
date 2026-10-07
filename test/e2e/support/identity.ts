/**
 * "I am <member>" on a fixture copy (task-019): the project's git identity is the email the console
 * matches against `dna.team.members` (task-009), so a scenario's user is set with
 * `git config user.email` in the copy before the console starts.
 */
import type { Fixture } from '../../harness/fixtures/index.js';
import { memberByName, OUTSIDER, type MemberName } from '../../harness/fixtures/index.js';
import { git } from '../../harness/run.js';

/** Make `name` (a member of the standard team, or the outsider Riley) the user of `fixture`. */
export async function actAs(fixture: Fixture, name: MemberName | 'Riley'): Promise<void> {
  const email = name === 'Riley' ? OUTSIDER.email : memberByName(name).email;
  await git(fixture.dir, ['config', 'user.email', email], fixture.env);
}
