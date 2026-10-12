---
id: task-041-ui-settings-page-and-theme-setting
type: task
title: "UI settings page and theme setting"
status: backlog
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-C-07"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-027-e2e-suite-on-firefox-and-webkit", "task-030-ui-settings-store-and-settings-api", "task-034-auto-sync-scheduler-and-auto-push"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The UI settings page (C4): auto-fetch and its interval, auto-update, auto-push, theme, agent
launch confirmation and the action-log cap, stored per user in the local state (never committed),
applied without a restart; the theme setting overrides `prefers-color-scheme` (X-08.3, attached
here by RP-16 — no v0.2 backlog record carries it; on the session-4 audit checklist, RP-50).

**Backlog items:** US-C-07

- US-C-07 — As a member, I want local, per-user settings — auto-fetch, auto-update, auto-push, theme, agent launch confirmation — kept on my machine and never committed, so that my preferences do not change the project

## Acceptance Criteria

- **US-C-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/c/ui-settings.feature`: C-07.1 Show the settings with their defaults; C-07.2 Keep a setting across restarts without touching the project; C-07.3 Apply a setting change without a restart
- **X-08.3** (US-X-08, v0.1 story; RP-16) — `docs/02_requirements/02_bdd/features/x/themes-and-strings.feature`: X-08.3 Override
  the system with the theme setting.

Also closes C-07.1, C-07.3 of TT-STATE-09 (task-030-ui-settings-store-and-settings-api) and C-07.3 of TT-PERF-07 (task-034-auto-sync-scheduler-and-auto-push).
RP-53: Y-02.1, Y-02.3 and C-07.3 run in `test:e2e` on the three engines with `fetchIntervalSeconds`
= 15 (its minimum, RP-19); the real 60 s interval and the 65 s / 120 s budgets are measured only
in `test:timing`, on Chromium (RP-44).
RP-15: "Confirm agent launch" is stored and shown with a note that it takes effect from WingFoil
0.3.

Screen: `docs/00_reference/ux-reference.md` §4.11 (*Configuration*, UI settings part only) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-006` §2 (settings table, ranges, defaults), `spec-004` §3 (`PUT` takes the whole object),
  §6 (`settings` event: other tabs follow); `spec-009` §1 (theme selection), RP-19, RP-26.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
