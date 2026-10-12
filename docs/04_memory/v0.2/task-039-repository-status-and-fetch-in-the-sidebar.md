---
id: task-039-repository-status-and-fetch-in-the-sidebar
type: task
title: "Repository status and fetch in the sidebar"
status: pending
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-Y-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-033-git-copy-state-repository-status-and-transport-routes", "task-034-auto-sync-scheduler-and-auto-push", "task-037-gate-footer-with-every-outcome"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The repository status in the sidebar (Y1, Y2): branch, ahead/behind, local changes, detached
HEAD, *Fetch* with *Cancel*, the time of the last successful fetch and the last fetch error; the
sync controls and counts hidden without a remote (`has-remote`) and shown again once one is added;
a capability that does not apply hidden, one my role lacks read-only with the reason (S3).

**Backlog items:** US-Y-01, US-Y-02, US-Y-03, US-Y-04, US-S-11

- US-Y-01 — As a member, I want the branch, ahead/behind counts and local changes in the sidebar, so that I know whether my copy is current
- US-Y-02 — As a member, I want the remote fetched automatically (on by default) and on demand, so that ahead/behind is always fresh
- US-Y-03 — As a member, I want a failed fetch (offline, authentication) shown with the time of the last successful fetch, without blocking reading, so that I know how fresh the status is
- US-Y-04 — As a member of a repository with no remote, I want the sync controls hidden, so that the UI does not offer what cannot apply
- US-S-11 — As a member, I want a capability that applies to the project but that its WingFoil version or my role lacks shown read-only with the reason, and one that does not apply hidden, so that I can tell "not now" from "not here"

## Acceptance Criteria

- **US-Y-01** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/repository-status.feature`: Y-01.1 Show branch, ahead/behind and local changes; Y-01.2 Show an up-to-date copy; Y-01.3 Show a detached HEAD
- **US-Y-02** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/fetch.feature`: Y-02.1 Fetch automatically; Y-02.2 Fetch on demand; Y-02.3 Do not fetch when auto-fetch is off
- **US-Y-03** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/fetch.feature`: Y-03.1 Report a failed fetch with the last successful time; Y-03.2 Report a fetch refused for authentication
- **US-Y-04** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/repository-status.feature`: Y-04.1 Hide sync controls without a remote; Y-04.2 Show the controls once a remote is added
- **US-S-11** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/capabilities.feature`: S-11.1 Show a capability my role lacks as read-only with the reason; S-11.2 Hide a capability that does not apply to the project

Also closes Y-01.3 of TT-STATE-04 (task-033-git-copy-state-repository-status-and-transport-routes) and Y-02.1 of TT-PERF-07 (task-034-auto-sync-scheduler-and-auto-push).
RP-53: Y-02.1, Y-02.3 and C-07.3 run in `test:e2e` on the three engines with `fetchIntervalSeconds`
= 15 (its minimum, RP-19); the real 60 s interval and the 65 s / 120 s budgets are measured only
in `test:timing`, on Chromium (RP-44). S-11.1 uses the informational footer of
task-037-gate-footer-with-every-outcome.

Screen: `docs/00_reference/ux-reference.md` §3 (*Git status* in the sidebar, *Sidebar*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-010` §3 (`repository`, `sync.fetch`), §5 (`no-remote`, `no-fetch-target`), §7
  (`has-remote` hides the controls, branch and local changes always shown); `spec-004` §3
  (`conditions`), §6 (`repo`); `spec-001` §6.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
