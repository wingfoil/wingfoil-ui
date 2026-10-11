---
id: task-024-record-the-wingfoil-source-key-in-the-feedback-inbox
type: task
title: "Record the WingFoil source key in the feedback inbox"
status: draft
release: "v0.1"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "low"        # optional — high | medium | low
tags: ["v0.1","governance","feedback-loop"]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Record the WingFoil source key of this repository's feedback inbox. WingFoil (wingfoil/wingfoil)
registered the inbox as service **`svc-019`**
(`svc-019-github-repository-wingfoil-ui-a-private-consumer-project-and-its-feedback-inbox`, status
`active`, approval pushed on WingFoil `origin/main` `30b268a3`, WingFoil task-269). Until now
`docs/wingfoil-feedback/README.md` says "**Source key:** to be set". Requested by the session
coordinating the WingFoil ecosystem (cross-project item "task 001"), to be done at a wave boundary
(approver ruling of 2026-10-10): end of Wave 5 of minor-v0.1, after task-021. Governance task:
`module: governance`, `ref: GOV` (no backlog item; accepted by `check_tasks.py`), as task-022/023.

**Backlog items:** GOV (governance — no backlog item)

## Acceptance Criteria

- `docs/wingfoil-feedback/README.md`: "**Source key:**" states `svc-019`, the full service id and
  "active since WingFoil `30b268a3`"; the citation form `<source key>/F-<nnn>@<sha>` is kept (e.g.
  `svc-019/F-001@<sha>`).
- Nothing else in the inbox changes (notes F-001…F-019, ledger, rules); `test/wingfoil-feedback.test.ts`
  and `format:check` stay green.
- Committed and pushed to `origin/main`; the coordinating session is told the task id, the commit and
  the push state.

## Implementation Notes

- One-paragraph edit of the README only; no code, no directive change (`wingfoil-cli` 1.6 already
  refers to the README for the source key).

## Execution Notes

