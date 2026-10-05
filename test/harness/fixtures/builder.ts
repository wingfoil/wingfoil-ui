/**
 * The e2e fixture builder (`02_bdd/00_conventions.md` *Fixtures*, e2e-smoke `fixture-project`):
 * throwaway git repositories built with a WingFoil CLI build (the pinned one by default), each with
 * a bare remote next to it.
 */
import { cp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pinnedCli, pinnedVersion, REPO_ROOT, type CliBuild } from '../cli.js';
import { FixtureProject } from './project.js';
import { STANDARD_AGENT, STANDARD_TEAM } from './team.js';
import { UNKNOWN_MEMORY_YAML, UNKNOWN_TEMPLATES } from './unknown-schema.js';

/** The three fixtures of the BDD conventions (`@fx-kanban`, `@fx-custom`, `@fx-unknown`). */
export type FixtureKind = 'kanban' | 'custom' | 'unknown';

/** Every fixture kind. */
export const FIXTURE_KINDS: readonly FixtureKind[] = ['kanban', 'custom', 'unknown'];

/** Options of {@link buildFixture}. */
export interface BuildOptions {
  /** Directory that receives `<kind>/` and `remotes/<kind>.git` (created). */
  root: string;
  /** CLI build to use (default: the pinned one). */
  cli?: CliBuild;
  /** Version of `cli` (default: the pinned version). */
  cliVersion?: string;
  /** Test clock (default: now). */
  now?: Date;
}

/** A built fixture. */
export interface Fixture {
  kind: FixtureKind;
  /** `dna.project.name`, equal to the kind. */
  name: string;
  /** Working directory of the fixture repository. */
  dir: string;
  /** Bare remote the fixture tracks as `origin`. */
  remoteDir: string;
  /** `file://` URL of the remote. */
  remoteUrl: string;
  /** Test clock the fixture was built with. */
  now: Date;
  /** Environment of every process run on the fixture: isolated git configuration and home. */
  env: NodeJS.ProcessEnv;
  /** Home directory of `env` (`HOME`, `USERPROFILE`; XDG directories under it). */
  home: string;
}

/** Environment of the processes run under `root`, and its home directory. */
export interface HarnessEnv {
  env: NodeJS.ProcessEnv;
  home: string;
}

/**
 * Environment for every process of a fixture under `root`: git reads only the repository's own
 * configuration plus `root/.gitconfig` (no user or system settings such as commit signing), no
 * inherited `GIT_*` variable (e.g. `GIT_INDEX_FILE` from a hook), and the home and XDG
 * directories point into `root/home` (default clone folder `~/projects`, OS state directory).
 */
export async function harnessEnv(root: string): Promise<HarnessEnv> {
  await mkdir(root, { recursive: true });
  const home = path.join(root, 'home');
  await mkdir(home, { recursive: true });
  const gitconfig = path.join(root, '.gitconfig');
  await writeFile(gitconfig, '[init]\n\tdefaultBranch = main\n[commit]\n\tgpgsign = false\n[tag]\n\tgpgsign = false\n');
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('GIT_') || key.startsWith('XDG_')) delete env[key];
  }
  Object.assign(env, {
    GIT_CONFIG_GLOBAL: gitconfig,
    GIT_CONFIG_NOSYSTEM: '1',
    HOME: home,
    USERPROFILE: home,
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
    APPDATA: path.join(home, 'AppData', 'Roaming'),
  });
  return { env, home };
}

/** Build the `kind` fixture under `options.root`. */
export async function buildFixture(kind: FixtureKind, options: BuildOptions): Promise<Fixture> {
  const now = options.now ?? new Date();
  const { env, home } = await harnessEnv(options.root);
  const dir = path.join(options.root, kind);
  const remoteDir = path.join(options.root, 'remotes', `${kind}.git`);
  const project = new FixtureProject({
    dir,
    cli: options.cli ?? pinnedCli(),
    cliVersion: options.cliVersion ?? pinnedVersion(),
    now,
    env,
  });
  await project.init(kind);
  if (kind === 'custom') await importGovernance(project);
  else await project.wingfoil(['init', '--template', 'Kanban'], 'setup');
  if (kind === 'unknown') await writeUnknownSchema(project);
  await setUpDna(project, kind);
  await BUILDERS[kind](project);
  await project.as('Alex');
  const remoteUrl = await project.publish(remoteDir);
  return { kind, name: kind, dir, remoteDir, remoteUrl, now, env, home };
}

/** Custom fixture: this repository's `.wingfoil/` and `docs/01_vision/`. */
async function importGovernance(project: FixtureProject): Promise<void> {
  await cp(path.join(REPO_ROOT, '.wingfoil'), path.join(project.dir, '.wingfoil'), { recursive: true });
  await cp(path.join(REPO_ROOT, 'docs', '01_vision'), path.join(project.dir, 'docs', '01_vision'), { recursive: true });
  await project.commitAll('chore(wingfoil): import the WingFoil UI governance (.wingfoil/, docs/01_vision/)', 'setup');
}

/** Unknown fixture: hand-written `memory.yaml` with the types `story` and `note`. */
async function writeUnknownSchema(project: FixtureProject): Promise<void> {
  await writeFile(path.join(project.dir, '.wingfoil', 'memory.yaml'), UNKNOWN_MEMORY_YAML);
  for (const [name, body] of Object.entries(UNKNOWN_TEMPLATES)) {
    await writeFile(path.join(project.dir, '.wingfoil', 'memory', 'templates', name), body);
  }
  await project.commitAll('chore(wingfoil): hand-written memory.yaml (story, note)', 'setup');
}

interface DnaTeam {
  members: { name: string }[];
  agents?: { name: string }[];
}

/** `dna.project.name` = the kind; the team replaced by the standard team. */
async function setUpDna(project: FixtureProject, kind: FixtureKind): Promise<void> {
  await project.wingfoilAs('Alex', ['dna', 'set', 'project.name', '--value', kind], 'setup');
  const team = (await project.wingfoil(['dna', 'show', 'team'], 'setup')) as DnaTeam;
  for (const member of team.members) {
    await project.wingfoil(['dna', 'remove', 'team.members', '--value', member.name], 'setup');
  }
  for (const agent of team.agents ?? []) {
    await project.wingfoil(['dna', 'remove', 'team.agents', '--value', agent.name], 'setup');
  }
  for (const member of STANDARD_TEAM) {
    await project.wingfoil(
      [
        'dna',
        'add',
        'team.members',
        '--value',
        member.name,
        '--entry-email',
        member.email,
        '--entry-roles',
        member.roles.join(','),
      ],
      'setup',
    );
  }
  await project.wingfoil(
    [
      'dna',
      'add',
      'team.agents',
      '--value',
      STANDARD_AGENT.name,
      '--entry-executes_as',
      STANDARD_AGENT.executesAs.join(','),
      '--entry-approval_authority',
      String(STANDARD_AGENT.approvalAuthority),
    ],
    'setup',
  );
}

const BUILDERS: Record<FixtureKind, (project: FixtureProject) => Promise<void>> = {
  async kanban(p) {
    const t1 = await p.add('Jordan', 'task', 'Login form');
    await p.submit('Jordan', t1.id);
    const t2 = await p.add('Jordan', 'task', 'Password reset');
    await p.submit('Jordan', t2.id);
    await p.reject('Morgan', t2.id, 'Missing acceptance criteria');
    const t3 = await p.add('Jordan', 'task', 'Logout');
    await p.submit('Jordan', t3.id);
    await p.approve('Morgan', t3.id);
    await p.add('Jordan', 'task', 'Session timeout');
    const b1 = await p.add('Sam', 'bug', 'Crash on save');
    await p.submit('Sam', b1.id);
  },

  async custom(p) {
    // Progress elements: tasks of release v0.1 at different stages.
    const tasks: { title: string; ref: string; to: 'in-review' | 'done' | 'backlog' }[] = [
      { title: 'CLI adapter', ref: 'US-S-01', to: 'in-review' },
      { title: 'Memory list', ref: 'US-M-01', to: 'done' },
      { title: 'Element panel', ref: 'US-M-01', to: 'backlog' },
      { title: 'Themes', ref: '', to: 'backlog' },
    ];
    for (const task of tasks) {
      const el = await p.add('Jordan', 'task', task.title, { release: 'v0.1' });
      if (task.ref) await p.editFrontmatter(el.path, { ref: `"${task.ref}"` });
      await p.submit('Jordan', el.id);
      await p.approve('Morgan', el.id);
      if (task.to === 'backlog') continue;
      await p.handTransition('Jordan', 'task', el.id, el.path, 'backlog', 'in-progress');
      await p.submit('Jordan', el.id);
      if (task.to === 'in-review') continue;
      await p.approve('Morgan', el.id);
      await p.handTransition('Jordan', 'task', el.id, el.path, 'approved', 'done');
    }

    const dl1 = await p.add('Alex', 'decision-log', 'Initialise WingFoil before inception');
    await p.submit('Alex', dl1.id);
    await p.approve('Morgan', dl1.id);
    const dl2 = await p.add('Casey', 'decision-log', 'Use Fastify');
    await p.submit('Casey', dl2.id);

    const bug = await p.add('Sam', 'bug', 'Toast overlap');
    await p.editFrontmatter(bug.path, { severity: '"medium"' });
    await p.submit('Sam', bug.id);

    // Required `sard_ref` left empty (`memory add` cannot set it, W-01).
    await p.add('Alex', 'adr', 'Local server');

    const rel = await p.add('Alex', 'release', 'Minor v0.1', { kind: 'minor', version: 'v0.1', 'release-line': 'v1' });
    await p.editFrontmatter(rel.path, {
      pillar: '"S"',
      features: '[S1, M1]',
      requirements: '"docs/03_backlog/04_backlog/by-release/v0.1.json"',
    });
    await p.submit('Alex', rel.id);
  },

  async unknown(p) {
    const s1 = await p.addInState('Jordan', 'story', 'Onboarding', 'idea');
    await p.submit('Jordan', s1.id);
    const s2 = await p.addInState('Jordan', 'story', 'Billing', 'idea');
    await p.submit('Jordan', s2.id);
    await p.approve('Morgan', s2.id);
    await p.addInState('Casey', 'note', 'Kickoff', 'open');
    const n2 = await p.addInState('Casey', 'note', 'Retro', 'open');
    // A state not declared for `note`, written by hand.
    await p.handTransition('Casey', 'note', n2.id, n2.path, 'open', 'on-hold');
  },
};
