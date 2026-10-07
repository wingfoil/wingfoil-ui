---
id: bug-004-tests-time-out-under-extreme-machine-load
type: bug
title: "Tests time out under extreme machine load"
status: planned
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "web"          # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

Under extreme external load (load average 30–100 on 12 cores) the default gates (`test:coverage`,
`test:e2e`) fail with timeouts, never with wrong values: cold first reads in e2e specs outlast
Playwright's 5 s expectation default, jsdom `findByRole` waits outlast their 1 s default, and the
whole-repository lint test outlasts its 120 s timeout.

## Steps to Reproduce

1. On `main` after task-018 (`bc1ef56`), with another project's builds loading the machine
   (`cat /proc/loadavg` 30–100 on 12 cores).
2. Run `npm run -s test:coverage` and `npm run -s test:e2e`.

## Expected Behavior

The default gates are load-independent (the premise of bug-001's split into `test:timing`):
tests may be slower under load but do not fail when the code is correct.

## Actual Behavior

- `test/e2e/element-panel.spec.ts` (and the Memory list spec before task-017 raised its own
  wait to 30 s): up to 20 of 40 e2e tests timed out at load 25–76; every failure was a timeout on
  the first cold read (CLI behind `GET /elements`), all pass at low load.
- `test/web/element/panel.test.tsx:142` timed out at load ≈ 31 with "Loading the element…" still
  on screen; passes alone.
- `test/lint/lint-clean.test.ts` (whole-repo ESLint in one test, 120 s): failed at load 57–99
  during task-013 integration; ≈ 34 s at load 30, +70 % since task-013 added the web lint rules.
- `test/launcher/local-security.test.ts` and the `beforeAll` of `test/harness/fixtures.test.ts`
  timed out at load 57–99 (process and git spawns).

## Evidence

- task-013 integration (2026-10-06): first `test:coverage` 5 failures (timeouts), re-run clean.
- task-017 red/green and review (2026-10-07): e2e timeouts at load 25–76, 40/40 at load ≈ 30 and
  7–14; one coverage failure at load ≈ 31 (panel component test), passes alone.

## Notes

- Proposed fix: one shared cold-read constant/helper in `test/e2e/support/` (e.g. `COLD_READ_MS`)
  used by every spec's first-load expectation; a longer default for async queries in the web
  component tests (Testing Library `asyncUtilTimeout`); `lint-clean` run outside the parallel
  pool or with a timeout sized to the measured worst case; review the process-spawning tests'
  timeouts. No product code at fault.
- Found during Wave 3 of v0.1 (plan `dev-loop-rel-v0.1-plan`, Session 3) — reviews of task-013
  and task-017. To be absorbed into task-019 (last task of Wave 3; it adds e2e and component
  suites on the same support).

## Triage & Execution Notes
- triage (2026-10-07): approved by the user as **low** severity (test-suite defect under extreme
  external load, no product code at fault).
- fix: **absorbed into task-019-dna-directives-and-team-views** (dl-045 pattern; the task lists
  this bug in `bug:` with its own Acceptance Criterion). `triaged → planned` set by hand (no CLI
  verb); it moves to `in-progress` when task-019 starts.
