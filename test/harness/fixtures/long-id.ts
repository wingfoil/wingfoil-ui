/**
 * The long-id variant (task-057, spec-011 §8, dl-009 action 9): on a copy of the `kanban` fixture,
 * a task whose title gives an id longer than 100 characters — 252 by default, the longest id
 * WingFoil can write (`<id>.md` is a 255-byte file name; a longer one fails with `ENAMETOOLONG`,
 * task-057 design P1) — added and submitted with the CLI, so that it can be opened and decided.
 * Scenario-local: the base fixture and its figures (T-12) stay as they are.
 */
import { pinnedCli, pinnedVersion, type CliBuild } from '../cli.js';
import type { Fixture } from './builder.js';
import { FixtureProject } from './project.js';

/** The longest id WingFoil writes: 252 characters plus `.md` make a 255-byte file name. */
export const LONG_ID_MAX = 252;

/** Options of {@link addLongIdElement}. */
export interface LongIdOptions {
  /** Length of the id, from 101 to {@link LONG_ID_MAX} (default: {@link LONG_ID_MAX}). */
  length?: number;
  /** Submit it (`draft → pending`, ready for Approve and Reject; default) or leave it in `draft`. */
  submit?: boolean;
  /** The CLI build the fixture was made with (default: the pinned one). */
  cli?: CliBuild;
  /** Its version (default: the pinned one). */
  cliVersion?: string;
}

/** The element {@link addLongIdElement} made. */
export interface LongIdElement {
  id: string;
  path: string;
  title: string;
}

/** Words of the title (ASCII: WingFoil's slug drops other letters, P1). */
const WORDS = ['long', 'identifier', 'reaches', 'the', 'file', 'name', 'limit'];

/** A slug of exactly `length` characters made of {@link WORDS}, never ending with `-`. */
function slugOf(length: number): string {
  let slug = '';
  for (let i = 0; slug.length < length; i += 1) slug += `${slug === '' ? '' : '-'}${WORDS[i % WORDS.length]}`;
  slug = slug.slice(0, length);
  return slug.endsWith('-') ? `${slug.slice(0, -1)}x` : slug;
}

/**
 * Add, as Jordan, a task whose id is `length` characters long to `fixture` (a `kanban` fixture or
 * a copy of one) and, unless `submit` is `false`, submit it. The commits are dated after the
 * fixture's own (its clock + 30 min, one second apart). Throws when the CLI makes an id of
 * another length (e.g. a fourth digit in the number).
 */
export async function addLongIdElement(fixture: Fixture, options: LongIdOptions = {}): Promise<LongIdElement> {
  const length = options.length ?? LONG_ID_MAX;
  if (fixture.kind !== 'kanban')
    throw new Error(`the long-id element is added to a kanban fixture, not ${fixture.kind}`);
  if (!Number.isInteger(length) || length <= 100 || length > LONG_ID_MAX) {
    throw new Error(`a long id has 101 to ${LONG_ID_MAX} characters, not ${length}`);
  }
  const p = new FixtureProject({
    dir: fixture.dir,
    cli: options.cli ?? pinnedCli(),
    cliVersion: options.cliVersion ?? pinnedVersion(),
    now: new Date(fixture.now.getTime() + 30 * 60 * 1000),
    env: fixture.env,
  });
  // `task-NNN-` and the slug (the kanban fixture numbers tasks with three digits).
  const title = slugOf(length - 'task-000-'.length).replaceAll('-', ' ');
  const el = await p.add('Jordan', 'task', title);
  if (el.id.length !== length) throw new Error(`the CLI made an id of ${el.id.length} characters, not ${length}`);
  if (options.submit !== false) await p.submit('Jordan', el.id);
  await p.as('Alex');
  return { ...el, title };
}
