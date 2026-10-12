---
id: task-027-e2e-suite-on-firefox-and-webkit
type: task
title: "E2e suite on Firefox and WebKit"
status: pending
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2","governance","e2e"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

REQ-INT-08 (*Supported browsers*) is staged: v0.1 runs the e2e suite on Chromium only, v0.2 on
Chromium, Firefox and WebKit (SARD `04` REQ-INT-08 Release field; `minor-v0.2` *Scope*
"Browsers"; `playwright.config.ts` comment). No v0.2 backlog record carries the extension
(TT-INT-08 is a v0.1 record, done in task-001-workspace-tooling-and-e2e-harness of v0.1), so it is
this governance task, run early so that every later web task's e2e runs on the three engines
(RP-42, RP-44). On the session-4 audit checklist (RP-50).

**Backlog items:** GOV (governance — REQ-INT-08 v0.2 extension; serves TT-INT-08, X1)

## Acceptance Criteria

- **AC-1** `playwright.config.ts` declares the projects `chromium`, `firefox` and `webkit` (the
  engines of the pinned Playwright); REQ-INT-08 fit criterion: [percentage] 100 % of the e2e
  scenarios pass on each of the three engines — the whole v0.1 suite, unchanged in what it asserts.
  An engine-specific difference is handled in `test/e2e/support/` (e.g. clipboard permissions,
  which Playwright grants on Chromium only); a scenario skipped on an engine needs the approver's
  decision, recorded in this task.
- **AC-2 (RP-44)** Timing and perf runs stay on Chromium only: `playwright.timing.config.ts` and
  the `@perf` runs are not multiplied by engine.
- **AC-3 (RP-44)** The browser setup is documented in `test/README.md` (and the README's developer
  setup): `npx playwright install firefox webkit` and the WebKit system dependencies
  `npx playwright install-deps` (sudo — performed by the approver on the development machine; the
  task stops and asks when they are missing). The e2e run time per engine is recorded.
- **AC-4** `test/README.md` (`npm run test:e2e` row, *Layout*) and the `playwright.config.ts`
  comment updated; `typecheck`, `lint`, `format:check`, `test:coverage`, `test:e2e` (three
  engines) green.

## Implementation Notes

- SARD `04` REQ-INT-08 (Release v0.1 Chromium · v0.2 three engines; verified by e2e-smoke
  `drive-browser`); release-planning v0.1 session 2 (REQ-INT-08 staged).
- Three engines multiply the e2e load (bug-004): keep `fullyParallel` and the cold-read budget of
  `test/e2e/support/cold-read.ts`; measure before changing workers.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
