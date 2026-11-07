/**
 * The hostile-text variant (task-056, bug-027, RP3-18 K1): on a copy of the `kanban` fixture, one
 * task whose repository and commit texts hold what a hostile committer or hook can write — a bidi
 * override (U+202E), a zero-width space (U+200B), ESC, BEL, a line separator (U+2028), a
 * 10 000-character line, the project's absolute folder and the home folder:
 *
 * | Where | What |
 * |-------|------|
 * | the title (frontmatter, so `memory search`) | U+202E and U+200B |
 * | the body (document content, class (d)) | U+202E |
 * | the submit commit | Jordan's committed `user.name` holds U+202E; his email is the member's |
 * | the reject commit (`memory reject`) | Morgan's committed `user.name` holds U+202E; the reason holds every hostile text but the controls WingFoil refuses in a `--reason` |
 * | a plain edit commit of the element file | subject and `Reason:` line hold every hostile text |
 *
 * Every transition is the CLI's verb (`memory submit`, `memory reject`); the edit commit changes the
 * body only, never `status:` (W-34). Scenario-local: the base fixture stays as it is.
 */
import { homedir } from 'node:os';
import path from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { pinnedCli, pinnedVersion, type CliBuild } from '../cli.js';
import { git } from '../run.js';
import type { Fixture } from './builder.js';
import { FixtureProject } from './project.js';
import type { MemberName } from './team.js';

/** Options of {@link addHostileText}. */
export interface HostileOptions {
  /** The CLI build the fixture was made with (default: the pinned one). */
  cli?: CliBuild;
  /** Its version (default: the pinned one). */
  cliVersion?: string;
}

/** What {@link addHostileText} wrote. */
export interface HostileElement {
  id: string;
  /** Project-relative path of the element file. */
  path: string;
  /** The title as written to the file. */
  title: string;
  /** The text of the body line, as written. */
  bodyLine: string;
  /** Committed `user.name` of the submitter (Jordan) and of the rejecter (Morgan). */
  names: Record<'Jordan' | 'Morgan', string>;
  /** The reject's reason, as passed to `memory reject`. */
  reason: string;
  /** The plain edit commit's subject. */
  subject: string;
  /** The plain edit commit's `Reason:` text. */
  editReason: string;
}

/** Characters of the long line of every hostile text. */
export const HOSTILE_LINE = 10_000;

const RLO = String.fromCodePoint(0x202e);
const ZWSP = String.fromCodePoint(0x200b);
const ESC = String.fromCodePoint(0x1b);
const BEL = String.fromCodePoint(0x07);
const LSEP = String.fromCodePoint(0x2028);

/**
 * One hostile text naming `dir` (the project) and the home folder; with `controls`, ESC and BEL too —
 * WingFoil 0.3.1 refuses a `--reason` holding a control character but tab and newline, or U+2028
 * (exit 2; U+202E and U+200B pass), so the reject's reason has none, while a commit written by hand (or a hook) may.
 */
function hostile(label: string, dir: string, controls: boolean): string {
  const cc = controls ? ` ${ESC}[31m ${BEL}` : '';
  const ls = controls ? ` ${LSEP}` : '';
  return `${label} ${RLO}txt.exe${ZWSP}${cc} ${'L'.repeat(HOSTILE_LINE)} at ${dir}/docs/x.md and ${homedir()}/secret${ls} end`;
}

/**
 * Add, submit, reject and edit the hostile task on `fixture` (a `kanban` fixture or a copy of one).
 * The commits are dated after the fixture's own (its clock + 40 min, one second apart).
 */
export async function addHostileText(fixture: Fixture, options: HostileOptions = {}): Promise<HostileElement> {
  if (fixture.kind !== 'kanban')
    throw new Error(`the hostile texts are added to a kanban fixture, not ${fixture.kind}`);
  const p = new FixtureProject({
    dir: fixture.dir,
    cli: options.cli ?? pinnedCli(),
    cliVersion: options.cliVersion ?? pinnedVersion(),
    now: new Date(fixture.now.getTime() + 40 * 60 * 1000),
    env: fixture.env,
  });
  const names = { Jordan: `Jordan ${RLO}nadroJ`, Morgan: `Morgan ${RLO}nagroM` };
  /** Commit as `member` under a committed name that is not the DNA's (the email stays the member's). */
  const asNamed = async (member: MemberName & keyof typeof names): Promise<void> => {
    await p.as(member);
    await git(fixture.dir, ['config', 'user.name', names[member]], fixture.env);
  };

  const el = await p.add('Jordan', 'task', 'Hostile title');
  const title = `Hostile ${RLO}eltit${ZWSP} title`;
  await p.editFrontmatter(el.path, { title: JSON.stringify(title) });
  const bodyLine = `Body ${RLO}text${ZWSP} as written`;
  const file = path.join(fixture.dir, el.path);
  await writeFile(file, `${await readFile(file, 'utf8')}\n${bodyLine}\n`);
  await p.commitAll('docs: hostile title', 'elements');

  await asNamed('Jordan');
  await p.wingfoil(['memory', 'submit', el.id]);
  await asNamed('Morgan');
  const reason = hostile('Rejected', fixture.dir, false);
  await p.wingfoil(['memory', 'reject', el.id, '--reason', reason]);

  await asNamed('Jordan');
  const subject = hostile('edit', fixture.dir, true);
  const editReason = hostile('because', fixture.dir, true);
  await writeFile(file, `${await readFile(file, 'utf8')}\nEdited.\n`);
  await p.commitAll(`${subject}\n\nReason: ${editReason}\n`, 'elements');

  await p.as('Alex');
  return { id: el.id, path: el.path, title, bodyLine, names, reason, subject, editReason };
}
