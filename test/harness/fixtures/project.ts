/**
 * A fixture project under construction: a git repository driven through the pinned WingFoil CLI
 * as the members of the standard team (`02_bdd/00_conventions.md` *Fixtures*).
 */
import { mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CliBuild } from '../cli.js';
import { git, run, type RunResult } from '../run.js';
import { memberByName, type MemberName } from './team.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Element commits start this long before `now − 3 days` and advance 1 s each (no timestamp ties). */
const ELEMENT_WINDOW_MS = 10 * 60 * 1000;

/** A step's moment relative to the test clock. */
export type Moment = 'setup' | 'elements';

/** Options shared by every fixture build. */
export interface ProjectOptions {
  /** Directory of the fixture repository (created). */
  dir: string;
  /** CLI build used to make the fixture (and linked into `node_modules/wingfoil`). */
  cli: CliBuild;
  /** Version of `cli`, written as the `wingfoil` pin of the fixture's `package.json`. */
  cliVersion: string;
  /**
   * Test clock: setup commits are dated 4 days before it; element commits 1 s apart, starting 10 min
   * before `now − 3 days` and never later than it (the last transition of every element is 3 days
   * before the clock, with no two commits sharing a timestamp).
   */
  now: Date;
  /** Environment of every process (isolated git configuration). */
  env: NodeJS.ProcessEnv;
}

/** Drives one fixture repository. */
export class FixtureProject {
  private member: MemberName = 'Alex';
  private ticks: Record<Moment, number> = { setup: 0, elements: 0 };

  constructor(readonly options: ProjectOptions) {}

  /** Directory of the repository. */
  get dir(): string {
    return this.options.dir;
  }

  private date(moment: Moment): string {
    const now = this.options.now.getTime();
    if (moment === 'setup') return new Date(now - 4 * DAY_MS + this.ticks.setup++ * 1000).toISOString();
    const at = now - 3 * DAY_MS - ELEMENT_WINDOW_MS + this.ticks.elements++ * 1000;
    if (at > now - 3 * DAY_MS) throw new Error('fixture has more element commits than its 10-minute window');
    return new Date(at).toISOString();
  }

  private env(moment: Moment): NodeJS.ProcessEnv {
    const date = this.date(moment);
    return { ...this.options.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  }

  /** `git init`, `package.json` pinning the CLI, `node_modules/wingfoil` linked, first commit. */
  async init(projectName: string): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    await git(this.dir, ['init', '-q', '-b', 'main'], this.options.env);
    await this.as('Alex');
    const pkg = {
      name: projectName,
      private: true,
      devDependencies: { wingfoil: this.options.cliVersion },
    };
    await writeFile(path.join(this.dir, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    await writeFile(path.join(this.dir, '.gitignore'), 'node_modules/\n');
    await mkdir(path.join(this.dir, 'node_modules'));
    await symlink(
      this.options.cli.packageDir,
      path.join(this.dir, 'node_modules', 'wingfoil'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    await this.commitAll('chore: initial commit', 'setup');
  }

  /** Make `name` the current identity (`git config user.name/email`). */
  async as(name: MemberName): Promise<void> {
    const member = memberByName(name);
    await git(this.dir, ['config', 'user.name', member.name], this.options.env);
    await git(this.dir, ['config', 'user.email', member.email], this.options.env);
    this.member = name;
  }

  /** The current identity. */
  get currentMember(): MemberName {
    return this.member;
  }

  /** Run the CLI as the current identity; JSON output is parsed. */
  async wingfoil(args: readonly string[], moment: Moment = 'elements'): Promise<unknown> {
    const result: RunResult = await run(
      process.execPath,
      [this.options.cli.script, ...args, '--format', 'json', '--no-interactive'],
      { cwd: this.dir, env: this.env(moment) },
    );
    const out = result.stdout.trim();
    return out ? (JSON.parse(out) as unknown) : null;
  }

  /** Run the CLI as `member`. */
  async wingfoilAs(member: MemberName, args: readonly string[], moment: Moment = 'elements'): Promise<unknown> {
    await this.as(member);
    return this.wingfoil(args, moment);
  }

  /** `memory add` as `member`; returns the new element's id and path. */
  async add(
    member: MemberName,
    type: string,
    title: string,
    set: Record<string, string> = {},
  ): Promise<{ id: string; path: string }> {
    const args = ['memory', 'add', '--type', type, '--title', title];
    for (const [k, v] of Object.entries(set)) args.push('--set', `${k}=${v}`);
    return (await this.wingfoilAs(member, args)) as { id: string; path: string };
  }

  /**
   * `memory add` for a type whose `sequence` does not start with `draft`. WingFoil 0.2.2 writes
   * `status: draft` whatever the type declares (W-21): the fixture stands for a CLI that honours
   * the first state, so the add commit is amended to carry `initialState`.
   */
  async addInState(
    member: MemberName,
    type: string,
    title: string,
    initialState: string,
  ): Promise<{ id: string; path: string }> {
    const el = await this.add(member, type, title);
    await this.editFrontmatter(el.path, { status: initialState });
    await git(this.dir, ['add', '-A'], this.options.env);
    await git(this.dir, ['commit', '-q', '--amend', '--no-edit'], this.env('elements'));
    return el;
  }

  /** `memory submit` as `member`. */
  async submit(member: MemberName, id: string): Promise<void> {
    await this.wingfoilAs(member, ['memory', 'submit', id]);
  }

  /** `memory approve` as `member`. */
  async approve(member: MemberName, id: string, reason = 'Approved'): Promise<void> {
    await this.wingfoilAs(member, ['memory', 'approve', id, '--reason', reason]);
  }

  /** `memory reject` as `member`. */
  async reject(member: MemberName, id: string, reason: string): Promise<void> {
    await this.wingfoilAs(member, ['memory', 'reject', id, '--reason', reason]);
  }

  /**
   * Set frontmatter fields of an element file by hand (fields `--set` cannot write, W-01). The
   * edit is committed by the next CLI verb on the element, as on a real project.
   */
  async editFrontmatter(relPath: string, fields: Record<string, string>): Promise<void> {
    const file = path.join(this.dir, relPath);
    let text = await readFile(file, 'utf8');
    for (const [key, value] of Object.entries(fields)) {
      const line = new RegExp(`^${key}:.*$`, 'm');
      if (!line.test(text)) throw new Error(`${relPath} has no frontmatter field ${key}`);
      text = text.replace(line, `${key}: ${value}`);
    }
    await writeFile(file, text);
  }

  /**
   * A transition 0.2.2 has no verb for (a state after a `waiting:` state, or a state written by
   * hand): set `status:` and commit with the `wf(…)` format of the CLI's state verbs.
   */
  async handTransition(
    member: MemberName,
    type: string,
    id: string,
    relPath: string,
    from: string,
    to: string,
  ): Promise<void> {
    await this.as(member);
    await this.editFrontmatter(relPath, { status: to });
    await this.commitAll(`wf(${type}): ${id} [${from} → ${to}]`, 'elements');
  }

  /** Stage everything and commit as the current identity. */
  async commitAll(message: string, moment: Moment): Promise<void> {
    await git(this.dir, ['add', '-A'], this.options.env);
    await git(this.dir, ['commit', '-q', '-m', message], this.env(moment));
  }

  /** Create a bare remote at `remoteDir`, add it as `origin` and push `main`. */
  async publish(remoteDir: string): Promise<string> {
    await mkdir(path.dirname(remoteDir), { recursive: true });
    await git(path.dirname(remoteDir), ['init', '-q', '--bare', '-b', 'main', remoteDir], this.options.env);
    const url = `file://${remoteDir}`;
    await git(this.dir, ['remote', 'add', 'origin', url], this.options.env);
    await git(this.dir, ['push', '-q', '-u', 'origin', 'main'], this.options.env);
    return url;
  }
}
