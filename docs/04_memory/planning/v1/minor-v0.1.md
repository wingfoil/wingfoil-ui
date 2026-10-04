---
id: minor-v0.1
type: release
title: "WingFoil UI v0.1 — Read-only console"
status: planning
kind: "minor"
patch-of: ""           # optional — when kind is "patch": id of the released minor it patches, e.g. "minor-v0.2"
version: "v0.1"
pillar: "S"             # REQUIRED — primary feature area of docs/01_vision/06_features.md this wave centers on
features: [S1, S2, S3, S4, S8, S9, G1, M1, R1, R2, R3, R4, X1, X2, X3, X4]           # REQUIRED — feature IDs covered by this release (from 06_features.md)
wingfoil_min: "0.2.2"       # minimum WingFoil CLI version this release needs, e.g. "0.2.2"
requirements: "docs/03_backlog/04_backlog/by-release/v0.1.json"       # REQUIRED — path to per-release backlog JSON, e.g. "docs/03_backlog/04_backlog/by-release/v0.1.json"
release-line: "v1"
tmpl_version: 260929   # Orignal template version
---

## Scope

Open any WingFoil project and read it safely: local server and CLI adapter, project list (add a local folder or clone a remote), WingFoil version and capability detection, identity and role views, snapshot and refresh, the action descriptor, and read-only views of the element panel, Memory, DNA, directives, team and documentation. Cross-cutting from day one: accessibility, externalised strings, light/dark themes and local server security (sequencer rules 4 and 7). In v0.1 the project opens on the Memory list; Today arrives in v0.2.

- Features (16 features, `07_sequencer.md` v0.6): S1, S2, S3, S4, S8, S9, G1, M1, R1, R2, R3, R4, X1, X2, X3, X4.
- Journeys served: J0 steps 1–3, J6 steps 1–2 (partial), J4 step 2 (read).
- Backlog: `docs/03_backlog/04_backlog/by-release/v0.1.json` — 39 user stories,
  33 technical tasks (TT-ARC-07 moved to v0.3 by release-planning; TT-INT-08 on Chromium only in v0.1); the Memory `task` elements are created from it by
  this release's `release-planning` (`ref:` = backlog id).

## Pillar Focus

**S — Read-only console.** Every later screen stands on the server, the CLI adapter, the snapshot and the action descriptor; showing a project read-only before acting on it is sequencer rule 2 ("read before write"), and the write classes and server security must exist before the first write (rule 7).

## Success Criteria

Exit criteria of `07_sequencer.md` v0.6:

- the WingFoil and WingFoil UI repositories, and the fixture with unknown types and states and no `ui.yaml`, render without UI changes;
- the local server refuses non-loopback and cross-origin requests and every request without the session token;
- the only write is cloning a remote into a new folder — no governed write exists yet.

Bars common to every release (`08_mvp-canvas.md`, SARD v0.6):

- every scenario of `docs/02_requirements/02_bdd/` tagged `@v0.1` passes in the e2e suite;
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

- 2026-10-02 — `release-planning-rel-v0.1-plan` started. `advance-pinned-build` no-op (0.2.2 is
  the newest published `wingfoil`); `triage-bugs`, `reconcile-governance` no-op (no bugs; DLs
  `ready`, ADRs `accepted`); `record-adrs` skipped. Load (73 backlog records vs a 6-active-day
  budget) to be weighed before `identify-specs`; tasks to be grouped into ~20 vertical tasks.
- 2026-10-03 — load decided (plan session 2): budget 6 → 9 active days (sequencer v0.6, canvas
  ≈ 33); REQ-ARC-07 / TT-ARC-07 moved to v0.3 (no `@v0.1` scenario reads `ui.yaml`; spec-005 now
  v0.3); REQ-INT-08 staged — e2e on Chromium only in v0.1, three engines from v0.2; TT-PERF-04
  kept. v0.1 = 39 stories + 33 technical tasks (72). `identify-specs`: four uncovered artefacts
  specified — spec-006 local state store, spec-007 launcher command line, spec-008 message
  catalogue, spec-009 theme tokens; independent spec review PASS — 24 findings fixed, 1 (F25) left by decision; 6 nits of the
  re-verification fixed.
- 2026-10-03 — `build-backlog` (plan session 3): 21 vertical tasks `task-001` … `task-021`
  (11 server, 1 contracts, 9 web) cover the 72 backlog records exactly once
  (`check_tasks.py`); server/contracts tasks own the technical tasks and the server-only stories,
  web tasks own the user stories; all `pending`. `dl-002` stamped `release: v0.1`; `dl-001`,
  `dl-003` left unassigned (dl-003 lands with spec-005 in v0.3). No bug selected.
- 2026-10-04 — `commit-backlog` gate (plan session 4): the independent audit FAILED (5 major — web
  task order with a 017 → 018 → 019 cycle, shell task carrying every-screen acceptance, missing
  server dependencies, fit criteria naming later capabilities, no `cli-not-found` contract).
  Fixed: web order 013 → 018 → 017 → 019 → 020 → 015 → 014 → 016 → 021 (element panel by URL
  first; US-G-02 → task-019); themes/strings acceptance → task-021; dependencies added; SARD v0.7
  v0.1 scopes; spec-006 `cli-not-found` and `availability`; BDD conventions v0.6 fixture variants.

### Implementation (dev-loop, per task)

<!-- Recurring blockers across tasks, tech-specs revised mid-release, review rejections and why,
     anything that deviated from the plan in Scope/Pillar Focus above. -->

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->
