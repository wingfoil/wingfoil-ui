---
id: minor-v1.0
type: release
title: "WingFoil UI v1.0 — MVP complete"
status: draft
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v1.0"
pillar: "X"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: []           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "1.0"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v1.0.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260929   # Orignal template version
---

## Scope

MVP complete — no new features: stable packaging `npx wingfoil-ui` (Q1), support matrix and contract tests from the floor (0.2.2) to WingFoil 1.0, capability detection reviewed against WingFoil 1.0, polish from the retrospectives, user guide.

- Features (no new features, `07_sequencer.md` v0.6): —.
- Journeys served: all journeys J0–J8.
- Backlog: `docs/03_backlog/04_backlog/by-release/v1.0.json` — 2 user stories,
  0 technical tasks; the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**X — MVP complete.** Cross-cutting quality and distribution: the release-line's success criteria are verified here on WingFoil 1.0.

## Success Criteria

Exit criteria of `07_sequencer.md` v0.6:

- every MVP journey (J0–J8) passes the e2e smoke on WingFoil 1.0;
- `npx wingfoil-ui` is published as stable 1.0 with its support matrix.

Bars common to every release (`08_mvp-canvas.md`, SARD v0.3):

- every scenario of `docs/02_requirements/02_bdd/` tagged `@v1.0` passes in the e2e suite;
- the screens in scope match the prototype (`docs/00_reference/prototype/`) except for the
  deviations recorded in the Vision Package (directive `ux-consistency`);
- 0 serious/critical axe violations on every screen in scope, in both themes (directive
  `accessibility`);
- the CLI JSON contract tests pass on every supported WingFoil version from `wingfoil_min`
  (1.0) to the latest contract-tested one;
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
