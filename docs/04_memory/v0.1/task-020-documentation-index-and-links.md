---
id: task-020-documentation-index-and-links
type: task
title: "Documentation index and links"
status: pending
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-R-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-012-project-read-api", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The documentation index under `paths.docs` (without Memory and plan files), the markdown document view (markdown-it + DOMPurify), links to Memory files opening the element panel, and links that leave the repository marked and refused.

**Backlog items:** US-R-08, US-R-09

- US-R-08 — As Riley, I want an index of the documents under `paths.docs`, without the Memory and plan files, rendered as Markdown with links that stay in the UI, so that I read the project's documentation in one place
- US-R-09 — As Riley, I want a document link to a Memory file to open its element panel, and a link that leaves the repository or points nowhere marked as such, so that every link is safe to follow

## Acceptance Criteria

- **US-R-08** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/documentation.feature`: R-08.1 Index the documents without Memory and plan files; R-08.2 Render a document inside the UI; R-08.3 Follow a link between indexed documents inside the UI
- **US-R-09** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/documentation.feature`: R-09.1 Open a linked Memory file in the element panel; R-09.2 Mark a link that points nowhere; R-09.3 Mark a link that leaves the repository; R-09.4 Open an external link in a new tab

Screen: `docs/00_reference/ux-reference.md` §4.9 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-004` §3 (`/docs`, `/files/content`); `adr-002` (markdown-it + DOMPurify); `ux-reference.md` §4.9; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
