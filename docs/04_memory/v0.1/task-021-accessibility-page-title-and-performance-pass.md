---
id: task-021-accessibility-page-title-and-performance-pass
type: task
title: "Accessibility page title and performance pass"
status: pending
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-X-06"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-014-add-project-modal", "task-015-project-switcher", "task-016-project-header-version-identity-and-role-view", "task-017-memory-list-and-live-refresh", "task-018-element-panel-read-only", "task-019-dna-directives-and-team-views", "task-020-documentation-index-and-links"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The closing pass over every v0.1 screen: keyboard reachability with visible focus, the browser tab title, light and dark themes with AA contrast (system preference), every string from the catalogue on the key-rendering build, axe-core with 0 serious/critical violations in both themes, and the p95 ≤ 1.0 s measurement of the views with a warm cache (closing the TT-PERF-04 dependency of US-M-01, US-G-01, US-R-05…R-08).

**Backlog items:** US-X-06, US-X-10, TT-ARC-10, TT-PERF-04, US-X-08, US-X-09, TT-ARC-09, TT-ARC-11

- US-X-06 — As a member who uses only the keyboard, I want every MVP screen and action reachable and operable from the keyboard with a visible focus, so that I can use the console without a mouse
- US-X-10 — As Alex, I want the browser tab title to name the project, its state (phase or completion, when the release shows it) and the current view or element, before "WingFoil UI", so that I tell my projects and views apart among my tabs
- US-X-08 — As a member, I want light and dark themes with AA contrast in each, following my system by default (a choice in the UI settings from v0.2), so that the console is readable in any setting
- US-X-09 — As Alex, I want every UI string externalised (English only in the MVP), so that a second language can be added without touching the screens

## Acceptance Criteria

- **US-X-06** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/accessibility.feature`: X-06.1 Reach every v0.1 screen with the keyboard; X-06.3 Close the element panel with Escape; X-06.4 Pass the axe scan
- **US-X-10** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/accessibility.feature`: X-10.1 Name the project and the view in the tab title; X-10.2 Name the open element in the tab title; X-10.3 Title the project list when no project is open
- **TT-ARC-10** (REQ-ARC-10 — Accessibility WCAG 2.1 AA): [numeric] axe-core reports 0 violations of impact serious or critical on every screen of the release in both themes; focus indicators have a contrast ratio ≥ 3:1; every gate action is completed with the keyboard alone; scenarios X-07.1, X-07.2, X-07.3 (live regions, accessible descriptions) and X-10.1 … X-10.5 (page title) pass. v0.1 (no gate action): axe and focus contrast on the v0.1 screens, X-06.1, X-06.3, X-06.4 and X-10.1 … X-10.3 pass. *Verified by:* e2e-smoke `accessibility`.
  Scenarios (`@v0.1`): X-06.1, X-06.3, X-06.4, X-10.1, X-10.2, X-10.3.
- **TT-PERF-04** (REQ-PERF-04 — Other views): [numeric] p95 ≤ 1.0 s with a warm cache. *Verified by:* e2e performance run.
  Scenarios (`@v0.1`): M-01.1, G-01.1, R-05.1, R-06.1, R-07.1, R-08.1.
- **US-X-08** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-08.1 Follow the system's dark preference; X-08.2 Follow a change of the system preference
- **US-X-09** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-09.1 Render every string from the message catalogue; X-09.2 Keep project data untranslated
- **TT-ARC-09** (REQ-ARC-09 — Externalised strings): [percentage] With a build that renders catalogue keys instead of messages, 100 % of the visible non-project text on every screen of the release is a catalogue key. *Verified by:* e2e (key-rendering build).
  Scenarios (`@v0.1`): X-09.1, X-09.2.
- **TT-ARC-11** (REQ-ARC-11 — Light and dark themes): [numeric] In each theme every text has a contrast ratio ≥ 4.5:1 (≥ 3:1 for large text) against its background, measured by axe-core on every screen of the release. *Verified by:* e2e-smoke `accessibility`.
  Scenarios (`@v0.1`): X-08.1, X-08.2.

Screen: `docs/00_reference/ux-reference.md` every v0.1 screen and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- Directive `accessibility`; `spec-008` §3 (page title keys), §6 (key-rendering build); `spec-009` §1, §3, §5.
- Depends on every v0.1 screen task: run last.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
