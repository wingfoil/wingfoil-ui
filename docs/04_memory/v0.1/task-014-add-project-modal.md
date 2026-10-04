---
id: task-014-add-project-modal
type: task
title: "Add project modal"
status: pending
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-03"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-008-project-list-api", "task-013-web-shell-themes-and-message-catalogue", "task-015-project-switcher", "task-017-memory-list-and-live-refresh"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The *Add project* modal: local folder or remote git URL with the auto-filled working directory, every refusal of spec-006 §3 rendered from the catalogue, the clone progress, and the *WingFoil CLI not found* case with the install command.

**Backlog items:** US-S-03, US-S-04, US-S-05, US-S-06, US-S-07, US-S-10

- US-S-03 — As Alex, I want to add a local folder holding a WingFoil project, so that I can browse it (in v0.1 it opens on the Memory list)
- US-S-04 — As Alex, I want to add a project from a remote git URL, with the working directory auto-filled and the clone made for me, so that I do not clone it by hand
- US-S-05 — As Alex, I want a folder that is not a WingFoil project (no `.wingfoil/`) refused with the reason, so that the list holds only projects the UI can read
- US-S-06 — As Alex, I want a second add of a repository already in the list (same remote, or a working copy of it) refused with a pointer to the existing entry, so that one project never shows twice
- US-S-07 — As Alex, I want a failed clone (unreachable URL, authentication refused, target folder not empty) reported with git's reason and nothing added, so that I know what to fix
- US-S-10 — As Alex, I want a project with no `wingfoil` CLI (neither in its `node_modules` nor on the PATH) not opened, with install instructions, so that I know how to make it readable

## Acceptance Criteria

- **US-S-03** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-03.1 Add a local WingFoil folder; S-03.2 Refuse a path that does not exist
- **US-S-04** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-04.1 Auto-fill the working directory of a remote; S-04.3 Clone the remote on confirm; S-04.2 Use a working directory I typed instead of the auto-filled one
- **US-S-05** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-05.1 Refuse a folder without .wingfoil/; S-05.2 Refuse a remote whose clone has no .wingfoil/
- **US-S-06** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-06.1 Refuse the same local folder twice; S-06.2 Refuse a second working copy of a known remote
- **US-S-07** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-07.1 Report an unreachable remote; S-07.2 Refuse a working directory that is not empty; S-07.3 Report a refused authentication
- **US-S-10** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-10.1 Do not open a project with no CLI; S-10.2 Mark a listed project whose CLI disappeared

Screen: `docs/00_reference/ux-reference.md` §3 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-006` §3 (codes), `spec-008` §4 (errors from codes; tool output verbatim); `ux-reference.md` §3; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
