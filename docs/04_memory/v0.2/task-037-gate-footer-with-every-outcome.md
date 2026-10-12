---
id: task-037-gate-footer-with-every-outcome
type: task
title: "Gate footer with every outcome"
status: backlog
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-G-04"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-032-governed-writes-submit-approve-and-reject", "task-035-how-to-join-panel", "task-036-today-requires-you-and-waiting-on-others"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The gate footer of the element panel (G2): reason field focused when opened from Today, every
outcome side by side (approve and each reject target, also for unknown types), the reason required
for approve too with an editable default, outcomes disabled while the reason is empty, and the
informational footer ("Reserved to approver — <members> can act") for a member without
`approver`; no footer on a terminal state and a "Waiting for the workflow engine" note on an
engine-waiting state. Two clicks from Today to the `wf(…)` commit.

**Backlog items:** US-G-04, US-G-05, US-G-06, US-G-07, US-G-09, US-S-24, TT-SEC-07, TT-PERF-10

- US-G-04 — As Morgan, I want Approve on a Today item to open the element panel with the gate footer and the reason field focused, so that a gate takes at most two clicks from Today
- US-G-05 — As Morgan, I want every outcome of the gate side by side — approve and each reject target — so that I choose the outcome, not a verb
- US-G-06 — As Morgan, I want the reason required for approve too, pre-filled with an editable default, so that the CLI (which requires `--reason`) never refuses my approval
- US-G-07 — As Morgan, I want the outcome buttons disabled while the reason is empty, so that no CLI call is made that would be refused
- US-G-09 — As Sam, without `approver` on WingFoil 0.2.2, I want the gate footer to be informational — "reserved to approver" and the members who can act — so that I know whom to ask
- US-S-24 — As a member, I want no action footer on an element in a terminal state, and a "waiting for the workflow engine" note on one in an engine-waiting state, so that I am never offered an impossible move

## Acceptance Criteria

- **US-G-04** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-04.1 Approve a gate in two clicks from Today; G-04.3 Open the gate footer with the reason focused; G-04.2 Cancel without running the CLI
- **US-G-05** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-05.1 Show approve and the reject target of a bug gate; G-05.2 Reject to the gate's target; G-05.3 Derive the outcomes of an unknown type's gate
- **US-G-06** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-06.1 Pre-fill the reason for approve; G-06.2 Use the reason I typed; G-06.3 Clear an untouched default when a reject is chosen; G-06.4 Keep a reason I typed when a reject is chosen
- **US-G-07** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-07.1 Disable the outcomes while the reason is empty; G-07.2 Treat a reason of only spaces as empty
- **US-G-09** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/g/gate-footer.feature`: G-09.1 Show an informational footer to a reviewer without approver; G-09.2 Show the outcomes to the same reviewer once they hold approver; G-09.3 Show an informational footer to a product owner without approver
- **US-S-24** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/s/action-descriptor.feature`: S-24.1 Offer no action on a terminal state; S-24.2 Show an engine-waiting state as waiting; S-24.3 Treat a declared waiting state of an unknown type the same way; S-24.4 Offer only the reject of a state that is both a gate and a waiting state
- **TT-SEC-07** (REQ-SEC-07 — Gate authority stays with WingFoil): [boolean] On the fixtures with Sam and Casey with and without `approver`, the outcomes are offered if and only if the member holds `approver`; `ui.yaml` and the server configuration contain 0 permission rules. *Verified by:* e2e.
  Scenarios (`@v0.2`): T-06.1, T-06.2, G-09.1, G-09.2, G-09.3, S-11.1.
  S-11.1 runs in task-039-repository-status-and-fetch-in-the-sidebar (US-S-11) on the footer built here; the "0 permission rules" part: no role rule in the server configuration or code (dl-002); `ui.yaml` is read only from v0.3.
- **TT-PERF-10** (REQ-PERF-10 — Two clicks per gate): [numeric] ≤ 2 clicks from Today to the `wf(…)` commit with the pre-filled reason. *Verified by:* e2e click count.
  Scenarios (`@v0.2`): G-04.1, G-04.3, X-06.2.
  Click count asserted in G-04.1; X-06.2 decides a gate with the keyboard only.

Also closes S-13.2 and S-15.2 (TT-SEC-08, task-033-git-copy-state-repository-status-and-transport-routes): no governed action offered to a user not in
the team or under an ambiguous identity. RP-13: a hand-transition state shows the waiting note,
never an action.

Screen: `docs/00_reference/ux-reference.md` §4.2 (*Gate footer*, *Single-action footer*), §5 (2-click gates, all gate options visible) and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-003` §3 (verbs per kind), §6 (enablement, reason codes rendered from the catalogue), §8;
  `spec-004` §3 (`approve`/`reject` with `expectedStatus` and `reason`), §5.
- The result toast is task-038-submit-footer-action-toasts-and-blocked-actions: here the panel shows the new state after the write (refetch on
  `write`/`repo`).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
