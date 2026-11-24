// Read-only access to the Memory files a check needs: frontmatter only. Writes go through the
// WingFoil CLI (directive cli-only-writes); nothing here writes Memory.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import yaml from 'js-yaml';

export { versionLine, VERSION_LINE } from './version.mjs';

/** Where the code under check is: the check's working directory (a task's worktree, or the checkout). */
export const ROOT = process.cwd();
/**
 * Where Memory and the run records are: the line's checkout, given by the runner in WINGFOIL_RUNNER_CHECKOUT (DFD_CHECKOUT before 1.2.1).
 * The runner and the WingFoil CLI write them there, never on a task's branch, so a check run in a
 * task's worktree reads them from the checkout; run by hand, it reads them from its own directory.
 */
export const MEMORY_ROOT = process.env.WINGFOIL_RUNNER_CHECKOUT || process.env.DFD_CHECKOUT || ROOT;

/** The frontmatter of one Memory file, as an object (empty when it has none). */
export function frontmatter(file) {
  const text = readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return match ? (yaml.load(match[1]) ?? {}) : {};
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : name.endsWith('.md') ? [path] : [];
  });
}

/** Every element of a type under its directory: { id, file, fm }. */
export function elements(dir) {
  return walk(join(MEMORY_ROOT, dir)).map((file) => ({ id: basename(file, '.md'), file, fm: frontmatter(file) }));
}

export const calls = () => elements('docs/memory/call');

/** One release element by id (rel-1.0.0, rel-1.1.0-claude), or null. */
export function release(id) {
  return elements('docs/memory/release').find((element) => element.id === id) ?? null;
}

/** The step's element id: --element <id>, else WINGFOIL_ELEMENT (set by the runner). */
export function elementArg(argv = process.argv.slice(2)) {
  const at = argv.indexOf('--element');
  if (at !== -1 && argv[at + 1]) return argv[at + 1];
  return process.env.WINGFOIL_ELEMENT ?? null;
}

/** Print the outcome and exit: 0 pass, 1 reject (the binding's severity), 2 cannot run. */
export function verdict(problems, okMessage) {
  if (problems.length === 0) {
    console.log(`ok: ${okMessage}`);
    process.exit(0);
  }
  for (const problem of problems) console.error(`reject: ${problem}`);
  process.exit(1);
}

export function fail(message) {
  console.error(`error: ${message}`);
  process.exit(2);
}
