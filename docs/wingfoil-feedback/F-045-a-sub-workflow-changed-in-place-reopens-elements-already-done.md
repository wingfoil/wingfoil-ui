---
id: F-045
title: "A sub-workflow changed in place reopens its new phases for elements already in their final state"
kind: gap
status: open
wingfoil_version: 0.3.2
answered_by: []
---

Reports W-57.

## Observed

WingFoil 0.3.2 from npm (`0.3.2 (6de2e13c004bbf419acfa7dc4d98d5a7468cd693)`), Linux, 2026-11-25, on this repository with
`backlog-item` changed in place from version 1 (`start · build · review · approve · done`) to version 2 (`start · design
· red · green · refactor · review · approve · done`, `red` optional), committed:

- Three tasks in their final state, `done`, belong to the iteration `sprint.development` of a Sprint still open, whose
  `where` is `{ status: [backlog, in-progress, in-review, approved], sprint: "{sprint.id}" }`. `workflow next` offers
  `also ready: backlog-item.design@task:<id>` for each of them; the tasks of a closed Sprint get nothing.
- `workflow list` reports 37 `W_PROVENANCE_ORPHAN` warnings, one for each record of `backlog-item.build` in the
  life cycle's plan: `… names backlog-item.build@task:<id>, which the registry does not declare: it is evidence of
  nothing`.
- `workflow finalize --step backlog-item.<phase>@task:<id> --reason "…"` for `design`, `green` and `refactor` of each
  task takes them off the frontier; `red`, optional, goes by itself.

## Expected

A changed workflow that leaves an element already in its type's final state complete (or a `version` on the workflow
that an open iteration keeps until it closes), so a governance change does not offer steps on finished work; a
removed phase's records read as history, not as orphans.
