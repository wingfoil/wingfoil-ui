// The tag checks of the npm publish pipeline (`.github/workflows/publish.yml`, job `gate`;
// task-029 D29-13, release-publishing `tag`): before anything is built for a release tag,
//
//   1. the tag is `v<major>.<minor>.<patch>` and equals `v` + the `version` of the root
//      `package.json` and of every workspace `package.json` (release-submit `release-commit`);
//   2. it is an annotated tag (release-publishing `tag`: an annotated semver tag);
//   3. it points at the commit the run builds (`<sha>`, `$GITHUB_SHA` in the workflow);
//   4. that commit is on `origin/main` (fetched here with `--no-tags`): never a tag on a phase or
//      task branch.
//
//   node scripts/check-release-tag.mjs <tag> <sha>
//
// Run in the repository's top folder. Prints one line per check passed; on any failure prints every
// failed check on stderr and exits 1; exit 2 on a usage error. Git runs with an argument array, no shell.
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

function manifest(folder) {
  return JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8'));
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
if (!m) {
  failures.push(`tag ${tag} is not v<major>.<minor>.<patch>`);
} else {
  const root = manifest('.');
  const versions = [['package.json', root.version]];
  for (const ws of root.workspaces ?? []) versions.push([`${ws}/package.json`, manifest(ws).version]);
  const wrong = versions.filter(([, v]) => v !== m[1]);
  if (wrong.length > 0) {
    for (const [file, v] of wrong) failures.push(`tag ${tag} does not match ${file} version ${v}`);
  } else {
    passed.push(`tag ${tag} matches the version of package.json and its ${versions.length - 1} workspaces`);
  }
}

// 2. Annotated.
const kind = tryGit(['cat-file', '-t', `refs/tags/${tag}`]);
if (kind === null) failures.push(`tag ${tag} does not exist`);
else if (kind !== 'tag') failures.push(`tag ${tag} is not an annotated tag (${kind})`);
else passed.push(`tag ${tag} is annotated`);

// 3. The commit the run builds.
const target = tryGit(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`]);
if (target !== null && target !== sha) failures.push(`tag ${tag} points at ${target}, the run builds ${sha}`);
else if (target !== null) passed.push(`tag ${tag} points at ${sha}`);

// 4. On origin/main.
if (tryGit(['fetch', '--quiet', '--no-tags', 'origin', '+refs/heads/main:refs/remotes/origin/main']) === null) {
  failures.push('origin/main could not be fetched');
} else if (tryGit(['merge-base', '--is-ancestor', sha, 'refs/remotes/origin/main']) === null) {
  failures.push(`commit ${sha} is not on origin/main`);
} else {
  passed.push(`commit ${sha} is on origin/main`);
}

for (const line of passed) process.stdout.write(`ok: ${line}\n`);
for (const line of failures) process.stderr.write(`refused: ${line}\n`);
process.exit(failures.length > 0 ? 1 : 0);
