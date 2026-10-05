---
id: task-007-local-state-store
type: task
title: "Local state store"
status: backlog
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-002-launcher-and-http-server-skeleton"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The local state file of spec-006: location per platform and `WINGFOIL_UI_STATE_DIR`, `state.json` schema, opaque project ids, atomic writes, corrupt and newer-version handling, warnings in `GET /api/server`, no secrets.

**Backlog items:** TT-ARC-08, TT-SEC-04, TT-SEC-09

## Acceptance Criteria

- **TT-ARC-08** (REQ-ARC-08 — Local state outside the repositories): [boolean] After the full e2e suite, `git status --porcelain` of every fixture prints only the changes the scenarios made on purpose, and the state survives a server restart. *Verified by:* e2e.
  Scenarios (`@v0.1`): S-17.1, S-17.2, S-22.3.
- **TT-SEC-04** (REQ-SEC-04 — Opaque project ids): [boolean] Across the e2e suite, 0 requested URLs contain a fixture's absolute path; a request for the id `../../etc` gets 404. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): X-05.1, X-05.2.
- **TT-SEC-09** (REQ-SEC-09 — No secrets stored): [boolean] A secret scan over `ui.yaml`, the local state directory and the logs after the e2e suite reports 0 findings. *Verified by:* e2e (secret scan).
  Scenarios (`@v0.1`): X-02.1.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-015-project-switcher: S-17.1, S-17.2, X-05.1, X-05.2, X-02.1; task-016-project-header-version-identity-and-role-view: S-22.3.

## Implementation Notes

- `spec-006-local-state-store` (whole); `adr-001` D10; `spec-004` §3 (`GET /api/server` warnings).
- `dl-002` (permissions left to WingFoil): the state file holds no permission or role grant.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
