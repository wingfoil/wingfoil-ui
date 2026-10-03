---
id: task-004-cli-adapter-discovery-and-invocation
type: task
title: "CLI adapter discovery and invocation"
status: pending
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-002-launcher-and-http-server-skeleton"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The CLI adapter's process runner and discovery: find the observed project's own `wingfoil` (`node_modules/wingfoil` run with `process.execPath`, else the PATH resolved to an absolute path), invoke it with an argument array and `--format json` in the project's working directory, classify results and errors, 30 s timeout, per-project write lock (adr-001 D2, D5; spec-001 §1–2).

**Backlog items:** TT-ARC-02, TT-INT-04

## Acceptance Criteria

- **TT-ARC-02** (REQ-ARC-02 — The observed project's own CLI): [boolean] With a fixture pinning 0.2.2 and `wingfoil` 0.2.1 on the PATH, 100 % of the CLI processes the server starts for that fixture run the pinned binary (process audit); the package `wingfoil-ui` declares no dependency on `wingfoil`. *Verified by:* e2e (process audit) · package.json review.
  Scenarios (`@v0.1`): S-08.1, S-08.2, S-10.1, S-10.2.
- **TT-INT-04** (REQ-INT-04 — CLI invocation and errors): [boolean] Every listed scenario passes; a CLI stub that sleeps 40 s is killed at 30 s ± 1 s and its request returns an error. *Verified by:* unit (stub) · e2e.
  Scenarios (`@v0.1`): S-27.1.

## Implementation Notes

- `adr-001` D2, D5; `spec-001` §1–2; directive `cli-only-writes` (which CLI), `wingfoil-cli` (W-01…W-20).
- Ports: process runner, per-project write lock (`adr-002`).
- Scenarios that need a screen are proved here by API and unit tests against the same
  fixtures; their e2e run closes in the `web` task that depends on this one.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
