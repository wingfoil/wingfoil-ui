---
id: task-019-dna-directives-and-team-views
type: task
title: "DNA directives and team views"
status: in-progress
release: "v0.1"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.1"]
ref: "US-R-05"                # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-004-tests-time-out-under-extreme-machine-load"] # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-009-identity-and-role-views", "task-012-project-read-api", "task-013-web-shell-themes-and-message-catalogue", "task-017-memory-list-and-live-refresh", "task-018-element-panel-read-only"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The DNA view (modules, stacks, methodologies, team and roles, paths), the Directives view (bound roles, *only mine / all*, body), the Team view (member cards, roles, pending gates, agents marked), the element panel's *Directives* section linking to the Directives view (US-G-02), and a failed CLI read confined to its view with the CLI's message and automatic recovery.

**Backlog items:** US-R-05, US-R-06, US-R-07, US-S-27, US-G-02

- US-R-05 — As Riley, I want a DNA view (modules, stacks, methodologies, team and roles, paths), so that I understand how the project is set up
- US-R-06 — As Jordan, I want the directives with their bound roles, filterable "only mine / all", with the body rendered, so that I know the standards I work under
- US-R-07 — As Morgan, I want a team view with member cards, roles and pending gates per member, agents marked "never approve", so that I know who can act on what
- US-S-27 — As a member, I want a CLI read that fails (e.g. a malformed governance file) shown as an error with the CLI's message on the affected view, the rest of the UI usable, so that one broken file does not hide the project
- US-G-02 — As Sam, I want the element panel to show the directives that apply to the element's roles, so that I review against the standards that apply

## Acceptance Criteria

- **US-R-05** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/dna.feature`: R-05.1 Show the project's DNA; R-05.2 Show an empty DNA section as empty
- **US-R-06** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/directives.feature`: R-06.1 Filter the directives bound to my role; R-06.2 Show every directive with "all"; R-06.3 Render a directive body; R-06.4 Show "only mine" empty for a user who is not in the team
- **US-R-07** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/r/team.feature`: R-07.1 Show members with their roles and pending gates; R-07.2 Mark agents as never approving; R-07.3 Filter members with pending gates
- **US-S-27** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/snapshot.feature`: S-27.1 Confine a failed DNA read to the DNA view; S-27.2 Recover when the file is fixed
- **US-G-02** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/element-panel.feature`: G-02.1 Show the directives that apply to the element's roles; G-02.2 Open a directive from the panel

- **bug-004-tests-time-out-under-extreme-machine-load** (absorbed, dl-045) — the default gates fail only on wrong values, not on external load: one shared cold-read timeout in `test/e2e/support/` used by every e2e spec's first load (element panel, Memory list, documentation, this task's views); a longer async default for the web component tests; `test/lint/lint-clean.test.ts` and the process-spawning tests sized or isolated for the measured worst case; evidence recorded at integration (a full `test:coverage` + `test:e2e` run at load ≥ 30 with no timeout).

Screen: `docs/00_reference/ux-reference.md` §4.5, §4.6, §4.10 and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1).

## Implementation Notes

- `spec-004` §3 (`/config`, `/directives`); `ux-reference.md` §4.2 (panel directives), §4.5, §4.6, §4.10; prototype.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
