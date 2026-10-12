---
id: task-040-update-and-push-from-the-sidebar
type: task
title: "Update and push from the sidebar"
status: pending
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-Y-05"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-038-submit-footer-action-toasts-and-blocked-actions", "task-039-repository-status-and-fetch-in-the-sidebar"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

*Update* and *Push* in the sidebar (Y3, Y4): the fast-forward update with the refusals that name
the terminal command (diverged, local changes in the way), the last update error, *Push* with
*Cancel* when auto-push is off, rejected pushes as a red toast with git's reason, and governed
actions blocked while the copy is behind, with an *Update* link in the footer's reason (G-12).

**Backlog items:** US-Y-05, US-Y-06, US-Y-07, US-Y-08, US-G-12

- US-Y-05 — As a member, I want Update to fast-forward my copy (`git pull --ff-only`), automatically when my settings say so, so that governed actions are unblocked
- US-Y-06 — As a member, I want an update that cannot fast-forward (diverged history, local changes in the way) to leave actions blocked and tell me what to run in the terminal, so that the UI never merges or rebases
- US-Y-07 — As a member, I want UI commits pushed automatically when my settings say so (off by default), or with Push, so that nothing committed from the UI stays unshared by accident
- US-Y-08 — As a member, I want a rejected push (remote moved, no permission) shown as a red toast with git's reason, the commit kept local and counted as ahead, so that I know it is not shared yet
- US-G-12 — As a member, I want governed actions blocked while my copy is behind the remote, with a link to Update, so that I never act on a stale copy

## Acceptance Criteria

- **US-Y-05** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/update.feature`: Y-05.1 Update a copy that is behind; Y-05.2 Update automatically after a fetch; Y-05.3 Update with local changes that do not touch the incoming files
- **US-Y-06** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/update.feature`: Y-06.1 Refuse to merge diverged histories; Y-06.2 Refuse an update that local changes are in the way of
- **US-Y-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/push.feature`: Y-07.1 Push with the button; Y-07.2 Keep auto-push off by default; Y-07.3 Push automatically after a UI action
- **US-Y-08** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/y/push.feature`: Y-08.1 Report a push rejected because the remote moved; Y-08.2 Report a push refused for permission
- **US-G-12** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/blocked-actions.feature`: G-12.1 Block governed actions while behind; G-12.2 Unblock after the update; G-12.3 Do not block when the copy is only ahead

Also closes the sidebar step of G-13.2 ("1 commit to push", RP-52): the scenario is owned by
task-038-submit-footer-action-toasts-and-blocked-actions (US-G-13), which proves its toast; this
task adds the sidebar assertion to the same e2e test.

Also closes G-12.1, G-12.2, G-12.3, Y-05.1, Y-06.1, Y-06.2 of TT-STATE-04 (task-033-git-copy-state-repository-status-and-transport-routes), Y-05.2 of
TT-PERF-07 (task-034-auto-sync-scheduler-and-auto-push) and Y-07.2 of TT-STATE-09 (task-030-ui-settings-store-and-settings-api).

Wording (spec review round 3): when this task touches the vision, story-map or
`update.feature` texts that describe *Update*, it rewords them so that the user's *Update* is
`git pull --ff-only` and the automatic update a fast-forward `merge --ff-only` of the fetched
upstream (`03_is-isnot.md`, `05_journeys.md`, `06_features.md` Y4, US-Y-05, `update.feature`
header), with doc versions bumped.

Screen: `docs/00_reference/ux-reference.md` §3 (*Git status*: "N commits to push" + Push), §5 (*Feedback*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- RP-53: Y-05.2 (automatic update within 65 s) runs in `test:e2e` on the three engines with
  `fetchIntervalSeconds` = 15 (its minimum, RP-19); the real 65 s budget is measured only in
  `test:timing`, on Chromium (RP-44).
- `spec-010` §4 (manual update not cancellable, RP-37), §5 (catalogue texts, `{files}` with
  `formatList`), §6 (`push` outcome); `spec-003` §6 reasons `copy-behind {commits}`,
  `copy-diverged`, `copy-detached`; `spec-004` §5.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
