// The tag checks of the npm publish pipeline (`.github/workflows/publish.yml`, job `gate`;
// task-029 D29-13, release-publishing `tag`): before anything is built for a release tag,
//
//   1. the tag is `v<major>.<minor>.<patch>` and equals `v` + the `version` of the root
//      `package.json`, of every workspace `package.json`, and of the lockfile — its `version`,
//      `packages[""]` and each workspace's `packages["<folder>"]` (release-submit `release-commit`
//      bumps the root, the workspaces and the lockfile); a glob workspace entry is refused;
//   2. it is an annotated tag (release-publishing `tag`: an annotated semver tag);
//   3. it points at the commit the run builds (`<sha>`, `$GITHUB_SHA` in the workflow, peeled to
//      its commit first);
//   4. that commit is on `origin/main` (fetched here with `--no-tags`): never a tag on a phase or
//      task branch.
//
//   node scripts/check-release-tag.mjs <tag> <sha>
//
// Run in the repository's top folder. Prints one line per check passed; on any failure prints every
// failed check on stderr and exits 1 (a missing or unparsable `package.json` / `package-lock.json` is
// one of them); exit 2 on a usage error. Git runs with an argument array, no shell.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const USAGE = 'usage: node scripts/check-release-tag.mjs <tag> <sha>';
const TAG = /^v(\d+\.\d+\.\d+)$/;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** `git …` that may fail: its output, or `null`. */
function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

/** A manifest that cannot be read or parsed: reported as a refusal, not a stack trace. */
class Unreadable extends Error {}

function manifest(folder, file = 'package.json') {
  const name = path.join(folder, file);
  try {
    return JSON.parse(readFileSync(name, 'utf8'));
  } catch (error) {
    throw new Unreadable(`${name} cannot be read (${error?.code ?? 'not valid JSON'})`);
  }
}

const [tag, sha, ...rest] = process.argv.slice(2);
if (!tag || !sha || rest.length > 0) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}

const failures = [];
const passed = [];

// 1. Name and versions.
const m = TAG.exec(tag);
try {
  if (!m) {
    failures.push(`tag ${tag} is not v<major>.<minor>.<patch>`);
  } else {
    const root = manifest('.');
    const workspaces = root.workspaces ?? [];
    const globs = workspaces.filter((ws) => /[*?[\]{}!]/.test(ws));
    for (const ws of globs)
      failures.push(`workspace entry ${ws} is a glob: list each workspace folder in package.json`);
    if (globs.length === 0) {
      const lock = manifest('.', 'package-lock.json');
      const versions = [
        ['package.json', root.version],
        ...workspaces.map((ws) => [`${ws}/package.json`, manifest(ws).version]),
        ['package-lock.json', lock.version],
        ['package-lock.json packages[""]', lock.packages?.['']?.version],
        ...workspaces.map((ws) => [`package-lock.json packages["${ws}"]`, lock.packages?.[ws]?.version]),
      ];
      const wrong = versions.filter(([, v]) => v !== m[1]);
      if (wrong.length > 0) {
        for (const [file, v] of wrong) failures.push(`tag ${tag} does not match ${file} version ${v ?? '(none)'}`);
      } else {
        passed.push(`tag ${tag} matches package.json, its ${workspaces.length} workspaces and package-lock.json`);
      }
    }
  }
} catch (error) {
  if (!(error instanceof Unreadable)) throw error;
  failures.push(error.message);
}

// 2. Annotated.
const kind = tryGit(['cat-file', '-t', `refs/tags/${tag}`]);
if (kind === null) failures.push(`tag ${tag} does not exist`);
else if (kind !== 'tag') failures.push(`tag ${tag} is not an annotated tag (${kind})`);
else passed.push(`tag ${tag} is annotated`);

// 3. The commit the run builds (peeled: an annotated tag's object id names the same commit).
const built = tryGit(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`]);
const target = tryGit(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
if (built === null) failures.push(`${sha} is not a commit of this repository`);
else if (target !== null && target !== built) failures.push(`tag ${tag} points at ${target}, the run builds ${built}`);
else if (target !== null) passed.push(`tag ${tag} points at ${built}`);

// 4. On origin/main.
if (built === null) {
  // reported above
} else if (tryGit(['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']) === null) {
  failures.push('origin/main could not be fetched');
} else if (tryGit(['merge-base', '--is-ancestor', built, 'refs/remotes/origin/main']) === null) {
  failures.push(`commit ${built} is not on origin/main`);
} else {
  passed.push(`commit ${built} is on origin/main`);
}

for (const line of passed) process.stdout.write(`ok: ${line}\n`);
for (const line of failures) process.stderr.write(`refused: ${line}\n`);
process.exit(failures.length > 0 ? 1 : 0);
