/**
 * The Given steps of the project-state scenarios (task-059 D59-12; T-12.4, T-12.5, T-12.6, R-01.5,
 * R-01.7, M-03.2, M-04.3) on a copy of the `custom` fixture built with a CLI ≥ 0.3, for the server
 * tests of task-059 and task-074 and the e2e of task-065 … task-067. Moves have a WingFoil verb
 * where one exists, run as a team member and dated after the fixture's own commits; the `draft` of
 * T-12.5 has none from `planning` and is the harness's hand transition (a commit outside the UI, as
 * the custom builder's own). The sw-life-cycle preset is {@link usePresetUiConfig}, applied
 * separately.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pinnedCli, pinnedVersion } from '../cli.js';
import { git } from '../run.js';
import { customGovernance, type Fixture } from './builder.js';
import { HELD_RELEASE, releaseHeldRelease, submitToReleasing } from './held-gates.js';
import { FixtureProject } from './project.js';

/** The release {@link addSecondRelease} adds (`version: v0.2`). */
export const SECOND_RELEASE = 'minor-v0.2';

function project(fixture: Fixture, minutes: number): FixtureProject {
  if (fixture.kind !== 'custom')
    throw new Error(`the progress variants are custom fixture variants, not ${fixture.kind}`);
  if (customGovernance(pinnedVersion()) !== 'packs')
    throw new Error('the progress variants need the packs’ governance');
  return new FixtureProject({
    dir: fixture.dir,
    cli: pinnedCli(),
    cliVersion: pinnedVersion(),
    now: new Date(fixture.now.getTime() + minutes * 60 * 1000),
    env: fixture.env,
  });
}

/**
 * T-12.4, T-12.6: `minor-v0.1` released (two submits by Alex, Morgan's approve) and `minor-v0.2`
 * (`version: v0.2`) added by Casey and submitted twice, to `in-development`.
 */
export async function addSecondRelease(fixture: Fixture): Promise<void> {
  await submitToReleasing(fixture);
  await releaseHeldRelease(fixture);
  const p = project(fixture, 60);
  const rel = await p.add('Casey', 'release', 'Minor v0.2', { kind: 'minor', version: 'v0.2', 'release-line': 'v1' });
  if (rel.id !== SECOND_RELEASE) throw new Error(`the second release is ${rel.id}, not ${SECOND_RELEASE}`);
  await p.editFrontmatter(rel.path, {
    pillar: '"S"',
    features: '[S2]',
    requirements: '"docs/03_backlog/04_backlog/by-release/v0.2.json"',
  });
  await p.submit('Casey', rel.id);
  await p.submit('Casey', rel.id);
}

/** The file of element `id`, relative to the fixture (a `<id>.md` git tracks). */
async function elementFile(fixture: Fixture, id: string): Promise<string> {
  const files = (await git(fixture.dir, ['ls-files', '-z'], fixture.env)).stdout.split('\0');
  const found = files.find((f) => path.basename(f) === `${id}.md`);
  if (!found) throw new Error(`no file for ${id}`);
  return found;
}

/** T-12.5: the only release `minor-v0.1` back in `draft` (`planning → draft`, by hand). */
export async function draftRelease(fixture: Fixture): Promise<void> {
  const file = await elementFile(fixture, HELD_RELEASE);
  await project(fixture, 30).handTransition('Alex', 'release', HELD_RELEASE, file, 'planning', 'draft');
}

/**
 * R-01.5, R-01.7, M-03.2, M-04.3: the top-level field `field` of element `id`'s frontmatter set to
 * `value` — its line replaced when the template has it (`ref: ""`), else added — and committed
 * outside the UI by the fixture's current identity.
 */
export async function setFrontmatterValue(fixture: Fixture, id: string, field: string, value: string): Promise<void> {
  const file = await elementFile(fixture, id);
  const full = path.join(fixture.dir, file);
  const text = await readFile(full, 'utf8');
  const close = text.indexOf('\n---', 3);
  if (!text.startsWith('---\n') || close === -1) throw new Error(`${file} has no frontmatter`);
  const head = text.slice(0, close);
  const line = new RegExp(`^${field}:.*$`, 'm');
  const written = `${field}: ${JSON.stringify(value)}`;
  const edited = line.test(head) ? head.replace(line, () => written) : `${head}\n${written}`;
  await writeFile(full, `${edited}${text.slice(close)}`);
  await git(fixture.dir, ['add', '--', file], fixture.env);
  await git(fixture.dir, ['commit', '-q', '-m', `docs: ${field} on ${id}`, '--', file], fixture.env);
}

/** The `ui.yaml` of {@link kanbanCompletion}: one reference pattern, categorised `requirement`. */
export const KANBAN_COMPLETION_UI_YAML =
  "version: 1\ntaxonomy:\n  patterns:\n    - { match: '^US-', category: requirement }\n";

/** The kanban standard elements {@link kanbanCompletion} links to its reference. */
const KANBAN_ELEMENTS = [
  'task-001-login-form',
  'task-002-password-reset',
  'task-003-logout',
  'task-004-session-timeout',
  'bug-001-crash-on-save',
] as const;

/**
 * X-10.4's Given (task-065 D65-14, Q6 (a)): the kanban `fixture` showing a project completion of
 * 40 % — a minimal `ui.yaml` mapping the pattern `^US-` to `requirement` (committed alone), the value
 * `US-01` in `ref` on the 5 standard elements (each committed outside the UI by the fixture's
 * identity), and `task-001-login-form` approved by Morgan with the pinned CLI (dated after the
 * fixture's commits): 2 of the 5 linked elements done (with `task-003-logout`) — 40 %. The identity
 * of a copy is set afterwards (`actAs`), as the fixture builder leaves it.
 */
export async function kanbanCompletion(fixture: Fixture): Promise<void> {
  if (fixture.kind !== 'kanban') throw new Error(`kanbanCompletion is a kanban fixture variant, not ${fixture.kind}`);
  await writeFile(path.join(fixture.dir, '.wingfoil', 'ui.yaml'), KANBAN_COMPLETION_UI_YAML);
  await git(fixture.dir, ['add', '--', '.wingfoil/ui.yaml'], fixture.env);
  await git(
    fixture.dir,
    ['commit', '-q', '-m', 'chore(ui): a reference pattern', '--', '.wingfoil/ui.yaml'],
    fixture.env,
  );
  for (const id of KANBAN_ELEMENTS) await setFrontmatterValue(fixture, id, 'ref', 'US-01');
  const p = new FixtureProject({
    dir: fixture.dir,
    cli: pinnedCli(),
    cliVersion: pinnedVersion(),
    now: new Date(fixture.now.getTime() + 30 * 60 * 1000),
    env: fixture.env,
  });
  await p.approve('Morgan', 'task-001-login-form');
  await p.as('Alex');
}
