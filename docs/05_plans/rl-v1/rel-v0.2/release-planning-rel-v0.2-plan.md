---
id: release-planning-rel-v0.2-plan
type: plan
title: "Release planning — rel-v0.2"
status: active
version: "0.1"         # optional — plan version
workflow: "release-planning"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-12 (0.1: plan created, checkpoint 1 decisions RP-1…RP-7)
**Branch:** `design/release-planning_v0.2` (merged to `main` with `--no-ff` at the end; RP-1)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`, v1.1) phase `planning` = `release-planning`
(`.wingfoil/workflows/custom/release-planning.yaml` v1.4)
**Roles:** product-owner (define-scope, reconcile-governance, build-backlog), tech-lead
(advance-pinned-build, triage-bugs, commit-backlog), architect (record-adrs, identify-specs),
approver (gates) — Roberto Pompermaier holds all of them; the agent drafts and audits (no approval
authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`draft`); its backlog
`docs/03_backlog/04_backlog/by-release/v0.2.json` (34 user stories + 12 technical tasks, 46
records); sequencer `docs/01_vision/07_sequencer.md` (v0.2 budget: 5 active days); ADRs `adr-001`,
`adr-002` (`accepted`); tech-specs `spec-001` … `spec-009` (`approved`); DLs `dl-001` … `dl-008`
(`ready`); bug-008 (`triaged`, `release: v0.2`); `governance-alignment-rel-v0.2-plan` (`done`)
**Evidence:** directives `wingfoil-cli` 1.8 (W-01 … W-26), `cli-only-writes`, `claim-evidence`;
`retrospective-rel-v0.1-plan` and dl-006 (actions for v0.2)

Why now: release `minor-v0.1` is `released` and its retrospective is done; the governance
alignment that had to precede this phase is `done` (`91aa630`). `release-cycle` starts with
`release-planning`.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `directives list` → `"warnings": []`; backlog validators pass (`check_backlog.py`,
  `check_releases.py`, `check_tasks.py` in `docs/03_backlog/X_tools/`).

Produces:

| Step | Output |
|------|--------|
| define-scope | `minor-v0.2` → `planning` |
| identify-specs | new or amended tech-specs (`approved`), only for uncovered v0.2 artefacts |
| build-backlog | `docs/04_memory/v0.2/task-NNN-….md` (`pending`), `release: v0.2` stamped on included elements |
| commit-backlog | tasks `backlog`; `minor-v0.2` → `in-development` (hand transition, W-25) |

## Phases / Steps

Each session: the agent drafts → the approver decides at a checkpoint (numbered points with a
recommended option) → the agent writes the decisions into the elements and into **Session log**
below → one commit per session (`docs(planning): session N — …`), plus the `wf(…)` commits the CLI
makes. Fields that `--set` cannot write are filled by editing the draft before `memory submit`
(W-01, W-02). Actual effort per session is recorded in the release's Execution Notes (dl-006
action 6).

| # | Step (workflow phase) | Role | Output | Stop-check |
|---|-----------------------|------|--------|------------|
| 1 | This plan; `advance-pinned-build`; `define-scope` (`minor-v0.2` submit → `planning`); `triage-bugs`; `reconcile-governance`; `record-adrs` (none, RP-7) | tech-lead, product-owner, architect | plan `active`; release `planning` | pin = newest published `wingfoil`; release required fields set; no `open` bug, no pre-gate DL/ADR in scope |
| 2 | v0.2 load decision (budget, records kept or moved; spec-002 §4, RP-4); `identify-specs` | product-owner, architect, approver | sequencer/backlog updated if anything moves; new or amended tech-specs if any | `build_backlog.py`, `check_backlog.py`, `check_releases.py` ✓; independent spec review PASS |
| 3 | `build-backlog`: vertical tasks grouped by module and feature, plus the governance/technical tasks of RP-3; DL release stamping (RP-6); bug-008 `triaged → planned` (W-26) | product-owner | `docs/04_memory/v0.2/task-*.md` (`pending`) | every v0.2 backlog record covered by exactly one task (`check_tasks.py`); `title`, `release` set; `module`, `ref`, `depends_on` filled |
| 4 | `commit-backlog`: the approver approves the tasks → `backlog`; release `planning → in-development` by hand (W-25); independent audit until PASS; plan finalized; merge | tech-lead, approver | tasks `backlog`; release `in-development` | audit PASS; validators ✓ |

## Handoff

- **Approver:** checkpoint decisions; spec approvals (step 2); task approvals (step 4, one
  `memory approve` for-loop run in the checkout holding the files).
- **Agent:** drafts, scripts, reviews coordination, `memory add` / `submit`, hand transitions,
  Session log, commits, push.
- **Completion:** release `in-development`, tasks `backlog`, plan `done`, branch merged. Next:
  `release-cycle` phase `implementation` (dev-loop per task).

## Session log

### Session 1 — 2026-10-12

Decisions (checkpoint 1, the approver: "as recommended", except point 1):

- **RP-1** — branch `design/release-planning_v0.2`, merged to `main` with `--no-ff` at the end, as
  for `release-planning` of v0.1 (the approver's choice).
- **RP-2** — four sessions: (1) plan, `advance-pinned-build`, `define-scope`, `triage-bugs`,
  `reconcile-governance`, `record-adrs`; (2) load decision and `identify-specs`; (3)
  `build-backlog`; (4) `commit-backlog` and audit.
- **RP-3** — besides the 46 backlog records, four governance/technical tasks are planned now
  (dl-006 action 6), not between waves: (a) load-independent tests — one temp-dir convention under
  `TempWorkspace` absorbing bug-008, fresh-read assertions, `test:smoke` as a gate of every wave
  (dl-006 action 1); (b) public-text check for absolute paths outside the repository (dl-006
  action 4); (c) the UD-7 amendments of spec-007 §1/§3/§6 and spec-006 §1 (dl-006 action 5); (d)
  the npm publishing pipeline (`governance-alignment-rel-v0.2-plan` GA-4, dl-004 Actions), with a
  checklist of the registry-side setup the approver performs.
- **RP-4** — spec-002 §4 (incremental parse, deferred from v0.1) is decided in session 2 with the
  load: in v0.2 only if TT-PERF-01 (Today first render) needs it, otherwise v0.3. The spec-007 §7
  Windows manual check is not a task: it is an open check of v0.2's release validation (the
  approver runs it on a Windows machine, or it is deferred with a note).
- **RP-5** — the load against the 5-day budget is decided in session 2 from a proposal (cuts,
  candidates to move, or a revised budget). Actual effort per phase is recorded in the release's
  Execution Notes from this session on (dl-006 action 6).
- **RP-6** — DL stamping at `build-backlog`: dl-006 → `v0.2` (its actions become v0.2 tasks);
  dl-007 and dl-008 stay empty (carried out by `governance-alignment-rel-v0.2-plan`, as dl-001);
  dl-004 keeps `v0.1` and is cited by the npm task.
- **RP-7** — `record-adrs`: no ADR now; if the npm pipeline needs a formal definition, it is a
  tech-spec found by `identify-specs`.

Steps:

- Step 1: plan created (`memory add`, `f8f5671` submit → `active`); branch
  `design/release-planning_v0.2` from `main` at `91aa630`.
  - `advance-pinned-build`: no switch. `npm run -s wingfoil -- --version` → `0.2.2`;
    `npm view wingfoil versions` → `["0.2.1","0.2.2"]` (2026-10-12): the pin is the newest
    published build; `directives list` → `"warnings": []`.
  - `define-scope`: `minor-v0.2` `draft → planning` (`4c8ead3`, `memory submit`); the
    required fields (`title`, `kind`, `version`, `pillar`, `features`, `requirements`,
    `release-line`) were already set at initial-design; scope unchanged (13 features, 46 backlog
    records); the submit carries the release's first Execution Notes entry (effort table, RP-5).
  - `triage-bugs`: `memory search --type bug --status open` → no match; bug-008 is already
    `triaged` with `release: v0.2` (taken in step 3 under RP-3 (a)).
  - `reconcile-governance`: `memory search` for `decision-log` `in-discussion` and `adr`
    `pending` → no match; the governance changes of dl-007 and dl-008 are already carried out
    (`governance-alignment-rel-v0.2-plan`, `done`).
  - `record-adrs`: none (RP-7).
