---
id: F-044
title: "An optional phase has no per-element condition: its `checks.pre` are never run, so it is offered for every element"
kind: gap
status: open
wingfoil_version: 0.3.2
answered_by: []
---

Reports W-56.

## Observed

WingFoil 0.3.2 from npm (`0.3.2 (6de2e13c004bbf419acfa7dc4d98d5a7468cd693)`), Linux, 2026-11-25, on a throwaway
clone of this repository with `backlog-item` changed to `start · design · red · green · refactor · review · approve ·
done`, `red` declared `optional: true` with `checks: { pre: [flow-tdd] }` and `flow-tdd` bound in
`.wingfoil/workflows/bindings.yaml`:

- After `memory submit` of a task and `workflow finalize --step backlog-item.design@task:<id>`, `workflow next` prints
  `next step: backlog-item.red@task:<id>` and `also ready: backlog-item.green@task:<id>`, for every task alike, whatever
  its frontmatter.
- `flow-tdd` is never run: `workflow show backlog-item` lists it under `checks.pre` with its binding, and nothing else
  reads it.
- After `workflow finalize --step backlog-item.green@task:<id>`, `red` leaves the frontier: an optional phase is left
  only when a later phase of the same element completes.
- Routing the tasks with no red-first criterion to a second sub-workflow through a second iteration of
  `sprint.development` (`where: { flow: [direct] }`) waits for the whole first iteration, since phases run in order: a
  task of the second depended on by one of the first never starts.

## Expected

A per-element condition on a phase: an optional phase skipped for an element when its `checks.pre` are unmet, as
WingFoil v1.0 plans (spec-003 `optional`, P4.12). Until then this repository's script runner (1.2.6) runs the pre
checks and skips the step per element (dl-028).
