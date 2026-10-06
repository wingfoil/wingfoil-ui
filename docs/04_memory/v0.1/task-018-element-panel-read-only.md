---
id: task-018-element-panel-read-only
type: task
title: "Element panel read-only"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-G-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The read-only element panel (right drawer), reachable by URL (`/p/:pid/e/:eid`) so that it is built before the Memory list: state machine with the current state, rejection banner, summary, references and history (spec-002 §2). The section of the directives that apply to the element's roles (US-G-02) is added by task-019 with the Directives view.

**Backlog items:** US-G-01

- US-G-01 — As Morgan, I want an element panel with the state machine, rejection banner, summary, references (missing required ones flagged) and history with commits, so that I see everything about an element in one place

## Acceptance Criteria

- **US-G-01** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/element-panel.feature`: G-01.1 Show an element with its state machine and history; G-01.2 Show the rejection banner after a reject; G-01.3 Flag a missing required field; G-01.4 Open an element panel from its URL

Screen: `docs/00_reference/ux-reference.md` §4.2 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-003`; `spec-002` §2 (history entries); `spec-004` §3 (`/elements/:eid`, `/history`); `ux-reference.md` §4.2; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
