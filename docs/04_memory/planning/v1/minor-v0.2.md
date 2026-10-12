---
id: minor-v0.2
type: release
title: "WingFoil UI v0.2 — Unblock"
status: in-development
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v0.2"
pillar: "G"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: [T1, T4, S5, S7, G2, G3, G4, C2, C4, Y1, Y2, Y3, Y4]           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "0.2.2"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v0.2.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260929   # Orignal template version
---

## Scope

The human-on-the-loop core — **first usable release**: Today (Requires you, waiting on others, all-roles summary), in-app notifications, the gate footer with every outcome, submit, action feedback, identity and *How to join*, UI settings, and git sync (repository status, fetch, push, fast-forward update).

- Features (13 features, `07_sequencer.md` v0.6): T1, T4, S5, S7, G2, G3, G4, C2, C4, Y1, Y2, Y3, Y4.
- Journeys served: J0 (complete), J1 (complete), J4 (gate — reviewers holding `approver`; informational otherwise), J5, J6 step 3, J8.
- Browsers: the e2e suite extends from Chromium (v0.1) to Firefox and WebKit (REQ-INT-08, staged by
  release-planning v0.1).
- Backlog: `docs/03_backlog/04_backlog/by-release/v0.2.json` — 34 user stories,
  12 technical tasks; the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**G — Unblock.** Deciding gates in two clicks is the core value for the primary persona Morgan (J1); it lands as early as the WingFoil floor allows (sequencer rule 3), and from this release the WingFoil UI repository is run from the UI (rule 5).

## Success Criteria

Exit criteria of `07_sequencer.md` v0.6:

- a member holding `approver` passes a gate from Today in ≤ 2 clicks, with the `wf(…)` commit shown and pushed;
- a reviewer without `approver` sees the gate as informational, with who can act (sequencer rule 6);
- actions are blocked on elements with local changes and while the copy is behind;
- the WingFoil UI project's own gates are passed from the UI (dogfooding, REQ-SEC-10).

Bars common to every release (`08_mvp-canvas.md`, SARD v0.3):

- every scenario of `docs/02_requirements/02_bdd/` tagged `@v0.2` passes in the e2e suite;
- the screens in scope match the prototype (`docs/00_reference/prototype/`) except for the
  deviations recorded in the Vision Package (directive `ux-consistency`);
- 0 serious/critical axe violations on every screen in scope, in both themes (directive
  `accessibility`);
- the CLI JSON contract tests pass on every supported WingFoil version from `wingfoil_min`
  (0.2.2) to the latest contract-tested one;
- every commit the UI causes is a `wf(…)` commit made by the CLI, or a `chore(ui)` commit touching
  only `.wingfoil/ui.yaml`.

## Execution Notes

<!-- Running log of what actually happened during this release's workflow — filled in
     incrementally as each phase runs, not written after the fact. Raw material for the
     retrospective (docs/04_memory/design/dls/{id}.md), not the retrospective itself: capture
     what happened here; save "why it matters going forward" for the retrospective. -->

### Planning (release-planning)

<!-- identify-specs: artefacts discovered late or missed; build-backlog: scope/estimation
     surprises, bugs selected for this release and their derived fix tasks. -->

Actual effort per phase (dl-006 action 6; wall-clock of the working sessions, 2026-10-12 on):

| Phase | Plan | Sessions | Effort |
|-------|------|----------|--------|
| Governance alignment (pre-step) | `governance-alignment-rel-v0.2-plan` | 2026-10-12 10:05–11:00 | ~1 h |
| release-planning | `release-planning-rel-v0.2-plan` | sessions 1–4 2026-10-12 11:00–20:00 (wall-clock, incl. waits; sessions 3–4 from 19:20) | ~9 h wall-clock, 1 active day |

- 2026-10-12 — `release-planning-rel-v0.2-plan` sessions 1–2 (branch `design/release-planning_v0.2`).
  `advance-pinned-build` no-op (0.2.2 newest); `minor-v0.2` `draft → planning` (`4c8ead3`);
  `triage-bugs`, `reconcile-governance` empty; no ADR. Load: all 46 backlog records kept, budget
  5 → 8 active days (sequencer v0.7, RP-8); spec-002 §4 incremental parse moved to v0.3 (RP-9).
  `identify-specs`: one uncovered artefact — spec-010 git sync (approved `1fcedfb`) — and
  amendments of spec-001/002/003/004/006/007, adr-001 D5/D7, SARD 0.11, BDD G-14.2, directive
  `cli-only-writes` 1.6 (RP-10 … RP-41); independent spec review PASS at round 3 (FAIL 2 major/10
  minor, FAIL 2 minor, PASS). Governance/technical tasks for build-backlog: load-independent tests
  with bug-008, public-text check, npm publishing pipeline (RP-3, RP-11).
- 2026-10-12 — `build-backlog` (plan session 3): 17 tasks `task-026` … `task-042` (4 governance —
  026 load-independent tests absorbing bug-008, 027 e2e on Firefox and WebKit, 028 public-text
  check, 029 npm publishing pipeline — 5 server, 8 web) cover the 46 backlog records exactly once
  (`check_tasks.py v0.2`); all `pending`. bug-008 `triaged → planned` (`c01d13f`); dl-006 stamped
  `v0.2`. Surprise: `memory add` numbers tasks per folder (`wingfoil-cli` W-27); the first run
  (`task-001` … `017`) was dropped from the branch history at the approver's request and redone
  as `task-026` … `042`.
- 2026-10-12 — `commit-backlog` gate (plan session 4): independent audit round 1 FAIL (3 major —
  ids shifted by the renumbering in the plan, G-13.2 closable only after task-040, missing
  dependencies on task-035 — 7 minor, 7 nits); decisions RP-52 … RP-55 (G-13.2 split closure,
  fetch-interval scenarios at 15 s in `test:e2e`, npm publishing as WingFoil's two-gate staged
  pipeline, append-only shell and merge order).
- 2026-10-12 — audit round 2 FAIL (3 minor: Y-05.2 added to RP-53 with the approver's OK, plan
  version, effort table), round 3 PASS (`4c13e9d`). The approver approved the 17 tasks into
  `backlog`; release `planning → in-development` by hand (W-25). Planning took 1 active day
  (2026-10-12) of the v0.2 budget of 8.

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
