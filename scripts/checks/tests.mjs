#!/usr/bin/env node
// Bound checks tests-red / tests-green (severity reject): `npm test` fails (red) or passes
// (green). Usage: node scripts/checks/tests.mjs --expect red|green
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { verdict, fail, versionLine } from '../lib/memory.mjs';

console.log(versionLine());

const at = process.argv.indexOf('--expect');
const expect = at === -1 ? null : process.argv[at + 1];
if (expect !== 'red' && expect !== 'green') fail('pass --expect red or --expect green');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
if (!pkg.scripts?.test) {
  verdict([`package.json has no test script, so the tests cannot be ${expect}`], '');
}
const run = spawnSync('npm', ['test', '--silent'], { stdio: 'inherit' });
const passed = run.status === 0;
if (expect === 'green') verdict(passed ? [] : [`npm test failed (exit ${run.status})`], 'npm test passes');
verdict(passed ? ['npm test passes: red expects the new tests to fail'] : [], 'npm test fails, as red expects');
