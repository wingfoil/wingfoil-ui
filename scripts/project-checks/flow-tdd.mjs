#!/usr/bin/env node
// Bound check flow-tdd (dl-028; the pre check of `backlog-item` › red, `.wingfoil/workflows/bindings.yaml`).
// This repository's own check, outside the script runner's manifest. It fails only for a task whose
// `flow` field is `direct` with its reason (`direct — <reason>`, set at release-planning ›
// build-backlog and approved with the task): the runner then skips the optional red for that task
// (runner 1.2.6) and the task goes from design to green. Every other case passes, so red runs: no
// `flow`, `tdd`, an unknown value, a bare `direct` with no reason, a task file not found. A failure of
// this check skips a step, so it fails only on the one value that asks for it.
// Usage: node scripts/project-checks/flow-tdd.mjs [--element <task id>]
import { elementArg, elements, fail, versionLine } from '../lib/memory.mjs';

console.log(versionLine());

const id = elementArg();
if (!id) fail('no element: pass --element <id> or set WINGFOIL_ELEMENT');

/** The verdict for a task's `flow` value: `skip` (red skipped) with the reason, or `tdd` with why. */
function flowVerdict(value) {
  const flow = String(value ?? '').trim();
  const direct = /^direct(?:\s*[—–:-]\s*|\s+)(\S.*)$/s.exec(flow);
  if (direct) return { skip: true, why: `flow: direct — ${direct[1].trim()}` };
  if (flow === '' || flow === 'tdd') return { skip: false, why: `flow: ${flow || '(absent)'}, red runs` };
  if (flow === 'direct')
    return { skip: false, why: 'flow: direct with no reason, red runs (set it as "direct — <reason>")' };
  return { skip: false, why: `flow: ${JSON.stringify(flow)} is not tdd or direct, red runs` };
}

const found = elements('docs/04_memory').filter((element) => element.id === id);
if (found.length !== 1) {
  console.log(`ok: ${found.length ? `${found.length} files` : 'no file'} for ${id} under docs/04_memory, red runs`);
  process.exit(0);
}
const { skip, why } = flowVerdict(found[0].fm.flow);
if (skip) {
  console.error(`reject: ${why}: no red-first criterion, red is skipped`);
  process.exit(1);
}
console.log(`ok: ${why}`);
