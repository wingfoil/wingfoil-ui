---
id: task-011-action-descriptor
type: task
title: "Action descriptor"
status: pending
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-06"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-005-cli-contracts-and-direct-reads"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The action descriptor of spec-003 computed from `memory.yaml` states for every element: state kind, verbs at 0.2.2, actor, placement, enablement, tone — with no type or state name in code outside `server/presets/` (REQ-ARC-05). In v0.1 it drives the read-only views, buckets and tones; no write uses it yet.

**Backlog items:** TT-ARC-06, TT-ARC-05

## Acceptance Criteria

- **TT-ARC-06** (REQ-ARC-06 — Action descriptor derived from the project): [percentage] A table-driven unit test over the elements of the three fixtures yields the expected verbs, reject targets, required role and actor for 100 % of the rows. *Verified by:* unit (table-driven) · e2e.
- **TT-ARC-05** (REQ-ARC-05 — Methodology independence): [boolean] The same build renders and acts on the `kanban`, `custom` and `unknown` fixtures with every scenario of the release passing; a lint rule finds 0 string literals equal to a type or state name of the three fixtures in `server/` and `web/` outside `presets/` and tests. *Verified by:* e2e on the three fixtures · lint.
  Scenarios (`@v0.1`): S-28.1, S-28.2, M-02.1, M-02.2, M-02.3.

## Implementation Notes

- `spec-003-action-descriptor` (whole); REQ-ARC-05 lint (no type/state literal outside `presets/` and tests).
- Scenarios that need a screen are proved here by API and unit tests against the same
  fixtures; their e2e run closes in the `web` task that depends on this one.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
