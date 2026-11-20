#!/usr/bin/env node
// Bound check ids-unique (severity reject), run after sync merges the trunk into the lines: no
// numbered id (`<prefix>-<n>-<slug>`: task, bug, dl, adr, spec) is taken twice in the Memory of
// any branch this clone knows (main, every main-<line>, local or remote-tracking). Ids are counted
// per branch (directive agent-branches), so the trunk and a line can take the same number between
// two fetches; a merge then holds two elements with one number.
// Usage: node scripts/checks/ids-unique.mjs [--ref <ref> ...]
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import yaml from 'js-yaml';
import { verdict, versionLine } from '../lib/memory.mjs';

console.log(versionLine());

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const given = process.argv.flatMap((a, i, all) => (all[i - 1] === '--ref' ? [a] : []));
const refs = given.length ? given : git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes')
  .split('\n').filter((r) => /\/main(-[a-z0-9-]+)?$/.test(r));
const problems = [];
// Numbers the approver accepted twice (config known_duplicates): the full ids still differ.
const knownDuplicates = existsSync('config/runner.yaml') ? yaml.load(readFileSync('config/runner.yaml', 'utf8')).known_duplicates ?? [] : [];
// Every folder a Memory type writes to, from the project's own memory.yaml.
const memoryYaml = yaml.load(readFileSync('.wingfoil/memory.yaml', 'utf8'));
const memoryRoots = [...new Set(Object.values(memoryYaml.types ?? {}).map((t) => String(t.path ?? '').split('{')[0].replace(/\/[^/]*$/, '')).filter(Boolean))];
// A check that did not see a line proves nothing: every line whose checkout exists on this machine
// (config/runner.yaml) must be among the branches read.
if (!given.length && existsSync('config/runner.yaml')) {
  const lines = yaml.load(readFileSync('config/runner.yaml', 'utf8')).lines ?? {};
  for (const [name, line] of Object.entries(lines)) {
    if (name === 'trunk') continue;
    const checkout = String(line.checkout ?? '').replace(/^~\//, `${homedir()}/`);
    if (existsSync(`${checkout}/.git`) && !refs.some((r) => r.endsWith(`/${line.branch}`))) {
      problems.push(`${line.branch} is not among the branches read, though its checkout ${checkout} exists: fetch it first`);
    }
  }
}
for (const ref of refs) {
  const files = git('ls-tree', '-r', '--name-only', ref, '--', ...memoryRoots).split('\n').filter(Boolean);
  const seen = new Map();
  for (const file of files) {
    const m = /(?:^|\/)([a-z]+)-(\d+)-[^/]*\.md$/.exec(file);
    if (!m) continue;
    // Numbers compare as numbers: WingFoil pads them (task-002), a hand-written id may not.
    const id = `${m[1]}-${Number(m[2])}`;
    const key = id;
    if (knownDuplicates.includes(key)) continue;
    if (seen.has(key)) problems.push(`${ref}: ${id} names both ${seen.get(key)} and ${file}`);
    else seen.set(key, file);
  }
}
verdict(problems, `no numbered id taken twice on ${refs.length} branch(es)`);
