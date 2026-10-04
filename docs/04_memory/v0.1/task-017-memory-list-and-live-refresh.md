---
id: task-017-memory-list-and-live-refresh
type: task
title: "Memory list and live refresh"
status: pending
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-M-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-010-snapshot-cache-and-live-updates", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The Memory list (the v0.1 landing view): type filters from `memory.yaml` with counts, state filters and the generic buckets (*To approve*, *In progress*, *Done*, … as defined in the header of `features/m/memory-list.feature`, computed from the descriptor's state kinds, spec-003 §2), unknown types and states under their own names, rows opening the element panel (task-018), the local-changes marker, live refresh from the event stream, the same build on the three fixtures.

**Backlog items:** US-M-01, US-M-02, US-S-25, US-S-26, US-S-28

- US-M-01 — As a member, I want the Memory list with type filters from `memory.yaml` (with counts) and state filters (buckets for all types, real states per type), each item opening its panel, so that I find any element
- US-M-02 — As a member, on a project with types and states unknown to the UI, I want them listed under their own names and grouped in generic buckets, so that nothing is hidden because it is unfamiliar
- US-S-25 — As a member, I want the UI to show the project as the CLI reads it — the working tree — with elements that have uncommitted changes marked local changes, so that what I see is what the CLI would act on
- US-S-26 — As a member, I want the views to refresh by themselves after a new commit or a file change, so that I never act on a stale screen
- US-S-28 — As Alex, I want a Kanban project, the WingFoil (`custom`) project and a project with unknown types and states and no `ui.yaml` to render with no UI code change, the actions derived from each project's own definitions, so that the UI fits any methodology

## Acceptance Criteria

- **US-M-01** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/m/memory-list.feature`: M-01.1 Filter by type with counts; M-01.5 List one type with its real states; M-01.2 Filter all types by bucket; M-01.3 Open the element panel from the list; M-01.4 Show a type with no element
- **US-M-02** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/m/memory-list.feature`: M-02.1 List unknown types under their own names; M-02.3 Show the declared states of an unknown type; M-02.2 Group unknown states in generic buckets
- **US-S-25** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/snapshot.feature`: S-25.1 Mark an element with uncommitted changes; S-25.2 Remove the marker once the change is committed; S-25.3 Show an uncommitted new element
- **US-S-26** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/snapshot.feature`: S-26.1 Refresh after a commit made outside the UI; S-26.2 Refresh an open element panel; S-26.3 Read the CLI once per state of the repository
- **US-S-28** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/action-descriptor.feature`: S-28.1 Render each fixture with the same UI build; S-28.2 Derive the state machine of an unknown type

Screen: `docs/00_reference/ux-reference.md` §4.4 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- Buckets: header of `features/m/memory-list.feature`; state kinds and tones: `spec-003` §2, §7; `spec-004` §3, §6; `spec-009` tones; `ux-reference.md` §4.4; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
