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

## Sprint Review

<!-- What the Increment showed the stakeholders, and what changes in the Product Backlog. -->
