---
id: minor-v0.3
type: release
title: "WingFoil UI v0.3 — Project state"
status: in-development
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v0.3"
pillar: "R"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: [T2, T5, M2, R5, C1]           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "0.2.2"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v0.3.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
sprint: "sprint-001"       # REQUIRED — the Sprint whose `release` phase carries it (methodology/scrum)
tmpl_version: 260929   # Orignal template version
---

## Scope

Everything Casey needs to follow a project without a developer — progress card (Memory figures),
recent activity, missing references, traceability, and `ui.yaml` with presets — and a clearer
console for every role (`release-planning-rel-v0.3-plan`, RP3-7 … RP3-10):

- Features (5 features, `07_sequencer.md` v0.8): T2, T5, M2, R5, C1. R6, R7, R8, W1, W2, G5, S6
  moved to v0.4 (RP3-7).
- Backlog items that are not new features: Today — the role selector on one line, filters by type
  and state, the date each element entered its state, 10 rows then expand, short ids; the element page in the main region when
  opened by URL or from Memory, its summary rendered as Markdown and the whole document in a dialog
  (rendered or source); the Memory state filter by state; dl-012 R1 (console address file) and R2
  (short element ids), R3 (pages recover in place after a restart, adr-003, RP3-17 A1); bug-019, bug-023, bug-024, bug-027; the plan-version
  and bug-release checks (dl-011, dl-009 action 7), the automatic GitHub Release (dl-009 action 5),
  no Approve offered out of phase (release, release line), Today's backlog noise, the refusal
  details, the procedures folded into directives, a separate agent git identity.
- Journeys served: J2 (complete for a product owner holding `approver`; informational otherwise).
- Backlog: `docs/03_backlog/04_backlog/by-release/v0.3.json` — 14 user stories,
  2 technical tasks (TT-ARC-07 moved from v0.1 by release-planning v0.1; 11 stories moved to v0.4 by release-planning v0.3, RP3-7), plus earlier stories carrying `@v0.3` scenarios (RP3-19, B2); the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**R — Project state.** The second primary persona, Casey (J2), needs the project as a whole — progress, decisions, traceability — with no extra WingFoil capability beyond 0.2.2; governed creation through ingestion moves to v0.4, where WingFoil 0.3's `workflow start` carries it.

## Success Criteria

Exit criteria of `07_sequencer.md` v0.8 (the decision-log ingestion moved to v0.4):

- Casey follows a project without a developer and — holding `approver` — decides a product item;
- `ui.yaml` is written only as a schema-valid `chore(ui)` commit touching only `.wingfoil/ui.yaml`;
- the WingFoil repository's gates are passed from the UI (dogfooding, REQ-SEC-10).

Bars common to every release (`08_mvp-canvas.md`, SARD v0.3):

- every scenario of `docs/02_requirements/02_bdd/` tagged `@v0.3` passes in the e2e suite;
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

- Plan `release-planning-rel-v0.3-plan` (decisions RP3-1 … RP3-20), the first release planned on
  WingFoil's workflow engine (run `sw-life-cycle-1-plan`, Sprint `sprint-001`).
- Scope narrowed from the sequencer's 12 features to 5 (T2, T5, M2, R5, C1) plus the approver's
  console requests (Today, the element page, the Memory filter), dl-012 R1–R3 and governance tasks;
  R6, R7, R8, W1, W2, G5, S6 and dl-013 moved to v0.4 (RP3-7, RP3-9). Budget 13 active days (10 + 3
  of validation).
- identify-specs: errata and amendments of spec-001 … spec-008 and spec-010; new spec-011, spec-012
  and adr-003 (approved / accepted); found late: N3's option A was already the shipped rule (the
  rows the approver saw were the WingFoil project's); bug-024 reproduces on 0.2.2 only.
- build-backlog: 19 tasks (task-049 … task-067) in four waves; bugs bug-019, bug-023, bug-024,
  bug-027 absorbed into tasks 057, 053, 056; 25 missing scenarios written; `check_tasks.py` extended
  to earlier-release stories carrying `@v0.3` scenarios.

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
