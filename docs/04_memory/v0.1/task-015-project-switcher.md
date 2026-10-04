---
id: task-015-project-switcher
type: task
title: "Project switcher"
status: pending
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-16"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-008-project-list-api", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-017-memory-list-and-live-refresh", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The project switcher: list in stored order, switch project (closing the previous project's panel), remove with confirmation, unavailable entries (folder or CLI missing) with recovery, opaque ids in every URL.

**Backlog items:** US-S-16, US-S-17, US-S-18, US-S-19, US-X-05

- US-S-16 — As Alex, I want to switch project from the project switcher and see the same screens in the other project's vocabulary, with nothing of the first project left on screen, so that I work on several projects at once
- US-S-17 — As Alex, I want my project list kept across restarts of the console, so that I add each project once
- US-S-18 — As Alex, I want to remove a project from the list without touching its files, so that I keep the list tidy
- US-S-19 — As Alex, I want a project whose folder was moved or deleted shown as unavailable, with the option to remove it, so that one missing folder does not break the console
- US-X-05 — As a member, I want URLs to carry opaque project ids, never file-system paths, so that my folder layout is not exposed

## Acceptance Criteria

- **US-S-16** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-16.1 Switch to another project; S-16.2 Close the element panel of the previous project on switch
- **US-S-17** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-17.1 Keep the project list after a restart; S-17.2 Keep the list out of every project repository
- **US-S-18** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-18.1 Remove a project from the list; S-18.2 Cancel the removal
- **US-S-19** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/projects.feature`: S-19.1 Show a moved project as unavailable; S-19.2 Recover when the folder comes back
- **US-X-05** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/local-security.feature`: X-05.1 Use opaque project ids in URLs; X-05.2 Refuse a project id that is not in the list

Also closes the e2e of **X-02.1** (US-X-02, task-003): the fragment is removed from the address bar and the switcher lists the fixture.

Screen: `docs/00_reference/ux-reference.md` §3 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-006` §2–3; `spec-004` §3; `ux-reference.md` §3; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
