---
id: minor-v0.3
type: release
title: "WingFoil UI v0.3 — Project state"
status: draft
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v0.3"
pillar: "R"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: [T2, T5, M2, R5, R6, R7, R8, W1, W2, G5, S6, C1]           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "0.2.2"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v0.3.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260929   # Orignal template version
---

## Scope

Everything Casey needs to follow a project without a developer: progress card (Memory figures), recent activity, missing references, traceability, timeline (time axis and git tree), read-only files, workflow tree (definitions), ingestion cards and ingestion start (decision-log on WingFoil 0.2.2), command palette, and `ui.yaml` with presets.

- Features (12 features, `07_sequencer.md` v0.6): T2, T5, M2, R5, R6, R7, R8, W1, W2, G5, S6, C1.
- Journeys served: J2 (complete for a product owner holding `approver`; informational otherwise), decision-log ingestion.
- Backlog: `docs/03_backlog/04_backlog/by-release/v0.3.json` — 25 user stories,
  3 technical tasks (TT-ARC-07 moved from v0.1 by release-planning v0.1); the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**R — Project state.** The second primary persona, Casey (J2), needs the project as a whole — progress, decisions, traceability — with no extra WingFoil capability beyond 0.2.2; governed creation arrives where 0.2.2 allows it (decision-log ingestion).

## Success Criteria

Exit criteria of `07_sequencer.md` v0.6:

- Casey follows a project without a developer and — holding `approver` — decides a product item;
- a decision-log is captured through its ingestion workflow from the UI;
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

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
