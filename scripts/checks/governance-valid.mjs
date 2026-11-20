#!/usr/bin/env node
// Bound check governance-valid (severity reject), and the check of directive wingfoil-cli: the
// committed configuration loads with no diagnostic and no warning, in every loader that reports
// them. Run from the repository root. Usage: node scripts/checks/governance-valid.mjs
import { spawnSync } from 'node:child_process';
import { verdict, versionLine } from '../lib/memory.mjs';

console.log(versionLine());

const commands = [
  ['workflow', 'list', '--all'], ['workflow', 'status'], ['workflow', 'next'],
  ['dna', 'show', 'team'], ['directives', 'list'], ['memory', 'search'], ['agent', 'list'],
];
const found = [];
const walk = (o, where) => {
  if (Array.isArray(o)) o.forEach((x) => walk(x, where));
  else if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) {
      if (k === 'diagnostics' && Array.isArray(v) && v.length > 0) found.push(`${where}: ${JSON.stringify(v)}`);
      walk(v, where);
    }
  }
};
for (const args of commands) {
  const cli = JSON.parse(process.env.DFD_CLI ?? '["npx","--no-install","wingfoil"]');
  const r = spawnSync(cli[0], [...cli.slice(1), ...args, '--format', 'json'], { encoding: 'utf8' });
  const where = `wingfoil ${args.join(' ')}`;
  if (r.status !== 0) { found.push(`${where}: exit ${r.status}: ${r.stderr.trim()}`); continue; }
  if (r.stderr.trim()) found.push(`${where}: stderr: ${r.stderr.trim()}`);
  try { walk(JSON.parse(r.stdout), where); } catch (e) { found.push(`${where}: not JSON: ${e.message}`); }
}
verdict(found, `the configuration loads with no diagnostic (${commands.length} loaders)`);
