/**
 * The Given steps of S-24.5 and S-24.6 (task-069; RP3-16 P4) on a copy of the `custom` fixture
 * built with a CLI ≥ 0.3 (the packs' governance, where `release` `releasing` and `release-line`
 * `active` are gates): every move is a WingFoil verb run as a team member (W-34: no hand-set
 * `status:`), dated after the fixture's own commits. The sw-life-cycle preset that holds those two
 * gates is {@link usePresetUiConfig}, applied separately.
 */
import { pinnedCli, pinnedVersion } from '../cli.js';
import { customGovernance, type Fixture } from './builder.js';
import { FixtureProject } from './project.js';

/** The id of the release the custom fixture adds (`release-line: v1`, `version: v0.1`). */
export const HELD_RELEASE = 'minor-v0.1';
/** The id of the release line {@link addReleaseLine} adds (`version: v1`). */
export const RELEASE_LINE = 'rl-v1';

function project(fixture: Fixture, minutes: number): FixtureProject {
  if (fixture.kind !== 'custom') throw new Error(`the held gates are a custom fixture variant, not ${fixture.kind}`);
  if (customGovernance(pinnedVersion()) !== 'packs') throw new Error('the held gates need the packs’ governance');
  return new FixtureProject({
    dir: fixture.dir,
    cli: pinnedCli(),
    cliVersion: pinnedVersion(),
    now: new Date(fixture.now.getTime() + minutes * 60 * 1000),
    env: fixture.env,
  });
}

/** S-24.5: `minor-v0.1` submitted by Alex from `planning` to `releasing` (a gate), two submits. */
export async function submitToReleasing(fixture: Fixture): Promise<void> {
  const p = project(fixture, 30);
  await p.submit('Alex', HELD_RELEASE);
  await p.submit('Alex', HELD_RELEASE);
}

/**
 * S-24.6: the release line `rl-v1` (`version: v1`) added and submitted by Casey, approved into
 * `active` by Morgan; `minor-v0.1` (`release-line: v1`) stays in `planning`, so it references the
 * line by its `version`.
 */
export async function addReleaseLine(fixture: Fixture): Promise<void> {
  const p = project(fixture, 40);
  const line = await p.add('Casey', 'release-line', 'Line v1', { version: 'v1' });
  if (line.id !== RELEASE_LINE) throw new Error(`the release line is ${line.id}, not ${RELEASE_LINE}`);
  await p.submit('Casey', line.id);
  await p.approve('Morgan', line.id);
}

/** `minor-v0.1`, in `releasing`, approved by Morgan into `released` (its line's reference done). */
export async function releaseHeldRelease(fixture: Fixture): Promise<void> {
  await project(fixture, 50).approve('Morgan', HELD_RELEASE);
}
