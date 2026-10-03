---
id: task-005-cli-contracts-and-direct-reads
type: task
title: "CLI contracts and direct reads"
status: draft
release: "v0.1"
module: ""             # optional — server | web | contracts (dna.yaml modules)
priority: ""           # optional — high | medium | low
tags: ["v0.1"]
ref: ""                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

<!-- What needs to be built and why. Reference the user story if applicable:
     "As <persona>, I want <action> so that <benefit>." -->

## Acceptance Criteria

<!-- Reference the Gherkin feature file, or inline the key scenarios.
     e.g. "See docs/02_requirements/02_bdd/features/today/pending-gates.feature"
     For `web` tasks also point to the screen in docs/00_reference/ux-reference.md (§4.x) and the
     prototype, and state the accessibility bar (keyboard path, axe clean). -->

## Implementation Notes

<!-- Optional: known constraints, design hints, or links to relevant ADRs. -->

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
