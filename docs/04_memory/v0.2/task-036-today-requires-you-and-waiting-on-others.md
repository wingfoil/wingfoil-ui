---
id: task-036-today-requires-you-and-waiting-on-others
type: task
title: "Today requires you and waiting on others"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-T-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-027-e2e-suite-on-firefox-and-webkit", "task-031-today-api-and-memory-updates-feed", "task-035-how-to-join-panel"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Today (T1, T4): the greeting with the count and role view, *Requires you* (type, title, reason or
rejection, state pill, age, one primary action) and *Waiting on others* (who must act, with the
basis of a member actor and "Waiting for the workflow engine" for engine-waiting states). A newly
added project opens on Today, which becomes the project's landing route (v0.1 redirects `/p/:pid`
to the Memory list). The *Approve*/*Review*/*Submit* buttons open the element panel; the gate
footer behind them is task-037-gate-footer-with-every-outcome. The progress card, *Next workflow step* and *Recent activity* of
`ux-reference.md` §4.1 are not in v0.2.

**Backlog items:** US-T-01, US-T-02, US-T-03, US-T-04, US-T-05, US-T-06, US-T-11, TT-PERF-01, TT-PERF-09

- US-T-01 — As Alex, I want a newly added project to open on Today for my role view, so that I start from what requires me
- US-T-02 — As Morgan, I want Requires you to list the items whose next move needs a role of my view — type, title, reason, age, one primary action each — so that I prioritise without navigating
- US-T-03 — As Jordan, I want my work rejected back listed first in Requires you, with the rejection reason, so that I fix it before starting anything new
- US-T-04 — As Sam, I want the reviewer view of Requires you to list the items in a review state, so that my review queue is one list
- US-T-05 — As a member, I want an element in a state the UI has no convention for listed as "Action required" with its own state name, so that projects with custom states still show what is pending
- US-T-06 — As Sam, without the `approver` role on WingFoil 0.2.2, I want a gate shown as informational ("reserved to approver", with who can act) instead of an action of mine, so that Today never promises what the CLI will refuse
- US-T-11 — As Morgan, I want Waiting on others to list the items blocked on another role, with the role and the members who hold it, so that I follow up with the right person

## Acceptance Criteria

- **US-T-01** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-01.1 Open a newly added project on Today; T-01.2 Open on Today read-only for a user who is not in the team
- **US-T-02** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-02.1 List the items requiring the approver; T-02.2 Show one primary action per row; T-02.3 Follow the role view
- **US-T-03** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-03.1 List my rejected work first, with the reason; T-03.2 Drop the rejection once the work is submitted again
- **US-T-04** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-04.1 List the items in a review state for a reviewer holding approver; T-04.2 Drop an item that leaves the review state
- **US-T-05** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-05.1 List an undeclared state as "Action required"; T-05.2 Derive the actions of a declared but unfamiliar gate
- **US-T-06** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-06.1 Show a gate as informational to a reviewer without approver; T-06.2 Show the same gate as informational to a product owner without approver
- **US-T-11** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/waiting-on-others.feature`: T-11.1 List the items blocked on another member; T-11.2 Name the workflow engine for an engine-waiting state; T-11.3 Do not repeat an item that requires me
- **TT-PERF-01** (REQ-PERF-01 — Today first render): [numeric] Navigation to Today → cards rendered: p95 ≤ 2.0 s with a warm cache; ≤ 5.0 s for the first open after the server starts. *Verified by:* e2e performance run.
  Scenarios (`@v0.2`): T-01.1, T-02.1.
  Timed: 1 warm-up + 20 runs on the large fixture in `test:timing` (Chromium only, RP-44), warm cache and first open after the start; plus the "after one commit" run of RP-9 (one commit between runs, p95 printed with the load) — if its p95 exceeds ~1 s, spec-002 §4 (incremental parse, v0.3) is reopened with the approver. `test:e2e`: 2 runs, no budget (`support/perf.ts`).
- **TT-PERF-09** (REQ-PERF-09 — Zero navigation to what requires me): [percentage] On each fixture and role view, 100 % of the items the action descriptor assigns to the view's roles are listed on Today, reached with 0 navigation steps after opening the project. *Verified by:* e2e.
  Scenarios (`@v0.2`): T-01.1, T-02.1, S-23.1.
  Here: on kanban, custom and unknown, for every role view of each member, the Today rows equal the `requiresYou` of the API (no navigation after opening the project). S-23.1 closes in task-042-notification-bell-all-roles-summary-and-empty-today.

RP-13: hand-transition states (e.g. `task` `backlog`, `plan` `active` in this repository) appear
in Waiting on others as "Waiting for the workflow engine"; Today offers no action for them.

Screen: `docs/00_reference/ux-reference.md` §4.1 (greeting, *Requires you*, *Waiting on others*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-003` §5 (placement, Today output, button labels per `action`), §7 (tone), §8 (`actor.basis`);
  `spec-004` §3 (`today?view=`), §6 (`repo` → refetch; T-03.2 and T-04.2 within 5 s).
- Moving the landing route touches `web/src/routes/project.tsx` and the v0.1 e2e specs that assume
  the Memory list on `/p/:pid` (e.g. `no-commit.spec.ts`, `SCREENS`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
