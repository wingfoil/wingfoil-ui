---
id: task-035-how-to-join-panel
type: task
title: "How to join panel"
status: pending
release: "v0.2"
module: "web"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "US-C-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-027-e2e-suite-on-firefox-and-webkit"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The *How to join* panel (C2), opened from the "not in team" badge of the project header: the tech
leads declared in the DNA and the exact `wingfoil dna add team.members …` command for the user's
git email, with a copy button; when the DNA declares no tech lead or no member, it says so and
still gives the command. Reads the v0.1 identity and DNA only, so it can run in wave 1.

**Backlog items:** US-C-08, US-C-09

- US-C-08 — As Riley, I want a How to join panel naming the tech lead and the exact `wingfoil dna add team.members …` command for my email, so that I know the next step to become a member
- US-C-09 — As Riley, on a project whose DNA declares no tech lead, I want How to join to say so and still give the command, so that I can ask any member to run it

## Acceptance Criteria

- **US-C-08** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/c/how-to-join.feature`: C-08.1 Name the tech leads and give the command; C-08.2 Copy the command
- **US-C-09** — every `@v0.2` scenario passes:
  - `docs/02_requirements/02_bdd/features/c/how-to-join.feature`: C-09.1 Say that no tech lead is declared; C-09.2 Explain an empty team

C-08.2 asserts the copied command with the clipboard helper of task-027-e2e-suite-on-firefox-and-webkit
(AC-1b). These scenarios are also cited by TT-SEC-08 (task-033-git-copy-state-repository-status-and-transport-routes).

Screen: `docs/00_reference/ux-reference.md` §3 (*Current user*, "not in team" badge), §4.11 *Identity* and the prototype (`docs/00_reference/prototype/`), deviations only as recorded (directive `ux-consistency`). Accessibility bar: every screen and action of the task operable from the keyboard with visible focus; axe-core 0 serious/critical violations in both themes; every string from the catalogue (X-09.1). Cross-cutting: the task's e2e spec passes on Chromium, Firefox and WebKit (REQ-INT-08, task-027-e2e-suite-on-firefox-and-webkit); its screens are added to `SCREENS` (`test/e2e/support/screens.ts`) so the X-06.4 axe scan and the X-09.1 key-build check cover them; catalogue, `SCREENS` and route registration changes are append-only (RP-43).

## Implementation Notes

- `spec-004` §3 (`GET /api/p/:pid` identity, `GET /api/p/:pid/config` DNA); `identity.schema.json`;
  `spec-008` (the command is data, not a catalogue text: its placeholders are translated, the
  command words are not).
- Copy to clipboard: Firefox and WebKit grant no clipboard permission in Playwright — assert the
  copied text with the cross-engine clipboard helper of task-027-e2e-suite-on-firefox-and-webkit
  (its AC-1b).
- RP-55: the append-only rule of RP-43 also covers the web shell layout; in wave 1 this task
  merges after task-030 and task-031 (task-number order), rebased on `main` before its merge.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
