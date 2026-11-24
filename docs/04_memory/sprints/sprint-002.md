---
type: sprint
format: 1
id: sprint-002
title: "Sprint 2 — v0.3.1 Corrections"
goal: "The console Casey relies on since v0.3.0 is corrected — its open bugs fixed and its development dependencies refreshed — with no new feature"
status: active
---

## Sprint Goal

The console shipped in `wingfoil-ui@0.3.0` is corrected for Casey, the product owner, and for the
agents that use it: the bugs carried from Sprint 1 and those found since are fixed, and the
development dependencies are refreshed, with no new feature (v0.3.1, *Corrections*,
`dl-021-scope-and-order-of-the-releases-from-v0.3.1-to-v0.4.1` Decisions 1 to 3).

The candidate scope is Decision 3 of that record: bug-039, bug-041, bug-044, bug-045, bug-047,
bug-048, bug-052 and bug-053; the development dependency refresh without TypeScript 7 and js-yaml 5
(dl-020 action 3; `npm audit` reported 45 development-only findings on 2026-11-18, `npm audit
--omit=dev` none — `trunk:sprint-001` *Sprint Review*); the key rendering with bug-041 (dl-009
action 10); the stale generated backlog JSON (task-065 F-8) and the broken git configuration case
of task-055 (dl-020 action 5); the `feature` pattern of `.wingfoil/ui.yaml`; and the task that
makes `docs/03_backlog/X_tools/check_releases.py` read the patch releases (dl-021 *Actions*). The
approver's scope ruling at this Sprint's planning (N-001, 2026-11-21) added two items: bug-051 gets
release v0.3.1 and is closed by the approver after verifying the fix in force since `ed26e1b4`, with
no code task; and the dependency refresh also aligns `engines.node` with what the refreshed
dependencies require (exit criterion: `npm ci` without `EBADENGINE` on the supported Node). The
approved scope is `patch-v0.3.1` (items 1–14, a budget of 6 active days), planned in
`sprint-planning-rel-v0.3.1-plan`.

The Sprint Backlog, approved to `backlog` by the approver (final OK N-003, 2026-11-21), in waves:
*Wave 1* task-093, task-092, task-091; *Wave 2* task-084, task-085, task-087, task-094; *Wave 3*
task-088, task-090, task-086, task-089, task-095. Budget risk accepted at N-003: task-095, task-089
and task-086 move to v0.3.2 if Wave 2 ends past day 3.

The Sprint Backlog is the tasks of the release v0.3.1 whose `sprint` names this Sprint, set at its
`sprint-planning` by the release-planning of v0.3.1 (directive `release-planning`), which confirms
the scope with the approver. Length: two weeks (`methodology/scrum`, `sprint_length`). It is the
first Sprint planned and run through the script runner (`wingfoil-cli` › *The script runner*,
dl-023).

## Wave gates

### Wave 1 gate — 2026-11-24

Wave 1 (*the tools and the ground*): task-093, task-092, task-091, all `done`. The gate ran outside
the script runner (the v0.3.1 planning predates the gate tasks of `release-planning` 1.5; the Wave 2
and Wave 3 gates are runner tasks). Phase branch `design/dev-loop_v0.3.1` at `24309852`.

- **The wave scope on CI:** `gates.yml` `workflow_dispatch` `scope=wave` on `24309852`, run
  45436485768: success at the first attempt — checks, contract, coverage, smoke, publish-smoke,
  e2e-wave Chromium 1 and 2, Firefox 1 and 2, WebKit 1 and 2; e2e-chromium, own-specs and repeat
  skipped by the scope. The push-triggered run 45436423460 is not evidence.
- **Timing:** `npm run test:timing` alone through the machine-free slot on a clean checkout of
  `24309852` (Node 24.22.3, after `npm ci`), 2026-11-24 16:46–17:12 UTC: Vitest 5 files, 6 tests
  passed; Playwright 32 passed (8.5 min); load average 3.43 at the start, 1.69 at the end (12 cores).
- **Runtime audit:** `npm audit --omit=dev` on the same checkout: 0 vulnerabilities.
- **Into `main`:** merge `286228ba` (`--no-ff`); `git diff 24309852 286228ba` changes only
  `docs/05_plans/governance-evolution/governance-evolution-12-plan.md`, which only `main` carries
  (`5b4c9866`, `e90888f0`). `main` pushed at `3b3ae5ff` with the gate tasks; `publish.yml`
  `workflow_dispatch` on it, run 45477768155: `gate` failed on one test, AC-2 of
  `test/governance/patch-release-review.test.ts`, which pinned "12 tasks" while task-096 and
  task-097 made 14 (no stage, promote or release ran). Fixed by `1797ae57` (the count follows the
  release's task files); `publish.yml` dispatched again on the fix.
- **The wave:** from 2026-11-21 14:46 (task-091 `start`) to 2026-11-24 17:19 (task-093 `done`),
  4 active days (commits on 11-21, 11-22, 11-23, 11-24); 3 tasks closed.
- **Review rounds** (the runner's run records, `docs/runs/`): task-091 4 verdicts (3 rejected, 1
  accepted), task-092 4 (3 rejected, 1 accepted), task-093 4 (3 rejected, 1 accepted; one more review
  run ended in an agent error and was rerun). Every reject was a finding in the task's own change.
- **Bugs:** bug-053 resolved by task-091 (close note in the bug); the approver's `resolved → closed`
  is pending.
- **Seen in the wave, carried forward:**
  - M-02.2 *Group unknown states in generic buckets: To approve* (`test/e2e/memory-list.spec.ts:229`)
    failed once on Firefox (run 45414655791 attempt 1, task-093's own specs: the bucket link's click
    did not navigate) and passed on the rerun and in this gate's run; the code and the spec are
    task-092's (`d0ad607a`, `7529d8c4`). Raised as bug-054 (below). The `repeat` input runs Chromium
    only, so a Firefox repetition is not available on CI today.
  - **Deviation — TDD inside one step.** `definition-of-done` › *build* runs design → red → green →
    refactor inside the one `build` step, so one agent, in one context, wrote the tests and then the
    code: task-091's design and reproduction are recorded after the fact, task-092 has no red for the
    counted-filter fix (`745e103b`), task-093 records "no separate red run of the fixtures". The
    approver rules this not acceptable; the fix is the next `governance-evolution` run (design, red,
    green and refactor as separate steps, the same agent in distinct fresh sessions), before Wave 2.
  - A headless runner launch may not call `python3` from Bash, so task-093's four Python commands
    ran only through `npm run test` (the tests drive them; `check_tasks.py v0.3.1` on a copy tree).
    Run directly at this gate on `24309852`: `python3 docs/03_backlog/X_tools/check_tasks.py v0.3.1`
    "12 tasks … OK", `check_releases.py` "5 minor + 1 patch … OK", `check_backlog.py` "all checks
    passed" (the v0.3.1 exit criteria of task-093 and of planning finding 4).

## Sprint Review

<!-- What the Increment showed the stakeholders, and what changes in the Product Backlog. -->
