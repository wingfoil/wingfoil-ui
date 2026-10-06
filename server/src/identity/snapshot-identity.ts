/**
 * The identity read from the watched repository state (task-010, REQ-STATE-02; spec-004 §4 "rows
 * 1–6 start no process"): the effective `user.email` of the project's last checked state matched
 * against the team of its cached `dna show`. A change of either is seen by the repository watcher,
 * which moves the state and publishes `repo`; on a warm cache an identification starts no process.
 */
import type { DnaMember, Identity, ProjectEntry } from '@wingfoil-ui/contracts';
import type { SnapshotView } from '../snapshot/snapshot.js';
import type { Snapshots } from '../snapshot/snapshots.js';
import { matchIdentity } from './identity.js';
import type { IdentitySource } from './project-identity.js';

/** Who the user is in the state of `view`, against `members` (none when `dna show` failed). */
export function identityOf(view: SnapshotView, members: readonly DnaMember[]): Identity {
  return matchIdentity(view.state.email, members);
}

/**
 * The {@link IdentitySource} over the snapshot registry: `identify` opens (or reuses) the project's
 * snapshot and reads its view. Rejects with the CLI's errors of `dna show` (map them with
 * `cliErrorEnvelope`) or a git read error of the first state.
 */
export function createSnapshotIdentitySource(snapshots: Snapshots): IdentitySource {
  return {
    async identify(project: ProjectEntry): Promise<Identity> {
      const view = await (await snapshots.open(project.id, project.path)).view();
      return identityOf(view, (await view.dna()).data.team.members);
    },
  };
}
