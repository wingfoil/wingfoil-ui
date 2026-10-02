---
id: minor-v0.4
type: release
title: "WingFoil UI v0.4 — Workflow and agents"
status: draft
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v0.4"
pillar: "A"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: [T3, A1, A2]           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "0.3"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v0.4.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260929   # Orignal template version
---

## Scope

What the WingFoil 0.3 workflow engine and agent execution make possible: next workflow step, agent launch and agent log view, plus three capability upgrades of earlier features on 0.3 — T2 phases, W1 current position, G5 via `workflow start` (every ingestion type whose required fields the engine or a field setter sets).

- Features (3 features, `07_sequencer.md` v0.5): T3, A1, A2.
- Journeys served: J3 (complete), J4 step 3, J2 step 1 (phases), J7 (if WingFoil 0.3 sets the required fields; otherwise with the first WingFoil that does).
- Backlog: `docs/03_backlog/04_backlog/by-release/v0.4.json` — 11 user stories,
  2 technical tasks; the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**A — Workflow and agents.** Isolates the dependency on WingFoil 0.3 (`workflow start/next/status`, `agent execute`) in one release (sequencer rule 1); serves Jordan (J3) and Sam (J4). The exact 0.3 verb syntax is confirmed by this release's `release-planning`.

## Success Criteria

Exit criteria of `07_sequencer.md` v0.5:

- Jordan starts the day from Today and runs the agent on the next step, with its logs in the UI.

Bars common to every release (`08_mvp-canvas.md`, SARD v0.3):

- every scenario of `docs/02_requirements/02_bdd/` tagged `@v0.4` passes in the e2e suite;
- the screens in scope match the prototype (`docs/00_reference/prototype/`) except for the
  deviations recorded in the Vision Package (directive `ux-consistency`);
- 0 serious/critical axe violations on every screen in scope, in both themes (directive
  `accessibility`);
- the CLI JSON contract tests pass on every supported WingFoil version from `wingfoil_min`
  (0.3) to the latest contract-tested one;
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
