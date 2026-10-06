---
id: bug-001-timing-tests-fail-under-external-machine-load
type: bug
title: "Timing tests fail under external machine load"
status: in-review
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"       # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

Two timing-bound tests of the suite fail when other processes load the machine, although the code
they measure meets its budget: the REQ-PERF-06 start test (`test/launcher/launcher.test.ts`,
≤ 3.0 s in 10 of 10 runs) and the TypeDoc build test (`test/docs/api-docs.test.ts`, 30 s test
timeout).

## Steps to Reproduce

1. On `main` (`6b8a3cf`, WingFoil 0.2.2 pinned), with another project's builds running in
   parallel (observed: the WingFoil2 dev-loop worktrees `.wf2-wt/task-*` running `tsc`, `typedoc`,
   `jest`; load average 50–70 on 12 cores, `cat /proc/loadavg`).
2. Run `npm run -s test:coverage`.
3. Run `npx vitest run test/launcher/launcher.test.ts -t REQ-PERF --silent=false`.

## Expected Behavior

The suite's verdict depends only on the code under test: a timing test either measures in
controlled conditions or is kept out of the gates that run under arbitrary load.

## Actual Behavior

Both tests fail under load and pass alone at low load. The `dev-loop` refactor gate
(`tests.passing`) and the review gate turn red without any defect in the code, and every merge
needed a manual re-run on a quiet machine.

## Evidence

- REQ-PERF-06 spawn → URL, quiet machine (load ≈ 2): 386–693 ms; under load: 2339, 3098, 1777,
  4076, 4426, 4491, 3144, 3239, 2763, 3948 ms (load ≈ 61, task-004 integration, 2026-10-05);
  max 4192 ms (load 57–67, task-007 third review).
- `api-docs.test.ts` "build with the repository configuration": 30 056–30 126 ms (timeout) under
  load; `npm run docs:api` alone takes ≈ 18 s at load ≈ 44.
- The task-001 TypeDoc test leaves `/tmp/wfui-typedoc-*` behind when it times out.

## Notes

- Proposed fix: a separate sequential Vitest project (or a dedicated script) for the timing-bound
  tests, excluded from the default `test`/`test:coverage` gates, run on a quiet machine and
  reporting the load average next to the measurement; clean the TypeDoc temp dir in `afterAll`
  even on timeout.
- Found during the Wave 1 dev-loops of v0.1 (plan `dev-loop-rel-v0.1-plan`, Session 1).
- To be absorbed into task-010 (snapshot cache and live updates), which owns TT-PERF-03 and
  TT-PERF-05 (dl-045 absorbed-bug pattern).

## Triage & Execution Notes

- triage (2026-10-05): approved by the user as **low** severity (test-suite defect, no product
  code at fault).
- fix: **absorbed into task-010-snapshot-cache-and-live-updates** (dl-045 pattern; the task owns
  TT-PERF-03/05 and lists this bug in `bug:`, with its own Acceptance Criterion). `triaged →
  planned` set by hand (waiting state, no CLI verb); dev-loop `bug.sync_state` moves it with the
  task from there.
- start (2026-10-05): task-010 started (Wave 2) → `planned → in-progress` by hand (dev-loop
  `start` step `bug.sync_state`; no CLI verb for this edge).
- submit (2026-10-06): task-010 submitted after its integration (all reviews PASS; `test:coverage` 917 passed, `test:timing` 3/3 at load 12–17) → `in-progress → in-review` with `memory submit` (dev-loop `bug.sync_state`).
