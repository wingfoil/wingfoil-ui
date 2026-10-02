---
id: specification-downcast-specification-plan
type: plan
title: "Specification downcast"
status: active
version: "1.0"         # optional — plan version
workflow: "specification-downcast"
phase: "specification"
scope: "sw-life-cycle"
element: ""            # optional — the Memory element this phase iterates (e.g. a release id)
release: ""            # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Date:** 2026-10-01 · **Branch:** `design/specification_v1` (merged to `main` with `--ff=false` at the end)
**Workflow:** `.wingfoil/workflows/custom/specification-downcast.yaml` (phase `specification` of
`sw-life-cycle`), with its four sub-workflows `user-story-mapping`, `specification-by-examples`,
`volere-requirements`, `backlog-export`
**Roles:** product-owner (USM, backlog), qa (BDD), architect (SARD), approver — Roberto Pompermaier
holds all of them; the agent drafts and audits (executes as architect/developer/qa, no approval authority)
**Input:** the Vision Package `docs/01_vision/` (index `00_index.md`, v1.0), in particular
`05_journeys.md` (v0.3), `06_features.md` (v0.3, 45 MVP features), `07_sequencer.md` (v0.3),
`08_mvp-canvas.md` (v0.2) and the hand-off section of `X_coherence-audit.md` (v1.1)
**Evidence:** `docs/00_reference/ux-reference.md` and the prototype (evidence, not specification:
where they differ, the Vision Package wins), `docs/00_reference/adr-draft-local-server.md`,
directives `wingfoil-cli` (v1.1), `cli-only-writes` (v1.1), `accessibility`, `ux-consistency`

Why now: `lean-inception-inception-plan` is `done` and merged; the Vision Package passed its
coherence audit. Specification turns it into the engineering requirements and the backlog that
`seed-first-release-line` and `initial-design` (`rl-v1`) consume.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `lean-inception-inception-plan` is `done`; `.wingfoil/` loads with no warnings
  (`directives list` → `"warnings": []`).

Produces (mirroring WingFoil's `docs/02_requirements/` and `docs/03_backlog/`):

| Module | Output |
|--------|--------|
| user-story-mapping | `docs/02_requirements/01_user_story_map/` — backbone, stories per backbone step, MVP cut per release |
| specification-by-examples | `docs/02_requirements/02_bdd/features/**/*.feature` — one folder per feature area (S, T, G, M, R, A, C, Y, X) |
| volere-requirements | `docs/02_requirements/03_sard/` — SARD, Volere shell, five macro-areas |
| backlog-export | `docs/03_backlog/04_backlog/backlog.json` + `schema.json` + `by-release/` |

plus `docs/02_requirements/00_index.md` and `docs/02_requirements/X_coherence-audit.md` (an addition
of ours, as in inception). This plan replaces WingFoil's `X_specs-downcast-plan.md`.

## Phases / Steps

Each session: the agent drafts from the Vision Package and the evidence → the session (human +
agent) reviews and decides → the agent writes the decisions into the documents and into
**Session log** below → one commit per session (`docs(requirements): session N — …`, and
`docs(backlog): …` for step 5). A Vision Package document is changed only when a session finds a
defect in it: its version is bumped and the change is listed in the session log.

| # | Session (workflow phase) | Role | Output | Stop-check |
|---|--------------------------|------|--------|------------|
| 1 | User Story Mapping — backbone, vertical explosion, MVP cut (`user-story-mapping`) | product-owner | `01_user_story_map/` | 100 % of the 45 MVP features covered by ≥ 1 story; every story tagged `[MVP · vX.Y]` or `[Future · Ln]`; edge-case stories present (local changes, behind/diverged, no `approver`, unknown types/states, CLI outside the supported range, not in team) |
| 2 | Specification by Example — releases v0.1, v0.2 (`specification-by-examples`) | qa | `02_bdd/features/**` for the v0.1–v0.2 stories | ≥ 1 nominal + ≥ 1 error/edge scenario per story; scenarios atomic and testable; no ambiguous adjectives/adverbs |
| 3 | Specification by Example — releases v0.3, v0.4, v1.0 (`specification-by-examples`) | qa | `02_bdd/features/**` for the remaining MVP stories | same as session 2, over all MVP stories |
| 4 | Volere Requirements — SARD (`volere-requirements`) | architect | `03_sard/` | every `REQ-*` has a Description, Rationale, Traceability (stories/scenarios/features) and a numeric, percentage or boolean Fit Criterion |
| 5 | Backlog export (`backlog-export`) | product-owner | `docs/03_backlog/04_backlog/` | valid JSON against `schema.json`; no duplicate ids; no dependency cycles; every MVP story and every `REQ-*` in exactly one release partition (checked by script) |
| 6 | Coherence audit | architect (agent) | `X_coherence-audit.md`, `00_index.md` | all checks below pass, or each failure is fixed or recorded as a decision |

Rules carried from the Vision Package (they shape stories, scenarios and requirements):
- **Deviations from the UX reference** (audit hand-off): reason required and pre-filled on approve
  (G2); edit modes after v1.0 (L1–L3); *UI settings* page (C4) instead of the *WingFoil* tab (L7);
  gates need `approver` on WingFoil 0.2.2 (W-13); new screens S3, A2, S5, C2, Y1/C4, Y4, S8.
- **Per-role promises:** every scenario involving a gate names the role, and covers the member
  with and without `approver` (sequencer rule 6).
- **Fixtures:** scenarios name the fixture they run on — Kanban project, the WingFoil (`custom`)
  project, the project with unknown types/states and no `ui.yaml`.
- **Write classes and snapshot rules** (governed / `ui.yaml` / git transport / files later;
  working-tree snapshot, actions blocked on local changes and while behind) and local server
  security (X4) are specified from v0.1 (sequencer rule 7).

The SARD covers at least: the CLI contract (JSON schemas per consumed command, pinned and supported
CLI range, capability detection); latency of Today and of gate actions; cache invalidation on git
HEAD + working-tree status; identity from git (`user.email` ↔ `dna.team`); no direct writes (write
classes, `wf(…)` / `chore(ui)` commits only); local server security (loopback, session token,
Origin/Host); accessibility (WCAG 2.1 AA, 0 serious/critical axe violations); supported browsers;
externalised strings and themes. The success metrics of `08_mvp-canvas.md` become fit criteria.

Backlog ids (`US-*`, `TT-*`) are not Memory ids: the Memory `task` elements are created from the
backlog later, per release, by `release-planning` (`memory add --type task --set release=…`).

Coherence audit checks (step 6):
- features ↔ stories ↔ scenarios ↔ `REQ-*` ↔ backlog records: every link both ways, no orphan;
- every story's release matches `07_sequencer.md`, and every scenario uses only verbs of the
  WingFoil floor of its release (`wingfoil-cli` directive, ADR draft API table);
- no story or scenario contradicts `03_is-isnot.md`, the write classes or `cli-only-writes`;
- every canvas metric and every item of the SARD coverage list above is a `REQ-*` with a fit criterion;
- terminology matches WingFoil (element types, states, gates, roles, phases) — `ux-consistency`.

## Handoff

- **Agent:** drafts every document, keeps the session log, writes the validation scripts
  (coverage, JSON schema, duplicates, cycles), runs the coherence audit, commits.
- **Human (product-owner / qa / architect):** decides in each session; nothing is final until the
  session review accepts it.
- **Checkpoints:** end of each session (review of its outputs and stop-check); end of step 6
  (audit result).
- **Completion:** all four module outputs, the index and the audit exist, the audit passes, the
  human accepts the requirements → the plan is finalized by hand (`status: done`, commit
  `wf(plan): finalize specification-downcast-specification-plan [active → done]` — directive
  `wingfoil-cli` W-04) and the branch is merged to `main` with `--ff=false`.
- **Next:** `seed-first-release-line` (`rl-v1`), then `initial-design` for `rl-v1` (releases from
  `07_sequencer.md`, `adr-001` from the ADR draft, tech-specs) — `BOOTSTRAP.md` §7.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — User Story Mapping (2026-10-01)

- Outputs: `01_user_story_map/01_backbone.md`, `02_story-map.md`, `03_mvp-cut.md` — accepted after review.
- Backbone: 9 activities (launch, open a project, see what requires me, decide and act, understand
  the project, capture, agents, sync, configure) + an *Across every activity* row; every J0–J8
  step lands on a task, J9 on a future story.
- Stories: 112 MVP (69 nominal, 43 edge) + 10 future (L1–L10). Per release: v0.1 40, v0.2 32,
  v0.3 27, v0.4 11, v1.0 2.
- Decisions: story id `US-<area>-<nn>` (area of the main feature = release `pillar`; W1/W2 in M,
  user guide in X; `US-L-nn` future), independent of the backbone — chosen over the first draft's
  activity-based ids; a v0.4 capability upgrade is its own story (US-T-16, US-M-06, US-G-18 for T2
  phases, W1 position, G5 via `workflow start`); edge stories derived from feature refusal cases
  accepted; v1.0's technical scope (contract tests, capability review, polish) goes to the SARD and
  the backlog as technical tasks, not stories.
- Vision Package defect fixed: `06_features.md` v0.4 — the S8 row lacked WF and scores (now 0.2.2,
  Val 3, Eff 2, UX 2, Conf M).
- Stop-check: 45 / 45 MVP Canvas features covered ✓; every story tagged ✓; no story earlier than its
  feature's release ✓; edge-case stories for every common rule and refusal case ✓ (checked by script).

### Session 2 — Specification by Example, v0.1–v0.2 (2026-10-01)

- Outputs: `02_bdd/00_conventions.md` (fixtures `kanban`/`custom`/`unknown`, standard team and
  elements, tags, writing rules, assumed action-descriptor rules), 28 `.feature` files under
  `02_bdd/features/{s,t,g,m,r,c,y,x}/` — 189 scenarios (77 nominal, 112 edge) for the 72 v0.1–v0.2
  stories; validators `X_checks/check_usm.py` and `X_checks/check_bdd.py` — accepted after review.
- Story map v0.2: US-S-11 and US-X-07 moved v0.1 → v0.2 (no action or toast exists in v0.1);
  v0.1 38 stories, v0.2 34.
- Decisions: a scenario may carry a later release tag than its story when it needs a later screen;
  action-descriptor rules (first state → creator, rejected first; undeclared state → `tech-lead`,
  "Action required"; Memory buckets) handed to an `initial-design` tech-spec; new behaviours
  accepted (detached HEAD blocks actions, role view kept per project, Node < 22.12 refused, token
  removed from the address bar, ≤ 3 items per role in the summary, default approve reason
  "Approved via WingFoil UI"); proposed values for the SARD (refresh ≤ 5 s, auto-fetch every 60 s,
  last 10 updates, focus contrast 3:1, axe in both themes); Morgan's roles ordered `approver,
  tech-lead`.
- Stop-check: ≥ 1 nominal + ≥ 1 edge scenario per story ✓; scenarios atomic (one `When`) ✓; no
  ambiguous adjectives/adverbs ✓ (`check_bdd.py v0.1 v0.2`).

### Session 3 — Specification by Example, v0.3–v1.0 (2026-10-02)

- Outputs: 16 new `.feature` files (progress card, recent activity, next step, decision-log,
  ingestion, missing references, workflows, traceability, timeline, files, command palette,
  `ui.yaml` and presets, agents, packaging, user guide) — 103 scenarios (39 nominal, 64 edge) for
  the 38 v0.3–v1.0 stories; `00_conventions.md` v0.2 (progress elements, preset variant, ingestion
  and main-workflow rule, WingFoil 0.3 verbs assumption) — accepted after review.
- Totals: 110 MVP stories, 292 scenarios (116 nominal, 176 edge), 44 MVP features.
- Decisions:
  - **Permissions are WingFoil's** (supersedes Q11): C3 dropped from the MVP and merged into L6;
    nothing stored in `ui.yaml`; every team member may run what the CLI allows, presets included.
    Vision Package: `02` v0.3, `03` v0.5, `06` v0.5 (44 features), `07` v0.4 (v0.3: 12 features),
    `08` v0.3, `00_index`; directive `cli-only-writes` v1.2; story map v0.3 (US-C-05, US-C-06
    dropped; US-L-06 rewritten); request R-09 updated in the local WingFoil notes.
  - Presets are UI-only `ui.yaml` contents (Kanban, Scrum, `sw-life-cycle`), offered only without
    `ui.yaml`, refused when they map an undeclared type, committed alone.
  - **`progress.scope` declares the type only** (deviation from `ux-reference.md` §6, which had a
    fixed id): the current element is derived (WingFoil 0.3 `workflow status`; before it, the most
    advanced started, non-terminal element); completion and iterated figures on that element,
    open bugs and pending gates project-wide.
  - Ingestion offered only when the CLI sets every required field of the type (kanban: bug, adr,
    decision-log; custom: decision-log); v0.4 scenarios describe UI behaviour, CLI syntax confirmed
    at v0.4 `release-planning`; proposed SARD values: last 5 events, agent log lines ≤ 2 s.
- Stop-check: ≥ 1 nominal + ≥ 1 edge scenario per story ✓; atomic ✓; no ambiguous words ✓
  (`check_bdd.py`, all releases); `check_usm.py` ✓.
