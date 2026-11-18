---
id: minor-v0.3
type: release
title: "WingFoil UI v0.3 — Project state"
status: released
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

- 2026-10-28 – 2026-11-02 — before release-planning, in the pre-step
  `governance-alignment-rel-v0.3-plan` (not a wave of the development stage): task-046 (WingFoil
  0.3 support, the pin on `wingfoil@0.3.1`; done `322869ec`), task-047 (Directives view, absorbing
  bug-025; done `cbca05c5`) and task-048 (element history on the 0.3 operations, bug-026; done
  `62f632c7`), each approved by the approver; bug-024 … bug-027 captured there; the plan merged
  into `main` with `--no-ff` at its step 8.
- 2026-11-04 – 2026-11-05 — Wave 0 (`backlog-item-rel-v0.3-plan` Session 1, the first stage run on
  WingFoil's workflow engine, run `sw-life-cycle-1-plan`): task-049, task-052, task-053, task-051,
  task-050 done; reviews PASS in two rounds each but task-051 (one round); task-050 and task-052
  security-adversarial. bug-023 resolved (task-053); bug-028 and bug-029 ingested through
  `bug-ingest` runs. Deviations: `backlog-item` › `build` recorded with `workflow finalize` when the
  work does not run through `agent execute` (W0-11); the agents commit under their own git identity
  from `64694568` (task-050, W0-14); `.wingfoil/` changes through a `governance-evolution` run from
  Wave 1 (W0-15); gate scripts with `agent execute` deferred to v0.4 (W0-16). Gate on `main`
  `81de674c`: `test:e2e` 947 passed, `test:smoke` 4, `test:timing` 6 + 23; dispatch run
  `42065455786` green.
- 2026-11-05 – 2026-11-08 — Wave 1 (Session 2): task-054, task-057, task-058, task-068, task-056,
  task-055 done. Splits (RP3-20 G2): task-054 → task-068 (W1-6), task-055 → task-069 (W1-17),
  task-056 → task-070 (W1-19). Review rounds: task-057 2, task-054 2 (FAIL then PASS), task-058 4,
  task-068 1, task-056 2, task-055 3. bug-019, bug-027, bug-028 (into task-057), bug-029 and bug-032
  (into task-055), bug-030 (into task-058), bug-033 (into task-068) resolved; bug-031, bug-034,
  bug-035, bug-036 ingested. Approved specs amended in place by dated Process Notes: spec-005 §1,
  spec-011, spec-006, spec-007, spec-012 §1/§9, spec-004 §5/§6, SARD REQ-STATE-02/05, REQ-INT-06.
  `governance-evolution-1-plan` (dl-014, W-46, F-038) and `-2-plan` (dl-015, W-47, F-039).
  Deviation: the local machine overloaded by parallel gates — one heavy gate at a time (W1-13), the
  heavy gates to GitHub Actions decided (W1-10 … W1-12). Gate on `main` `198de2a9`: `test:e2e` 947
  passed, `test:smoke` 4, `test:timing` 6 + 23; dispatch run `42458285744` green.
- 2026-11-08 – 2026-11-13 — Wave 2 (Session 3): `governance-evolution-3-plan` (dl-016) and
  `-4-plan` (dl-017); task-071 (`.github/workflows/gates.yml`) first, then task-069, task-070,
  task-073, task-060, task-061, task-059, task-062, task-072, task-075, task-063, task-076,
  task-074, task-077, task-078 done (15 tasks). Splits: task-069 → task-073 (W2-5); task-059 →
  task-074, task-075 (W2-6); task-061 → task-076, task-062 → task-077, task-078 (W2-7). Reviews
  from 1 round (task-062, task-074, task-076) to 5 (task-078: FAIL in rounds 1 … 3); FAIL rounds
  on task-059, task-060, task-061, task-072, task-075, task-078. Bugs resolved: bug-024, bug-031,
  bug-034, bug-035, bug-036 (a declared WingFoil 0.2.2 limitation), bug-037, bug-038, bug-040,
  bug-042, bug-043, bug-046; bug-039, bug-041, bug-044, bug-045, bug-047 triaged for v0.4. From
  task-071's merge (`bca67002`) the heavy gates run on `gates.yml`, the phase branch merged into a
  task branch with one green run before its merge (W0-7, W2-4); runs queued with ten branches in
  flight and the GitHub API rate limit ran out once; the machine restarted once under memory
  pressure (local vitest on targeted files, two workers). Gate: `governance-evolution-5-plan`
  (dl-018); `gates.yml` `wave` run `43398254419` green on `41613efc`; `test:timing` 6 + 26; merge
  into `main` `56280fcb`; dispatch run `43458189756` green.
- 2026-11-14 – 2026-11-17 — Wave 3 (Session 4): task-064, task-066, task-079, task-080, task-082,
  task-065, task-067, task-081 done (8 tasks). Splits: task-064 → task-079 (W3-1); task-065 →
  task-080, task-067 → task-081 (W3-3). Reviews 2 rounds each, task-067 3 (major F-1 fixed);
  task-079 and task-080 FAIL in round 1. task-064's F-9 deviations accepted (W3-2). The approver's
  preset commit `8451080a` (`.wingfoil/ui.yaml`, task-079 AC-4) was made outside a
  `governance-evolution` run and kept; the custom test fixture copied it and the heavy gates failed
  (dispatch `43876696740`) → bug-049 (high), fixed by task-082 before the merges of task-065 and
  task-067 (W3-4). bug-048 triaged for v0.4. Gate: `wave` run `44060476990` green on `2db4a413`;
  `test:timing` 6 + 32; merge into `main` `998e8074`; dispatch run `44072226034` green.
- 2026-11-17 — implementation complete: 37 tasks `done` and merged into `main` (`65af0320`); the
  `backlog-item.build` steps of twelve Wave 2 tasks finalized only at the stage's end (`e0d0fbb7`
  … `6b8da2ce`); plan closed by hand at 0.37. task-083 followed at release-submit (see below), 38
  in all. Last gate (Wave 3): `gates.yml` `wave` run `44060476990` (checks, coverage, contract,
  smoke, publish-smoke, `e2e-wave` on three engines × 2 shards), `test:timing` 6 vitest + 32
  Playwright passed. Recurring blockers across waves: machine load from parallel gates (until
  `gates.yml`, then runner queueing and the API rate limit); tasks larger than about one active day
  at their design — 12 tasks split off, with task-071, task-072 and task-082 added, from 19
  planned tasks to 34 in the stage; security and adversarial
  review rounds on server reads and rendered text (task-055, task-058, task-077, task-078). Budget:
  the plans record no active days used (RP3-12 asked for working time on the validation days); the
  stage ran from 2026-11-04 to 2026-11-17 against 10 development days of the 13 (RP3-7).

### Submit & Publishing

<!-- pre-release-checks failures and fixes, approve-release rejections, publishing issues. -->

- 2026-11-17 — `release-submit-rel-v0.3-plan` on `main` (RS3-1 … RS3-7): `release: "v0.4"` on the
  six bugs left open (`37a701c5`). The audit blocker: `npm audit --omit=dev` 8 (1 critical
  `dompurify`, 1 high `markdown-it`) → bug-050 (high, `bug-ingest-1-23-plan`) and task-083 (the
  runtime dependencies at the fixed versions; review PASS, gates run `44099378805` green; merged
  `30ee36b1`, done `d395eea3`), then 0. User and agent docs aligned (`ab1ebad9`); the missing
  `.wingfoil/ui.yaml` row fixed through `governance-evolution-6-plan` (dl-019, `3c8e951a`).
  Independent review round 1 FAIL (four minors: 37 vs 38 tasks, raw U+200C/U+200D in a CHANGELOG
  line, bug-047's `markdown-it` version; three nits), round 2 PASS on `41a681b4`.
- 2026-11-17 — checks on `3ed28dec`: `check_tasks.py v0.3` 38 `done`, the 23 bugs of v0.3 `closed`
  or `resolved` (bug-050); the full audit 34 development-only findings, those off the RV2-7 list
  accepted for v0.3 (option A, `docs/publishing.md` 0.9); `test:timing` 6 + 32 passed through the
  slot; `gates.yml` `wave` run `44107593951` green (coverage 5183 passed, statements 96.78 %;
  contract 501; e2e 1378 passed on three engines; smoke 4/4; publish-smoke 11/11). The e2e smoke
  gate green, pre-release-checks finalized `8395c004`; enter-releasing `73f01e49` (`in-development
  → releasing`); approve-release by the approver's `workflow finalize` `b01b4764`, on the tree of `6460c1ff` (the
  pre-release checks on `3ed28dec`; documents only after it).
- release-publishing: in progress — `release-publishing-rel-v0.3-plan` (RP3P-1 … RP3P-4).
