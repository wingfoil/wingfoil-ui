---
id: task-026-load-independent-tests-and-one-temp-folder-convention
type: task
title: "Load-independent tests and one temp folder convention"
status: backlog
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2","governance","tests"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-008-clone-hooks-temp-folder-left-behind-when-the-console-is-killed"]                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

dl-006 action 1 (load-independent tests, themes T2 and T3 of the v0.1 retrospective), planned at
`release-planning` (RP-3 (a), RP-42): one temp-folder convention that leaves nothing behind, perf
and fingerprint assertions that prove a fresh read, and the package smoke as a gate of every wave.
It absorbs bug-008 (the clone hooks folder `/tmp/wfui-no-hooks-*` left behind when the console is
killed). Governance task (`module: governance`, `ref: GOV`): no backlog record; run through the
full dev-loop.

**Backlog items:** GOV (governance — dl-006 action 1; absorbs bug-008)

## Acceptance Criteria

- **AC-1 (temp folders, bug-008)** Every temporary folder the console or the tests create follows
  one convention, documented in `test/README.md`: tests under `TempWorkspace`
  (`test/harness/temp-workspace.ts`), the console's own folders (the clone hooks folder of
  `server/src/projects/clone.ts` `noHooksDir`) where a stale one is removed at the next start or
  not created at all. A test kills a console with SIGKILL after a clone and shows that no
  `wfui-no-hooks-*` folder of it survives the next start (or none was created); at most one exists
  per running console. The e2e support's `wfui-e2e-fx-*` and `wfui-e2e-large-*` folders
  (created in `test/e2e/support/fixtures.ts` and `test/e2e/performance.spec.ts`) are removed by the worker
  teardown or the global teardown (`test/e2e/support/global-teardown.ts`); a full `npm test` + `npm run test:e2e` run leaves 0 new
  `wfui-*` entries in the temporary directory (counted before and after).
- **AC-2 (fresh reads)** The perf and fingerprint assertions prove that the read they measure is a
  fresh one, not cached data (bug-005; R-05.1 of task-021-accessibility-page-title-and-performance-pass, v0.1): each of `test/e2e/performance.spec.ts`,
  the timing suite's measurements and `test/server/snapshot/fingerprint.test.ts` asserts the cache
  miss or the changed repository state it depends on before it measures or compares.
- **AC-3 (smoke gate)** `npm run test:smoke` is documented in `test/README.md` as a gate run at the
  end of every wave (with the wave's integration), not only at release validation (bug-007).
- **AC-4** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e`, `test:smoke`
  green; `check_tasks.py v0.2` OK; bug-008 follows this task's state (`bug.sync_state`).

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review. Scope of that review: the `clone.ts` change (the hooks path git runs a clone with must never
point at a folder another user or process can write).

## Implementation Notes

- dl-006 *Decision* action 1 and *Rationale*; bug-008 *Notes* options (a) a folder under the
  console's run directory with stale ones removed at start, (b) a fixed per-user path, (c)
  `core.hooksPath` to a path git accepts as empty — to be checked with git itself.
- `test/README.md` *Timing suite* and *Local state*; the e2e reaper of bug-004
  (`test/e2e/support/reaper.ts`, `test/e2e/support/global-teardown.ts`) already kills leftover consoles: reuse it.
- Do not run `npm test`, `test:e2e` and `test:smoke` together in one checkout (`test/README.md`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
