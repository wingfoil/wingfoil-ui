---
id: task-008-project-list-api
type: task
title: "Project list API"
status: backlog
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-STATE-07"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-003-session-token-and-request-guards", "task-004-cli-adapter-discovery-and-invocation", "task-007-local-state-store", "task-010-snapshot-cache-and-live-updates"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The project-list routes of spec-004 §3 (`GET/POST/DELETE /api/projects`, `POST /api/projects/clone`) with the integrity rules and refusal codes of spec-006 §3: add a local folder, clone a remote into a new empty folder (write class (c), git allow-list), duplicates (a known remote refused before cloning), removal, computed `availability` (`ok`, `folder-not-found`, `not-wingfoil`, `cli-not-found`, spec-006 §2), and the `projects` event of spec-004 §6 when the list or an availability changes.

**Backlog items:** TT-STATE-07, TT-INT-06, TT-ARC-03

## Acceptance Criteria

- **TT-STATE-07** (REQ-STATE-07 — Project list integrity): [boolean] Every listed scenario passes; after each refused add the list and the file system are unchanged. *Verified by:* e2e.
  Scenarios (`@v0.1`): S-03.2, S-04.3, S-05.1, S-05.2, S-06.1, S-06.2, S-07.1, S-07.2, S-07.3, S-18.1, S-19.1, S-19.2, S-10.2.
- **TT-INT-06** (REQ-INT-06 — Git interface): [percentage] 100 % of the git processes started during the e2e suite use a subcommand of the allowed list (process audit). *Verified by:* e2e (process audit).
  Scenarios (`@v0.1`): S-04.3, S-07.1.
- **TT-ARC-03** (REQ-ARC-03 — Four write classes, nothing else): [percentage] After the full e2e suite, 100 % of the commits created in each fixture are `wf(…)` commits made by a CLI process or `chore(ui)` commits changing exactly `.wingfoil/ui.yaml`; the server process opens 0 files for writing under `.wingfoil/` (other than `ui.yaml`) or under a Memory path (file-system audit); in v0.1 the only write is a clone into a new, empty folder (0 endpoints write an existing repository). *Verified by:* e2e-smoke `drive-browser` (git log check) · file-system audit.
  Scenarios (`@v0.1`): S-04.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-014-add-project-modal: S-03.2, S-04.3, S-05.1, S-05.2, S-06.1, S-06.2, S-07.1, S-07.2, S-07.3, S-10.2; task-015-project-switcher: S-18.1, S-19.1, S-19.2.

## Implementation Notes

- `spec-006` §2–3; `spec-004` §3, §5, §6 (`projects` event); `adr-001` D2, D5, D7 (git allow-list); directive `cli-only-writes` (write class (c)).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
