---
id: task-038-submit-footer-action-toasts-and-blocked-actions
type: task
title: "Submit footer action toasts and blocked actions"
status: in-progress
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-G-10"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-034-auto-sync-scheduler-and-auto-push", "task-037-gate-footer-with-every-outcome"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The single-action footer *Submit* (G3), actions blocked on an element with local changes with the
reason as accessible description, and action feedback (G4): a toast with the result, the `wf(…)`
commit line with its short hash and "pushed" when auto-push pushed it; a red toast with the CLI's
own reason for a refusal, and the catalogue text of 409 `element-changed` when the element moved
in the meantime (RP-12). Toasts and refusals announced to screen readers.

**Backlog items:** US-G-10, US-G-11, US-G-13, US-G-14, US-X-07, TT-PERF-02

- US-G-10 — As Jordan, I want to submit an element from its single-action footer, so that it moves to its next state without the terminal
- US-G-11 — As a member, I want gate and submit actions blocked, with the reason, on an element with local changes, so that a UI action never commits someone's uncommitted edits
- US-G-13 — As Morgan, I want a toast with the result and the `wf(…)` commit (and "pushed" when it was pushed), so that I know the decision is recorded and shared
- US-G-14 — As Morgan, I want a refused action shown as a red toast with the CLI's own reason and the element left unchanged, so that I know what to fix (missing field, wrong role)
- US-X-07 — As a member using a screen reader, I want toasts, state changes and blocked actions announced, so that I know the outcome of what I did

## Acceptance Criteria

- **US-G-10** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/submit.feature`: G-10.1 Submit a draft; G-10.2 Submit rejected work again; G-10.3 Offer no submit on an element waiting on a gate
- **US-G-11** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/blocked-actions.feature`: G-11.1 Block a gate on an element with local changes; G-11.2 Block a submit on an element with local changes; G-11.3 Do not block an element when only another file has local changes
- **US-G-13** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/action-feedback.feature`: G-13.1 Show the commit and "pushed" after an approval; G-13.2 Show the commit without "pushed" when auto-push is off
- **US-G-14** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/action-feedback.feature`: G-14.1 Show the CLI's reason when a submit is refused; G-14.2 Show the refusal when the element moved in the meantime
- **US-X-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/accessibility.feature`: X-07.1 Announce a toast; X-07.2 Announce a refusal assertively; X-07.3 Expose the reason of a blocked action
- **TT-PERF-02** (REQ-PERF-02 — Gate and submit latency): [numeric] p95 ≤ 3.0 s on the large fixture. *Verified by:* e2e performance run.
  Scenarios (`@v0.2`): G-04.1, G-10.1, G-13.2.
  Timed on the large fixture in `test:timing` (Chromium only, RP-44): click on the outcome or *Submit* → toast with the commit, p95 printed with the load; `test:e2e` behaviour only. G-04.1 is task-037-gate-footer-with-every-outcome's scenario.

RP-52: G-13.2 is proved here up to the toast (the commit line without "pushed"), also for its
TT-PERF-02 citation; its last step, the sidebar's "1 commit to push", closes in
task-040-update-and-push-from-the-sidebar, which adds that assertion to the same scenario.

Also closes G-11.1, G-11.2, G-11.3, X-07.3 of TT-STATE-03 (task-032-governed-writes-submit-approve-and-reject). RP-49: US-G-13 stays here;
G-13.1 needs the auto-push of task-034-auto-sync-scheduler-and-auto-push.

Screen: `docs/00_reference/ux-reference.md` §4.2 (*Single-action footer*), §5 (*Feedback*) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).
RP-55: the append-only rule of RP-43 also covers the web shell layout and
`test/launcher/local-security.test.ts`; within the wave, tasks merge in task-number order, each
rebased on `main` before its merge.

## Implementation Notes

- `spec-004` §5 (write response, `push` outcome, error envelope, `cli-refused` verbatim), §4 row 9
  (`element-changed`); `spec-008` §4 (texts from the server: codes rendered from the catalogue,
  CLI messages verbatim); `spec-003` §6 reason `local-changes`.
- The toast component is reused by task-040-update-and-push-from-the-sidebar (push refusals): keep it in `web/src/shell/`.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
