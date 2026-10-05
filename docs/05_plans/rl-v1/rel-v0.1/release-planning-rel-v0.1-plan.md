---
id: release-planning-rel-v0.1-plan
type: plan
title: "Release planning — rel-v0.1"
status: done
version: "1.0"         # optional — plan version
workflow: "release-planning"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Date:** 2026-10-02 · **Branch:** `design/release-planning_v0.1` (merged to `main` with `--ff=false` at the end)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`) phase `planning` = `release-planning` (`.wingfoil/workflows/custom/release-planning.yaml`)
**Roles:** product-owner (define-scope, reconcile-governance, build-backlog), tech-lead
(advance-pinned-build, triage-bugs, commit-backlog), architect (record-adrs, identify-specs),
approver (gates) — Roberto Pompermaier holds all of them; the agent drafts and audits (no approval
authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md`; its backlog
`docs/03_backlog/04_backlog/by-release/v0.1.json` (39 user stories + 34 technical tasks, 73
records — 72 / 33 after session 2); sequencer `docs/01_vision/07_sequencer.md` v0.5 (budget: 6 active days); ADRs
`adr-001`, `adr-002` (`accepted`); tech-specs `spec-001` … `spec-005` (`approved`); DLs `dl-001` …
`dl-003` (`ready`)
**Evidence:** handoff of `initial-design-rl-v1-plan` (`done`); directives `wingfoil-cli` v1.2
(W-01 … W-20), `cli-only-writes` v1.4, `claim-evidence`

Why now: `initial-design-rl-v1-plan` is `done` and merged; `rl-v1` is `active` and its first
release, `minor-v0.1`, is `draft`. `release-cycle` starts with `release-planning`.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `initial-design-rl-v1-plan` is `done`; `directives list` → `"warnings": []`; backlog validators
  pass (`check_backlog.py`, `check_releases.py`).

Produces:

| Step | Output |
|------|--------|
| define-scope | `minor-v0.1` → `planning` |
| identify-specs | `docs/04_memory/design/specs/spec-…` (`approved`), only for uncovered v0.1 artefacts |
| build-backlog | `docs/04_memory/v0.1/task-NNN-….md` (`pending`), `release: v0.1` stamped on included DLs |
| commit-backlog | tasks `backlog`; `minor-v0.1` → `in-development` |

## Phases / Steps

Each session: the agent drafts → the session (human + agent) reviews and decides → the agent
writes the decisions into the elements and into **Session log** below → one commit per session
(`docs(planning): session N — …`), plus the `wf(…)` commits the CLI makes. Fields that `--set`
cannot write are filled by editing the draft before `memory submit` (W-01); before each submit the
draft is checked against `memory.yaml`'s `required` list (W-02).

| # | Step (workflow phase) | Role | Output | Stop-check |
|---|-----------------------|------|--------|------------|
| 1 | This plan; `release-planning.yaml` `advance-pinned-build` adapted to this project; `advance-pinned-build`; `define-scope` (`minor-v0.1` submit → `planning`); `triage-bugs`; `reconcile-governance`; `record-adrs` (optional) | tech-lead, product-owner, architect | plan `active`; workflow v1.4; release `planning` | pin = newest published `wingfoil`; release required fields set; no `open` bug, no pre-gate DL/ADR in scope |
| 2 | v0.1 load decision (budget, technical tasks kept or moved); `identify-specs` | product-owner, architect, approver | sequencer/backlog updated if anything moves; new tech-specs if any | `build_backlog.py`, `check_backlog.py`, `check_releases.py` ✓; independent spec review passed |
| 3 | `build-backlog`: ~20 vertical tasks grouped by module and feature; DL release stamping | product-owner | `docs/04_memory/v0.1/task-*.md` (`pending`) | every one of the v0.1 backlog records covered by exactly one task (script); `title`, `release` set; `module`, `ref`, `depends_on` filled |
| 4 | `commit-backlog`: tasks `approve` → `backlog`; release `planning → in-development` by hand; independent audit; plan finalized; merge | tech-lead, approver | tasks `backlog`; release `in-development` | audit passed and re-verified; validators ✓ |

### Decisions taken at the start (2026-10-02)

- Four sessions on branch `design/release-planning_v0.1`.
- `advance-pinned-build` means here: move the `wingfoil` devDependency in `package.json` to the
  newest **published** version only if newer (forward only), one commit changing only
  `package.json` and `package-lock.json`; re-run the CLI contract tests (once they exist) and
  re-check the `wingfoil-cli` directive. WingFoil's `wingfoil-released`, `check:lockfile` and
  `check:mcp` do not exist here; the workflow text is fixed (v1.4).
- v0.1 load: proposal to keep the 39 user stories (they carry the exit criteria) and accept a longer
  budget (~8–10 active days) rather than cut; candidates to move to a later release: TT-ARC-07
  (`ui.yaml`, stories C-* are v0.3), TT-PERF-04 (p95 measurement), TT-INT-08 (three engines; v0.1
  on Chromium only) — decided in session 2.
- Task granularity: **~20 vertical tasks** grouped by module and feature (option B), not one per
  backlog record: each dev-loop iteration (branch, TDD, review gate, approval, merge) has a fixed
  cost and the technical tasks are cross-cutting constraints implemented with their stories. `ref`
  holds the task's primary backlog id; the task body lists every backlog record it covers; a
  script checks that the 73 records (72 after session 2) are covered exactly once.
- DL release stamping: `dl-002` → `v0.1` (applies to read-only from day one); `dl-003` left for v0.3
  (implemented through spec-005); `dl-001` left empty (process decision, already executed).
- Release `planning → in-development` has no CLI verb: edit `status` by hand and commit
  `wf(release): minor-v0.1 [planning → in-development]` (as plans are finalized, W-04).

### Carried open points

- spec-004 and spec-005 also cover v0.2/v0.3 routes and features — only their v0.1 parts are in
  scope here.
- `spec-review.passed` (record-adrs, identify-specs) is satisfied as in `initial-design`: an
  independent, read-only, fresh-context review, re-verified by the same reviewer after fixes.
- WingFoil requests (local notes): R-11 read verbs (`memory show`, type schema, `directives show`).

## Handoff

- **Agent:** drafts every element, fills the fields `--set` cannot write, runs the scripted checks,
  launches the independent reviews, keeps the session log, commits.
- **Human (product-owner / tech-lead / architect / approver):** decides in each session; runs or
  authorises every `memory approve` (only `approver` can, W-13).
- **Checkpoints:** end of each session; spec review before any new tech-spec is approved; audit
  before commit-backlog closes.
- **Completion:** `minor-v0.1` `in-development`; every v0.1 task `backlog`; plan finalized by hand
  (`status: done`, commit `wf(plan): finalize release-planning-rel-v0.1-plan [active → done]`, W-04)
  and the branch merged to `main` with `--ff=false`.
- **Next:** `release-cycle` phase `implementation` — `dev-loop` per task (`tags`/`release` v0.1,
  status `backlog`), plan scope `rl-v1/rel-v0.1`. Tasks are picked by `depends_on`, **not by
  number**; a valid order: 001, 002, 003, 004, 007, 005, 006, 009, 010, 011, 008, 012, 013, 018,
  017, 020, 015, 019, 014, 016, 021.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — Plan, pinned build, scope (2026-10-02)

- Outputs: this plan (`9d2f45f`, `draft → active`); `release-planning.yaml` v1.4 —
  `advance-pinned-build` adapted (pin = `wingfoil` devDependency, forward only, published only;
  post-check: `directives list` with no warnings and CLI contract tests once they exist; WingFoil's
  `wingfoil-released`, `check:lockfile`, `check:mcp` removed); `minor-v0.1` `draft → planning`
  (`3891864`).
- Decisions: the six points of *Decisions taken at the start* confirmed; task granularity chosen
  after a pros/cons comparison of one task per backlog record (73), ~20 vertical tasks, and 39
  stories 1:1 plus infrastructure tasks (~45) — **~20 vertical tasks** (option B).
- `advance-pinned-build`: no-op — `npm run -s wingfoil -- --version` → `0.2.2` = the pin;
  `npm view wingfoil versions` → `0.2.1`, `0.2.2` (no newer published build).
- `define-scope`: `minor-v0.1` required fields present (`title`, `kind`, `version`, `pillar`,
  `features`, `requirements`, `release-line`); scope, pillar focus and success criteria unchanged
  from `initial-design`.
- `triage-bugs`: no-op — `memory search --type bug` matches nothing.
- `reconcile-governance`: no-op — `dl-001` … `dl-003` already `ready`, `adr-001`, `adr-002`
  already `accepted`; nothing pre-gate in scope.
- `record-adrs` (optional): skipped — the v0.1 scope needs no ADR beyond `adr-001`/`adr-002`.
- Deviation: `check_releases.py` required status `draft` and failed once `minor-v0.1` reached
  `planning`; it now accepts any `release` state of `memory.yaml`.
- Checks: `check_releases.py` OK (5 releases, 44 / 44 MVP features); `check_backlog.py` all checks
  passed (161 items, 238 links); `directives list` → `"warnings": []`; workflow YAML parses.

### Session 2 — Load and identify-specs (2026-10-03)

- Load decided (all as proposed):
  - **budget** v0.1 6 → 9 active days — sequencer `07` v0.6, canvas `08` v0.4 (≈ 33 active days);
  - **REQ-ARC-07 → v0.3** (read, inferred defaults, presets): no `@v0.1` scenario reads `ui.yaml`
    (M-02 buckets come from spec-003 state kinds) — SARD `01` v0.6; spec-004 `GET /config` serves
    `ui.yaml` from v0.3; spec-005 `release` v0.1 → v0.3; TT-ARC-07 now in v0.3;
  - **REQ-INT-08 staged**: v0.1 e2e on Chromium, three engines from v0.2 — SARD `04` v0.4;
    TT-INT-08 stays in v0.1 with the narrower scope; `minor-v0.2` notes the extension;
  - **TT-PERF-04 kept** in v0.1;
  - backlog regenerated (`build_backlog.py`): v0.1 = 39 stories + 33 technical tasks (72), v0.3 =
    25 + 3 (28); `00_backlog.md` v0.4; `minor-v0.1`/`minor-v0.3` counts and citations updated.
  - Finding while weighing: `build_backlog.py` assigns a technical task to the **first** release
    of its SARD requirement — moving a TT means changing the requirement's Release field.
- `identify-specs`: survey of v0.1 artefacts against spec-001…005, ADRs and BDD conventions —
  covered: CLI contracts, descriptor, HTTP API/session, snapshot (adr-001 D6), fixtures (BDD
  conventions). Specified (user asked for all four, not only the local state):
  `spec-006-local-state-store`, `spec-007-launcher-command-line`, `spec-008-message-catalogue`,
  `spec-009-theme-tokens` (`release: v0.1`). Contrast ratios of spec-009 computed by script
  (WCAG 2.1); deviation: prototype muted text `#6B7890` fails AA (4.45:1) → `#5C6880`;
  `ux-reference.md` v0.2 §9 points to spec-009 (`ux-consistency`).
- `spec-review.passed`: independent read-only agent — PASS, 25 findings (no blocker/major), 24
  fixed, F25 (SARD Input line lists consumed versions) left by decision; re-verified by the same
  agent: all resolved, 6 new nits fixed. Side fixes: spec-004 `GET /api/server` `warnings`,
  project-list refusal codes referenced from spec-004 §5 (process notes).
- Specs: `add` → `submit` by the agent; `approve` run by the user (approver), commits `438d82b`,
  `fea71c2`, `40f65b1`, `ac72db8` — spec-001…009 all `approved`.
- Checks: `check_usm.py`, `check_bdd.py`, `check_sard.py`, `check_backlog.py` all checks passed;
  `check_releases.py` OK; `directives list` → `"warnings": []`.

### Session 3 — Build backlog (2026-10-03)

- Decisions (all as proposed): 21 tasks in the order of the proposal; **each technical task sits
  in the module that implements it, server tasks also own the server-only stories (X-02…04), web
  tasks own the user stories** — one module per task (wording corrected in session 4, audit A13); priority high for task-001…013, medium for task-014…021; tag `v0.1` (the
  `release-cycle` implementation filter); coverage script in `docs/03_backlog/X_tools/`.
- Two placements corrected while checking scenarios: US-S-27 (failed CLI read) → task-019 (its
  scenarios are on the DNA view); US-S-10 (no CLI) → task-014 (add modal and switcher).
- Outputs: `task-001` … `task-021` under `docs/04_memory/v0.1/` — `memory add --set release=v0.1
  --tags v0.1`, then `module`, `priority`, `ref` (first backlog item), `depends_on` and the body
  (Description with `**Backlog items:**`, the stories' text; Acceptance Criteria = the `@v0.1`
  scenarios per feature file and the technical tasks' fit criteria; screen, prototype and
  accessibility bar for web tasks; Implementation Notes = specs, ADR decisions, directives)
  filled by editing the drafts (W-01), then `memory submit` → `pending` (21 commits).
- `docs/03_backlog/X_tools/check_tasks.py` (new): release and tag, required fields, module in DNA,
  backlog ids valid, `ref` among them, `depends_on` within the release, every by-release item listed
  exactly once. Negative test on a scratch copy: 4 injected defects → 4 failures, exit 1.
- Release stamping: `dl-002` `release: v0.1` (by edit, no CLI verb for the field); `dl-001`,
  `dl-003` unassigned; specs already stamped (spec-001…004, 006…009 v0.1; spec-005 v0.3); ADRs v0.1.
  `triage-bugs` selected no bug, so no fix task.
- Checks: `check_tasks.py` OK (21 tasks, 72 / 72 items); `check_backlog.py`, `check_releases.py`
  OK; `directives list` → `"warnings": []`.

### Session 4 — Commit backlog (2026-10-04)

- Independent audit (fresh-context, read-only) of the release-planning outputs: **FAIL** — 5 major,
  7 minor, 4 nit:
  - A1 web tasks depended on screens of tasks they did not depend on, with a cycle 017 → 018 →
    019 → 017; A2 task-013 (shell) carried every-screen acceptance (themes, strings); A3 missing
    server dependencies; A4 fit criteria quoted from the SARD named capabilities of later releases
    (Today, gate actions, decision-log creation, X-10.4/5); A5 no refusal contract for S-10.1;
  - minor/nit: fixture variants (A6), wrong module counts in `minor-v0.1` and in the message of
    `b60dc9e` — **11 server, 1 contracts, 9 web**, not 12/1/8 (A7; the commit message cannot be
    changed), dl-002 cited by no task (A8), wrong references (A9), reversed backlog dependencies
    without a note (A10), `projects` event without owner (A11), X-02.1 browser side (A12), plan
    wording and counts (A13, A14), stale sequencer citations (A15), `check_tasks.py` gaps (A16).
- Decisions (user): all fixes as proposed; tasks edited **in place while `pending`** (no reject to
  `draft`).
- Fixes:
  - web order 013 → 018 → 017 → 019 → 020 → 015 → 014 → 016 → 021: the element panel (task-018)
    is reachable by URL and comes first; US-G-02 → task-019; dependencies 017→018, 019→017/018,
    015→012/017/018, 014→015/017, 016→014/015/019/020; the e2e harness registers fixtures through
    `POST /api/projects`, so views are testable before the add modal;
  - US-X-08, US-X-09, TT-ARC-09, TT-ARC-11 → task-021; task-013 keeps US-S-01 and the mechanisms
    (unit-tested), depends on 008, 012;
  - dependencies 012→006/009, 009→003/007, 008→003/010 (the `projects` event, A11);
  - SARD v0.7 (`01` v0.7, `02` v0.3, `03` v0.4, `04` v0.5, `05` v0.4): v0.1 scope in Release and
    fit criterion of REQ-ARC-05, ARC-10, INT-03, PERF-05, SEC-05, STATE-06; backlog regenerated;
  - spec-006 `availability` (`ok`, `folder-not-found`, `not-wingfoil`, `cli-not-found`), `projects`
    event, `cli-not-found` refusal; spec-008 `error.cliNotFound`;
  - BDD conventions v0.6: CLI stub = the package `bin` script (adr-001 D2), version-fake and no-CLI
    fixture variants;
  - every server/contracts task names, per scenario, the web task that closes its e2e; dl-002 cited
    in task-007 and task-011; references corrected; `rl-v1` Delivery note and sequencer v0.6
    citations in every release; `check_tasks.py` reads modules from `dna.yaml`, checks each item's
    scenarios inside its own acceptance block, detects `depends_on` cycles (negative-tested).
- Re-verification by the same agent: **PASS** — all 16 resolved; new N1–N4 (minor) and N5–N6 (nit)
  fixed: X-02.1 closure named in task-007 and task-015; REQ-INT-03 v0.1 scope = version notice
  (S-08.3 is v0.4); `GET /api/projects` returns `path` and `remote` for the switcher (ux-reference
  §3; REQ-SEC-04 restricts URLs only); per-item scenario check; run order in *Handoff → Next*.
- Checks: `check_usm.py`, `check_bdd.py`, `check_sard.py`, `check_backlog.py` all checks passed;
  `check_releases.py` OK; `check_tasks.py` OK (21 tasks, 72 / 72); `directives list` →
  `"warnings": []`.
- Committed before the approvals, so that the `approve` commits change only the task status.
- `commit-backlog`: the user (approver) approved the 21 tasks → `backlog` (`542de86` … `b656e82`);
  `minor-v0.1` `planning → in-development` by hand (`df09286`, no CLI verb, W-04);
  `check_releases.py` OK, `memory search --type task` → 21 `backlog`.
- Plan finalized (`status: done`) and branch merged to `main` with `--no-ff` at the user's request.

