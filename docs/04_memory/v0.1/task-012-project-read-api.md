---
id: task-012-project-read-api
type: task
title: "Project read API"
status: backlog
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-SEC-06"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-006-wingfoil-version-range-and-capabilities", "task-007-local-state-store", "task-009-identity-and-role-views", "task-010-snapshot-cache-and-live-updates", "task-011-action-descriptor"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The v0.1 read routes of spec-004 §3 — `GET /api/server`, `/api/p/:pid`, `/config` (without `ui.yaml`, from v0.3), `/elements`, `/elements/:eid`, `/elements/:eid/history`, `/directives`, `/directives/:did`, `/docs`, `/files/tree`, `/files/content` — assembled from the adapter, the snapshot and the descriptor, with confinement of every path to the repository.

**Backlog items:** TT-SEC-06

## Acceptance Criteria

- **TT-SEC-06** (REQ-SEC-06 — Confinement to the repository): [percentage] 100 % of the path-traversal cases of the security suite (`..`, encoded `..`, absolute paths, escaping symlinks) return 404 or the "outside the repository" marker with 0 bytes of the target. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): R-09.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-020-documentation-index-and-links: R-09.3.

## Implementation Notes

- `spec-004` §3 (v0.1 rows), §5; `spec-001` §4 (direct reads); `spec-002` §2 (`memory history` entries for `/history`); `spec-003` §8 (output); `adr-001` D1a, D3 (version and range in `/api/p/:pid`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
