---
id: task-006-wingfoil-version-range-and-capabilities
type: task
title: "WingFoil version range and capabilities"
status: pending
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-INT-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Detect each project's WingFoil version, compare it with the supported range (0.2.2 → highest contract-tested), open out-of-range projects read-only with the reason, and the capability table (`contracts/capabilities.json`) that hides or disables what a version lacks (adr-001 D3, spec-001 §6).

**Backlog items:** TT-INT-02, TT-INT-03

## Acceptance Criteria

- **TT-INT-02** (REQ-INT-02 — Supported WingFoil range): [boolean] A fixture pinning a version below or above the range opens with 0 enabled actions and the reason naming the range; a version inside it passes every scenario of the release. *Verified by:* e2e · README review.
  Scenarios (`@v0.1`): S-08.1, S-09.1, S-09.2.
- **TT-INT-03** (REQ-INT-03 — Capability detection: read-only or hidden): [boolean] Every listed scenario passes on WingFoil 0.2.2; the capability table in `contracts/` declares a minimum version for 100 % of the capabilities. v0.1 (version notice): the table exists with a minimum version for every capability, and the project header shows the version and the version notice (S-08.1, S-08.2). *Verified by:* e2e · unit.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-016-project-header-version-identity-and-role-view: S-08.1, S-09.1, S-09.2.

## Implementation Notes

- `adr-001` D3; `spec-001` §6 (`capabilities.json`), §5 (`matrix.json`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
