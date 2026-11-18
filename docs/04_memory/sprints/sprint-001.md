---
type: sprint
format: 1
id: sprint-001
title: "Sprint 1 — v0.3 Project state"
goal: "Casey follows a project's state from the console — progress, traceability, a clearer Today — and agents link its elements reliably"
status: done
---

## Sprint Goal

Casey, the product owner, follows a project's state from the console without a developer —
progress, traceability and the `ui.yaml` behind them, a clearer Today — and agents link its elements
reliably (short ids, a discoverable console address). The Sprint Backlog is the tasks of release
`minor-v0.3` whose `sprint` names this Sprint; it is planned by `release-planning-rel-v0.3-plan`
(RP3-7 … RP3-11). Length: two weeks (`methodology/scrum`, `sprint_length`); the release may move to
the next Sprint before the Sprint Review (RP3-5).

## Sprint Review

**Sprint:** 2026-11-04 to 2026-11-18. **Sprint Goal:** the planned scope was delivered; two of the
exit criteria below were not verified.

### The Increment

`wingfoil-ui@0.3.0` (`minor-v0.3`), live on npm since 2026-11-17 with a provenance statement, and
the public GitHub Release `v0.3.0`. All 35 tasks of the Sprint Backlog (task-049 … task-083) are
`done`; none moved to another Sprint. The release counts 38 tasks with the three of the v0.3
pre-step (task-046 … task-048).

Shipped for the Sprint Goal (`CHANGELOG.md` *[0.3.0]*): Today's progress card and recent activity,
*Traceability*, the element page with short ids and the rendered document, the Memory list's state
and missing-reference filters, *Configuration › Taxonomy* and *› Progress* with *Use preset*, and
the console address file for agents.

Last full gate: `gates.yml` `wave` run `44107593951` — coverage 5183 passed, contract 501, e2e 1378
on three engines, smoke 4/4, publish-smoke 11/11.

### Exit criteria of `minor-v0.3`

| Criterion | Outcome | Evidence |
|-----------|---------|----------|
| Casey follows a project without a developer | Not inspected | The features shipped and the suites above are green; no stakeholder inspected the Increment |
| `ui.yaml` written only as a `chore(ui)` commit touching only that file | Met | `8451080a`, one path, from *Use preset* (task-079 AC-4) |
| The WingFoil repository's gates are passed from the UI (REQ-SEC-10) | Not measured | No v0.3 record gives the share of approve and reject commits made from the UI |

### Changes to the Product Backlog

- Six bugs carried to v0.4 (`release: "v0.4"`, `37a701c5`): bug-039, bug-041, bug-044, bug-045,
  bug-047, bug-048.
- New, for v0.3.1 or v0.4: a figure's explanation cannot be hovered (WCAG 1.4.13, task-067 review
  F-4), a known limitation of `0.3.0` with no backlog item yet.
- New, for v0.3.1 or v0.4: refresh the development dependencies. `npm audit` reports 45
  development-only findings on 2026-11-18 (3 critical, 17 high, 25 moderate), 34 when accepted for
  v0.3; `npm audit --omit=dev` reports 0.
- v0.4's budget is re-estimated at its release-planning (`07_sequencer.md`): seven features moved
  in from v0.3.
- The pin is `wingfoil@0.3.1`; a move to 0.3.2 is decided at the next release-planning.
