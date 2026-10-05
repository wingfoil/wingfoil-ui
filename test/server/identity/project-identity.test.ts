// REQ-STATE-05 / REQ-STATE-06 on the kanban fixture (real git, pinned CLI): every `@v0.1` scenario
// of `features/s/identity.feature` at API level — the screen half closes in task-016, the push to
// the page within 5 s in task-010 (here: the next evaluation already sees the change).
import type { ProjectEntry } from '@wingfoil-ui/contracts';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CliRefusedError } from '../../../server/src/cli/adapter.js';
import { CliNotFoundError } from '../../../server/src/cli/discovery.js';
import {
  createLocalIdentitySource,
  GitNotFoundError,
  projectIdentityView,
} from '../../../server/src/identity/project-identity.js';
import { LocalProcessRunner } from '../../../server/src/process/runner.js';
import { pinnedCli } from '../../harness/cli.js';
import {
  buildFixture,
  copyFixture,
  envWithoutWingfoil,
  removeCli,
  type Fixture,
} from '../../harness/fixtures/index.js';
import { git, run } from '../../harness/run.js';

let root: string;
let built: Fixture;
let copies = 0;
const runner = new LocalProcessRunner();

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(tmpdir(), 'wfui-identity-')));
  built = await buildFixture('kanban', { root: path.join(root, 'built') });
}, 600_000);

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});

/** A fresh kanban copy (its own home and global git configuration) and its list entry. */
async function fresh(): Promise<{ fx: Fixture; entry: ProjectEntry }> {
  const fx = await copyFixture(built, path.join(root, `copy-${++copies}`));
  const entry: ProjectEntry = {
    id: 'p_abcdefghijkl',
    path: fx.dir,
    name: 'kanban',
    remote: '',
    addedAt: '2026-10-05T00:00:00Z',
    roleView: '',
  };
  return { fx, entry };
}

/** Run the pinned CLI in the fixture, as a user would in a terminal. */
async function wingfoil(fx: Fixture, args: readonly string[]): Promise<void> {
  await run(process.execPath, [pinnedCli().script, ...args, '--format', 'json', '--no-interactive'], {
    cwd: fx.dir,
    env: fx.env,
  });
}

async function setMember(fx: Fixture, name: string, email: string, roles: readonly string[]): Promise<void> {
  await wingfoil(fx, ['dna', 'remove', 'team.members', '--value', name]);
  await wingfoil(fx, [
    'dna',
    'add',
    'team.members',
    '--value',
    name,
    '--entry-email',
    email,
    '--entry-roles',
    roles.join(','),
  ]);
}

const source = (fx: Fixture) => createLocalIdentitySource({ runner, env: fx.env });

describe('US-S-12 — recognised from git', () => {
  it('S-12.1 recognises a single-role member: Jordan, developer, one role view', async () => {
    const { fx, entry } = await fresh();
    await git(fx.dir, ['config', 'user.email', 'jordan@example.test'], fx.env);
    const view = await projectIdentityView(source(fx), entry);
    expect(view).toEqual({
      identity: { kind: 'member', email: 'jordan@example.test', name: 'Jordan', roles: ['developer'] },
      roleViews: ['developer'],
      roleView: 'developer',
    });
  }, 120_000);

  it('S-12.2 matches Jordan@Example.TEST regardless of letter case', async () => {
    const { fx, entry } = await fresh();
    await git(fx.dir, ['config', 'user.email', 'Jordan@Example.TEST'], fx.env);
    expect(await source(fx).identify(entry)).toMatchObject({
      kind: 'member',
      name: 'Jordan',
      email: 'Jordan@Example.TEST',
    });
  }, 120_000);

  it('S-12.3 follows a change of git email: the next evaluation is Morgan', async () => {
    const { fx, entry } = await fresh();
    const identities = source(fx);
    await git(fx.dir, ['config', 'user.email', 'jordan@example.test'], fx.env);
    expect(await identities.identify(entry)).toMatchObject({ kind: 'member', name: 'Jordan' });
    await git(fx.dir, ['config', 'user.email', 'morgan@example.test'], fx.env);
    expect(await identities.identify(entry)).toMatchObject({ kind: 'member', name: 'Morgan' });
  }, 120_000);
});

describe('US-S-13 — not in team', () => {
  it('S-13.1 marks riley@example.test as not in team, with no role view', async () => {
    const { fx, entry } = await fresh();
    await git(fx.dir, ['config', 'user.email', 'riley@example.test'], fx.env);
    expect(await projectIdentityView(source(fx), entry)).toEqual({
      identity: { kind: 'not-in-team', email: 'riley@example.test' },
      roleViews: [],
      roleView: null,
    });
  }, 120_000);

  it("S-13.3 marks Jordan as not in team once the CLI removes Jordan's entry", async () => {
    const { fx, entry } = await fresh();
    const identities = source(fx);
    await git(fx.dir, ['config', 'user.email', 'jordan@example.test'], fx.env);
    expect(await identities.identify(entry)).toMatchObject({ kind: 'member', name: 'Jordan' });
    await wingfoil(fx, ['dna', 'remove', 'team.members', '--value', 'Jordan']);
    expect(await identities.identify(entry)).toEqual({ kind: 'not-in-team', email: 'jordan@example.test' });
  }, 180_000);
});

describe('US-S-14 — no git email', () => {
  it('S-14.1 has no identity when neither the repository nor the global configuration sets it', async () => {
    const { fx, entry } = await fresh();
    await git(fx.dir, ['config', '--unset', 'user.email'], fx.env);
    expect(await projectIdentityView(source(fx), entry)).toEqual({
      identity: { kind: 'no-identity' },
      roleViews: [],
      roleView: null,
    });
  }, 120_000);

  it('S-14.2 uses the global email (Casey) when the repository sets none', async () => {
    const { fx, entry } = await fresh();
    await git(fx.dir, ['config', '--unset', 'user.email'], fx.env);
    await git(fx.dir, ['config', '--global', 'user.email', 'casey@example.test'], fx.env);
    expect(await source(fx).identify(entry)).toMatchObject({ kind: 'member', name: 'Casey', roles: ['product-owner'] });
  }, 120_000);
});

describe('US-S-15 — ambiguous identity', () => {
  it('S-15.1 then S-15.3: ambiguous for Jordan and Sam, Jordan once Sam gets an email of his own', async () => {
    const { fx, entry } = await fresh();
    const identities = source(fx);
    await setMember(fx, 'Jordan', 'shared@example.test', ['developer']);
    await setMember(fx, 'Sam', 'shared@example.test', ['reviewer']);
    await git(fx.dir, ['config', 'user.email', 'shared@example.test'], fx.env);
    expect(await projectIdentityView(identities, entry)).toEqual({
      identity: { kind: 'ambiguous', email: 'shared@example.test', members: ['Jordan', 'Sam'] },
      roleViews: [],
      roleView: null,
    });
    await setMember(fx, 'Sam', 'sam@example.test', ['reviewer']);
    expect(await identities.identify(entry)).toMatchObject({ kind: 'member', name: 'Jordan' });
  }, 300_000);
});

describe('US-S-22 — role views on the fixture', () => {
  it('S-22.2 offers Morgan exactly approver and tech-lead; a stored role no longer held falls back', async () => {
    const { fx, entry } = await fresh();
    await git(fx.dir, ['config', 'user.email', 'morgan@example.test'], fx.env);
    const view = await projectIdentityView(source(fx), { ...entry, roleView: 'developer' });
    expect(view.roleViews).toEqual(['approver', 'tech-lead']);
    expect(view.roleView).toBe('approver');
    expect((await projectIdentityView(source(fx), { ...entry, roleView: 'tech-lead' })).roleView).toBe('tech-lead');
  }, 120_000);
});

describe('failures', () => {
  it('propagates a CLI refusal of `dna show` (invalid dna.yaml)', async () => {
    const { fx, entry } = await fresh();
    await writeFile(path.join(fx.dir, '.wingfoil', 'dna.yaml'), 'team: [unclosed\n');
    await expect(source(fx).identify(entry)).rejects.toBeInstanceOf(CliRefusedError);
  }, 120_000);

  it('propagates a missing CLI', async () => {
    const { fx, entry } = await fresh();
    await removeCli(fx);
    const env = await envWithoutWingfoil(fx.env, path.join(root, `bin-${copies}`));
    const noCli = createLocalIdentitySource({ runner, env });
    await expect(noCli.identify(entry)).rejects.toBeInstanceOf(CliNotFoundError);
  }, 120_000);

  it('fails with GitNotFoundError when no git is on the PATH', async () => {
    const { fx, entry } = await fresh();
    const noGit = createLocalIdentitySource({ runner, env: { ...fx.env, PATH: '' } });
    await expect(noGit.identify(entry)).rejects.toBeInstanceOf(GitNotFoundError);
  }, 120_000);
});
