---
id: task-009-identity-and-role-views
type: task
title: "Identity and role views"
status: pending
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-STATE-05"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Identity from `git config user.email` matched against `dna.team.members` (single role, several roles, not in team, no identity, duplicates), refreshed when the email changes, and the role views per member, remembered per project (`PUT /api/p/:pid/role-view`, spec-006 `roleView`).

**Backlog items:** TT-STATE-05, TT-STATE-06

## Acceptance Criteria

- **TT-STATE-05** (REQ-STATE-05 — Identity from git): [boolean] Every listed scenario passes; the identity shown always equals the member whose email matches `git config user.email` of the fixture. *Verified by:* unit · e2e.
  Scenarios (`@v0.1`): S-12.1, S-12.2, S-12.3, S-13.1, S-13.3, S-14.1, S-14.2, S-15.1, S-15.3.
- **TT-STATE-06** (REQ-STATE-06 — Role views): [boolean] The role view selector lists exactly the member's roles; switching changes Today's list as the action descriptor computes it for that role. *Verified by:* e2e.
  Scenarios (`@v0.1`): S-22.1, S-22.2, S-22.3.

## Implementation Notes

- `adr-001` (identity from git); `spec-004` §3 (`/api/p/:pid`, `role-view`); `spec-006` §2 `roleView`; `spec-003` §5 (placement per role view).
- Scenarios that need a screen are proved here by API and unit tests against the same
  fixtures; their e2e run closes in the `web` task that depends on this one.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
