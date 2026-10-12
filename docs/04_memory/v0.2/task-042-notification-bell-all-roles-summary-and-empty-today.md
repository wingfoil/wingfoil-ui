---
id: task-042-notification-bell-all-roles-summary-and-empty-today
type: task
title: "Notification bell all-roles summary and empty Today"
status: pending
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-S-21"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-031-today-api-and-memory-updates-feed", "task-036-today-requires-you-and-waiting-on-others", "task-037-gate-footer-with-every-outcome"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The notification bell (S7) with the count of items to unblock and its panel (*To unblock* = the
Requires you rows, *Updates* = the last 10 Memory events), the all-roles summary on Today (S5) for
a member holding several roles, and the explicit "Nothing requires you" state, also reached after
the last action. First candidate to defer with task-029-npm-publishing-pipeline-and-registry-setup-checklist if the
budget runs short (RP-51).

**Backlog items:** US-S-21, US-S-23, US-T-07

- US-S-21 — As Morgan, I want a bell with the count of items to unblock and a list of updates, so that I know how much is waiting before opening anything
- US-S-23 — As Alex, I want an all-roles summary on Today — for each role I hold, the count and top items requiring it — so that I know which hat to put on first
- US-T-07 — As Morgan, I want an explicit "nothing requires you" state when the list is empty, so that I know the list is current, not broken

## Acceptance Criteria

- **US-S-21** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/shell.feature`: S-21.1 Count the items to unblock; S-21.2 Show no count when nothing requires me; S-21.3 Update the count after an action
- **US-S-23** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/shell.feature`: S-23.1 Summarise what requires each of my roles; S-23.2 Switch role view from the summary; S-23.3 Show no summary to a single-role member; S-23.4 Show at most 3 items per role
- **US-T-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/t/requires-you.feature`: T-07.1 Say that nothing requires me; T-07.2 Reach the empty state after the last action

Also closes S-21.1, S-23.4 of TT-PERF-11 (task-031-today-api-and-memory-updates-feed) and S-23.1 of TT-PERF-09 (task-036-today-requires-you-and-waiting-on-others).

Screen: `docs/00_reference/ux-reference.md` §3 (*Notifications*), §4.1 (greeting, *Requires you* empty state) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-003` §5 (`summary`, bell count = `requiresYou` length); `spec-004` §3 (`events/memory`),
  §6 (`repo`/`write` → refetch: S-21.3 after an action); the "configured channel" footer of
  `ux-reference.md` §3 is not in v0.2.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
