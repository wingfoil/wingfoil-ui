---
id: task-005-cli-contracts-and-direct-reads
type: task
title: "CLI contracts and direct reads"
status: pending
release: "v0.1"
module: "contracts"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-INT-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-004-cli-adapter-discovery-and-invocation"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

`contracts/`: one JSON Schema per consumed CLI command and per directly read file shape (`memory.yaml` subset, element frontmatter, directive frontmatter), captured from WingFoil 0.2.2, the support matrix and the contract tests; the server's direct reads restricted to the allow-list, status cross-check with `memory search` (spec-001 §3–7, adr-001 D1a, D4).

**Backlog items:** TT-INT-01, TT-ARC-04

## Acceptance Criteria

- **TT-INT-01** (REQ-INT-01 — CLI JSON contract): [percentage] 100 % of the CLI commands invoked by the server (static list from the adapter) have a schema and a passing contract test for each WingFoil version of the support matrix. *Verified by:* contract tests (e2e-smoke `contract`).
  Scenarios (`@v0.1`): S-27.1.
- **TT-ARC-04** (REQ-ARC-04 — Reads through the CLI, direct reads on an allow-list): [boolean] A unit test with a file-system spy over every read endpoint records 0 direct reads of `.wingfoil/*.yaml` other than `ui.yaml` and `memory.yaml`, 0 reads of Memory or directive files at a path not returned by the CLI, and 0 writes to any of them; every allow-listed shape has a schema and a passing contract test per supported version; a fixture whose element file `status` differs from `memory search` shows a read error for that element. *Verified by:* unit (fs spy).
  Scenarios (`@v0.1`): S-25.1, S-27.1, M-01.1, R-05.1.

## Implementation Notes

- `spec-001` §3–7; `adr-001` D1a, D4; directive `cli-only-writes` §2 (read allow-list); `claim-evidence` (shapes captured from real 0.2.2 output, never from memory).
- Scenarios that need a screen are proved here by API and unit tests against the same
  fixtures; their e2e run closes in the `web` task that depends on this one.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
