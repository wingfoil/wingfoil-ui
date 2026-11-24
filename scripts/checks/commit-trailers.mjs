#!/usr/bin/env node
// Bound check commit-trailers (severity reject): every commit the step added in the element's
// worktree carries its provenance (directive git-conventions): the trailer AI-Model with the
// adapter's model, a Co-Authored-By trailer with the commit author's email, and a citation of the
// element as <line>:<id> in its body, in any case. The step's commits are those reachable from HEAD
// and from neither WINGFOIL_RUNNER_BASE, the worktree's HEAD before the launch, nor the line's branch
// (WINGFOIL_RUNNER_LINE_BRANCH): the line's commits a rebase brings in were checked in their own steps. The
// runner gives WINGFOIL_RUNNER_BASE, _LINE_BRANCH, _MODEL, _LINE and WINGFOIL_ELEMENT (lib.checkEnv);
// each WINGFOIL_RUNNER_<KEY> is also read under its name from before 1.2.1, DFD_<KEY>.
// A step that added no commit passes; merges are not read.
// Usage: node scripts/checks/commit-trailers.mjs [--base <rev>] [--line-branch <ref>] [--model <id>] [--line <name>] [--element <id>]
import { execFileSync } from 'node:child_process';
import { elementArg, verdict, fail, versionLine } from '../lib/memory.mjs';

console.log(versionLine());

const arg = (name) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? null : process.argv[at + 1];
};
const env = (key) => process.env[`WINGFOIL_RUNNER_${key}`] ?? process.env[`DFD_${key}`];
const base = arg('--base') ?? env('BASE');
const lineBranch = arg('--line-branch') ?? env('LINE_BRANCH');
const model = arg('--model') ?? env('MODEL');
const line = arg('--line') ?? env('LINE');
const id = elementArg();
if (!base || !lineBranch || !model || !line || !id) fail('needs WINGFOIL_RUNNER_BASE, WINGFOIL_RUNNER_LINE_BRANCH, WINGFOIL_RUNNER_MODEL, WINGFOIL_RUNNER_LINE and WINGFOIL_ELEMENT (or --base, --line-branch, --model, --line, --element)');

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const log = execFileSync('git', ['log', '--no-merges', '--format=%H%x00%ae%x00%B%x1e', 'HEAD', '--not', base, lineBranch, '--'], { encoding: 'utf8' });
const commits = log.split('\x1e').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
  const [sha, email, body] = entry.split('\x00');
  return { sha, email, body };
});

const problems = commits.flatMap(({ sha, email, body }) => {
  const at = sha.slice(0, 8);
  const missing = [];
  if (!new RegExp(`^AI-Model:[ \\t]*${escape(model)}[ \\t]*$`, 'm').test(body)) missing.push(`the trailer AI-Model: ${model}`);
  if (!new RegExp(`^Co-Authored-By:.*<${escape(email)}>[ \\t]*$`, 'mi').test(body)) missing.push(`a Co-Authored-By trailer with <${email}>`);
  // Line names and ids are lowercase, so a citation that opens a sentence (Trunk:…) is the same one.
  if (!body.toLowerCase().includes(`${line}:${id}`.toLowerCase())) missing.push(`the citation ${line}:${id}`);
  return missing.map((what) => `commit ${at} lacks ${what}`);
});
verdict(problems, `${commits.length} commit(s) of the step (not in ${base.slice(0, 8)} or ${lineBranch}) carry their provenance`);
