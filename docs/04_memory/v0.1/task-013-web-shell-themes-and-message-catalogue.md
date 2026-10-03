---
id: task-013-web-shell-themes-and-message-catalogue
type: task
title: "Web shell themes and message catalogue"
status: pending
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-S-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-001-workspace-tooling-and-e2e-harness", "task-003-session-token-and-request-guards"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The web application shell: React + Vite, TanStack Router/Query, React Aria Components, the session bootstrap from the URL fragment, the theme tokens and theme selection of spec-009, the message catalogue, key-rendering build and lint of spec-008, and the empty start page with the project switcher and *Add project…*.

**Backlog items:** US-S-01, TT-ARC-09, TT-ARC-11, US-X-08, US-X-09

- US-S-01 — As Alex, I want to start the console with `npx wingfoil-ui` and have the browser open on it, so that I use it without installing anything beyond Node 22
- US-X-08 — As a member, I want light and dark themes with AA contrast in each, following my system by default (a choice in the UI settings from v0.2), so that the console is readable in any setting
- US-X-09 — As Alex, I want every UI string externalised (English only in the MVP), so that a second language can be added without touching the screens

## Acceptance Criteria

- **US-S-01** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/launch.feature`: S-01.1 Start the console with npx; S-01.2 Refuse to start on an unsupported Node.js version; S-01.3 Start without opening a browser when none is available
- **TT-ARC-09** (REQ-ARC-09 — Externalised strings): [percentage] With a build that renders catalogue keys instead of messages, 100 % of the visible non-project text on every screen of the release is a catalogue key. *Verified by:* e2e (key-rendering build).
  Scenarios (`@v0.1`): X-09.1, X-09.2.
- **TT-ARC-11** (REQ-ARC-11 — Light and dark themes): [numeric] In each theme every text has a contrast ratio ≥ 4.5:1 (≥ 3:1 for large text) against its background, measured by axe-core on every screen of the release. *Verified by:* e2e-smoke `accessibility`.
  Scenarios (`@v0.1`): X-08.1, X-08.2.
- **US-X-08** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-08.1 Follow the system's dark preference; X-08.2 Follow a change of the system preference
- **US-X-09** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-09.1 Render every string from the message catalogue; X-09.2 Keep project data untranslated

Screen: `docs/00_reference/ux-reference.md` §1–3, §9 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-008-message-catalogue`, `spec-009-theme-tokens`, `spec-004` §2 (fragment → session); `adr-002` (web stack).
- `ux-reference.md` §1–3, §5, §9; prototype `docs/00_reference/prototype/`; directives `accessibility`, `ux-consistency`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
