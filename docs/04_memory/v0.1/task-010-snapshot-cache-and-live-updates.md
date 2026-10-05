---
id: task-010-snapshot-cache-and-live-updates
type: task
title: "Snapshot cache and live updates"
status: backlog
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-STATE-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-003-session-token-and-request-guards", "task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Working-tree snapshot and cache keyed on HEAD and the working-tree status hash, the local-changes marker per element, batched CLI reads, the repository watcher and the per-page event stream that invalidates views without polling (adr-001 D6, spec-004 §5 `X-Repo-State`, §6).

**Backlog items:** TT-STATE-02, TT-STATE-01, TT-PERF-03, TT-PERF-05, TT-INT-09

## Acceptance Criteria

- **TT-STATE-02** (REQ-STATE-02 — Cache keyed on HEAD and working-tree status): [boolean] A unit test shows a cache miss after a commit and after a working-tree edit, a cache hit when neither changed, and a new identity after a change of `user.email`. *Verified by:* unit.
  Scenarios (`@v0.1`): S-26.1, S-26.3.
- **TT-STATE-01** (REQ-STATE-01 — Working-tree snapshot and local changes): [boolean] For every element file listed by `git status --porcelain`, the element carries the marker; for every other element it does not. *Verified by:* unit · e2e.
  Scenarios (`@v0.1`): S-25.1, S-25.2, S-25.3.
- **TT-PERF-03** (REQ-PERF-03 — Refresh after an external change): [numeric] Change → view updated within 5 s in 20 out of 20 trials. *Verified by:* e2e.
  Scenarios (`@v0.1`): S-25.2, S-26.1, S-26.2, S-27.2, S-12.3, S-13.3, S-15.3.
- **TT-PERF-05** (REQ-PERF-05 — Batched CLI reads): [numeric] Opening Today on a cold cache starts ≤ 6 CLI processes; reopening any view with no commit and no working-tree change starts 0. v0.1 (no Today): opening the Memory list on a cold cache starts ≤ 6 CLI processes. *Verified by:* e2e (process audit).
  Scenarios (`@v0.1`): S-26.3.
- **TT-INT-09** (REQ-INT-09 — Server ↔ browser live updates): [boolean] With one page open and no change for 60 s, the server starts 0 CLI processes; after a change the page updates without a reload (REQ-PERF-03). *Verified by:* e2e (process audit).
  Scenarios (`@v0.1`): S-26.1, S-26.2.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-016-project-header-version-identity-and-role-view: S-12.3, S-13.3, S-15.3; task-017-memory-list-and-live-refresh: S-26.1, S-26.3, S-25.1, S-25.2, S-25.3, S-26.2; task-019-dna-directives-and-team-views: S-27.2.

## Implementation Notes

- `adr-001` D6; `spec-004` §5–6; `adr-002` (event bus, repository watcher ports).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
