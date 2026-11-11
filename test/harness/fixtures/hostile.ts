/* eslint-disable @typescript-eslint/no-explicit-any -- the DNA file edited as parsed YAML */
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
import { parse } from 'yaml';
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

/**
 * The repository display texts of task-072 (bug-035): `label`, then U+202E and ESC — the two
 * characters every display field must show as `\u202e` and `\x1b` (AC-2).
 */
export function hostileMark(label: string): string {
  return `${label} ${RLO}x${ESC}y`;
}

/** {@link hostileMark} as the API serves it (escaped once). */
export function escapedMark(label: string): string {
  return `${label} \\u202ex\\x1by`;
}

/** `text` as a YAML (and JSON) double-quoted scalar, U+202E and the controls written as escapes. */
function yamlString(text: string): string {
  return JSON.stringify(text).replace(/\u202e/g, '\\u202e');
}

/** What {@link addHostileRepositoryText} wrote. */
export interface HostileRepository {
  /** The identified user (Alex) under the hostile name and email. */
  member: { name: string; email: string };
  /** The hostile directive's id. */
  directive: string;
  /** The element whose history holds a state written by hand (`from` and `to`). */
  handState: { id: string; path: string; state: string };
  /** The `origin` URL. */
  remote: string;
}

/** The labels of the DNA texts {@link addHostileRepositoryText} writes (each through {@link hostileMark}). */
export const HOSTILE_DNA_LABELS = {
  projectName: 'Project',
  description: 'Description',
  methodology: 'Method',
  module: 'Module',
  moduleDescription: 'Module text',
  modulePath: 'module/path',
  technology: 'Tech',
  category: 'Category',
  version: 'Version',
  notes: 'Notes',
  stackMethodology: 'Practice',
  phase: 'Phase',
  roleDescription: 'Role text',
  agent: 'Agent',
  docsPath: 'hostile/path',
  member: 'Alex',
  directiveName: 'Directive',
  directiveTitle: 'Directive title',
  workflow: 'Workflow',
  state: 'state',
} as const;

/**
 * The repository display texts of task-072 (bug-035, D72-11) on `fixture` (a `kanban` fixture or a
 * copy of one): U+202E and ESC ({@link hostileMark}) in the DNA (project, a module, a technology, a
 * methodology, a role description, the agent's name, a `paths` value), in the name and email of
 * the identified user (Alex, the fixture's last identity — his git `user.email` follows), in a custom
 * directive's `name` and `title`, in a custom workflow's `description`, in the `origin` URL (set in place of the
 * fixture's own remote, never fetched), and in a state written by hand on a new task and set back (its history's `from` and
 * `to`). The DNA, the directive and the workflow are written to their files (the CLI has no verb
 * for them) and committed under the harness identity; the task is added with `memory add`.
 */
export async function addHostileRepositoryText(
  fixture: Fixture,
  options: HostileOptions = {},
): Promise<HostileRepository> {
  if (fixture.kind !== 'kanban')
    throw new Error(`the hostile texts are added to a kanban fixture, not ${fixture.kind}`);
  const L = HOSTILE_DNA_LABELS;
  const p = new FixtureProject({
    dir: fixture.dir,
    cli: options.cli ?? pinnedCli(),
    cliVersion: options.cliVersion ?? pinnedVersion(),
    now: new Date(fixture.now.getTime() + 50 * 60 * 1000),
    env: fixture.env,
  });
  const wingfoil = path.join(fixture.dir, '.wingfoil');

  const dnaFile = path.join(wingfoil, 'dna.yaml');
  const dna = parse(await readFile(dnaFile, 'utf8')) as Record<string, any>;
  dna['project'] = {
    ...dna['project'],
    name: hostileMark(L.projectName),
    description: hostileMark(L.description),
    methodology: hostileMark(L.methodology),
  };
  dna['modules'] = [
    ...(dna['modules'] ?? []),
    { name: hostileMark(L.module), description: hostileMark(L.moduleDescription), path: hostileMark(L.modulePath) },
  ];
  dna['stacks'] = {
    ...dna['stacks'],
    technologies: [
      ...(dna['stacks']?.technologies ?? []),
      {
        name: hostileMark(L.technology),
        category: hostileMark(L.category),
        version: hostileMark(L.version),
        notes: hostileMark(L.notes),
      },
    ],
    methodologies: [
      ...(dna['stacks']?.methodologies ?? []),
      { name: hostileMark(L.stackMethodology), phase: hostileMark(L.phase) },
    ],
  };
  const team = dna['team'];
  team.roles[0].description = hostileMark(L.roleDescription);
  team.agents[0].name = hostileMark(L.agent);
  const member = { name: hostileMark(L.member), email: `alex${RLO}${ESC}@example.test` };
  const alex = team.members.find((m: { name: string }) => m.name === 'Alex');
  alex.name = member.name;
  alex.email = member.email;
  dna['paths'] = { ...dna['paths'], hostile: [hostileMark(L.docsPath)] };
  // JSON is YAML: every string a double-quoted scalar, the characters as escapes.
  await writeFile(dnaFile, `${JSON.stringify(dna, null, 1).replace(/\u202e/g, '\\u202e')}\n`);

  const directive = 'hostile-directive';
  await writeFile(
    path.join(wingfoil, 'directives', 'custom', `${directive}.md`),
    [
      '---',
      `id: ${directive}`,
      `name: ${yamlString(hostileMark(L.directiveName))}`,
      'type: directive',
      'kind: custom',
      `title: ${yamlString(hostileMark(L.directiveTitle))}`,
      'format: 1',
      '---',
      '',
      '# A hostile directive',
      '',
      'Its name and title hold a bidi override and a control character.',
      '',
    ].join('\n'),
  );

  const workflowFile = path.join(wingfoil, 'workflows', 'custom', 'bug-ingest.yaml');
  const workflow = await readFile(workflowFile, 'utf8');
  if (!/^description: .*$/m.test(workflow)) throw new Error('bug-ingest.yaml has no top-level description');
  await writeFile(
    workflowFile,
    workflow.replace(/^description: .*$/m, `description: ${yamlString(hostileMark(L.workflow))}`),
  );
  await p.commitAll('docs: hostile repository texts', 'elements');

  // The identified user's git email is the member's (the identity is matched by email).
  await git(fixture.dir, ['config', 'user.email', member.email], fixture.env);

  const el = await p.add('Jordan', 'task', 'Hand state');
  const state = hostileMark(L.state);
  await p.handCommit('Jordan', el.path, { status: yamlString(state) }, 'edit: a state written by hand');
  await p.handCommit('Jordan', el.path, { status: 'draft' }, 'edit: the state set back');
  await p.as('Alex');
  await git(fixture.dir, ['config', 'user.name', member.name], fixture.env);
  await git(fixture.dir, ['config', 'user.email', member.email], fixture.env);

  const remote = `https://example.test/r${RLO}o${ESC}.git`;
  await git(fixture.dir, ['remote', 'set-url', 'origin', remote], fixture.env);
  return { member, directive, handState: { id: el.id, path: el.path, state }, remote };
}
