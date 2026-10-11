---
id: retrospective-rel-v0.1-plan
type: plan
title: "Retrospective rel-v0.1"
status: active
version: "0.3"         # optional — plan version
workflow: "retrospective"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.3 · **Date:** 2026-10-11 (0.1: plan created; 0.2: explore — friction inventory; 0.3:
additional-points decisions)
**Branch:** `main` (RT-1, as RV-1 for `release-submit` and `release-publishing`)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`, v1.1) phase `retrospective` = `retrospective`
(`.wingfoil/workflows/custom/retrospective.yaml` v1.1)
**Roles:** facilitator (explore, capture), approver (additional-points, approve) — Roberto
Pompermaier is the approver; the agent facilitates (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md` (`released`, `0f54194`; tag
`v0.1.0`); the six `done` plans of `docs/05_plans/rl-v1/rel-v0.1/`, starting from
`release-publishing-rel-v0.1-plan` → *Inputs for the retrospective of `minor-v0.1`*; tasks
task-001 … task-025 (`docs/04_memory/v0.1/`); bugs bug-001 … bug-008 (`docs/04_memory/bugs/`);
dl-004, dl-005; `docs/wingfoil-feedback/`; directive `wingfoil-cli` *Known behaviours*

Why now: release `minor-v0.1` is `released` (`release-publishing-rel-v0.1-plan` `done`);
`release-cycle` v1.1 closes with `retrospective`.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `main` = `origin/main`; release `minor-v0.1` `released`; the other plans of `rel-v0.1` `done`.

Produces: a source-cited friction inventory (in this plan); the retrospective decision-log
(`ready` after the approver's `memory approve`); any spin-off decision-logs or v0.2 tasks the
approver selects.

Deviation (RT-3): `retrospective.yaml` `capture` produces
`docs/04_memory/design/dls/retro-{release.version}.md`, but `memory.yaml` gives decision-logs the
id `dl-{n}-{slug}`; the CLI id is accepted and the deviation recorded in the decision-log.

## Phases / Steps

| # | Step (`retrospective.yaml`) | Role | Output | Stop-check |
|---|-----------------------------|------|--------|------------|
| 1 | This plan (`add` + `submit`) | facilitator | plan `active` | — |
| 2 | **explore** — three read-only miner agents in parallel (RT-2): (a) tasks 001–025; (b) bugs 001–008, dl-004/005, `docs/wingfoil-feedback/`, `wingfoil-cli` W-entries; (c) the release doc and the six plans (Execution Notes, Session logs, decisions). Synthesis: friction inventory grouped by theme, every item citing its source | facilitator | inventory below | every item cites a file (and section or id) |
| 3 | **additional-points** — inventory and improvement themes presented in chat; the approver adds points and chooses which become spin-off DLs or v0.2 tasks (RT-4). No commit beyond the Session log | approver | decisions in the Session log | the approver's answer |
| 4 | **capture** — `memory add --type decision-log --title "Retrospective v0.1"`, body filled by editing the draft, independent read-only review until PASS, `memory submit` | facilitator | DL `in-discussion` | review PASS (nothing above nit) |
| 5 | **approve** — the approver runs `memory approve <dl-id>` (`in-discussion → ready`) | approver | DL `ready` | `git log` shows the approve commit |
| 6 | Execution Notes "Retrospective" of `minor-v0.1`; housekeeping (RT-5); plan finalized (separate commit); push | facilitator | plan `done` | — |

## Handoff

- **Approver:** the additional points and the spin-off choices (step 3); `memory approve` of the
  retrospective DL and of any spin-off DL (step 5).
- **Agent:** explore, synthesis, DL drafting, reviews, `memory add` / `submit`, Session log,
  commits, push.
- **Completion:** retrospective DL `ready`, plan `done`. Next (RT-6, with the approver's OK):
  `wingfoil-sync` and `.wingfoil/` alignment with the WingFoil-Templates base pack (RV-10), then
  `release-cycle` `release-planning` for `minor-v0.2`.

## Session log

### Session 1 — 2026-10-11

Decisions (checkpoint, the approver: "as recommended"):

- **RT-1** — one plan `retrospective-rel-v0.1-plan`, on `main` (as RV-1).
- **RT-2** — explore by three parallel read-only miner agents (tasks; bugs + DLs + feedback;
  release doc + plans), then one synthesis.
- **RT-3** — accept the CLI id `dl-{n}-…` for the retrospective DL; the deviation from
  `retro-{release.version}.md` is recorded in the DL.
- **RT-4** — spin-off DLs and v0.2 tasks are chosen in `additional-points`, after the inventory.
- **RT-5** — housekeeping: delete `/tmp/wfui-no-hooks-*`; keep `/tmp/wfui-e2e-*` until bug-008
  is closed; delete the local merged `design/*` branches except `design/inception_v1` (also on
  `origin`). Two of the branches listed by RS-8 (`design/user-docs_v0.1`,
  `design/e2e-smoke_v0.1`) no longer exist locally (`git branch --list 'design/*'`).
- **RT-6** — `wingfoil-sync` and `.wingfoil/` alignment (RV-10) run right after this
  retrospective as a separate phase, with the approver's explicit OK.

Steps:

- Step 1: plan created (`3a9c23c` add, `09d3b04` submit → `active`).
- Step 2 — explore: three read-only miners (RT-2), synthesis below. Counts are from the task,
  bug and plan files cited; per-phase actual effort was not recorded, so no overrun is stated.

### Friction inventory of `minor-v0.1`

Sources: `task-NNN §…` = `docs/04_memory/v0.1/`; `bug-NNN §…` = `docs/04_memory/bugs/`; plan
ids = `docs/05_plans/rl-v1/rel-v0.1/`; `F-NNN` = `docs/wingfoil-feedback/`; `W-NN` = directive
`wingfoil-cli` *Known behaviours*.

**T1 — Independent review is the main defect filter (positive, with a cost).**
- At least one defect found by independent review in 23 of 25 tasks; task-022 clean PASS,
  task-024 had only a coordinator check (`task-022`, `task-024 §review`).
- Round 1 FAIL in 10 tasks (008, 010, 011, 012, 014, 015, 016, 020, 021, 025); 8 tasks needed 3
  or more rounds (006, 008, 010, 011, 012, 014, 015, 021) (task Execution Notes §review).
- task-021: three consecutive FAILs, each on a new clone-URL credential bypass; lesson: a
  security fix needs an adversarial reviewer who runs git itself (`dev-loop-rel-v0.1-plan`
  Session 5 Lessons; `task-021 §review rounds 1-4`).
- Outside tasks: the backlog audit FAILED with 5 major (`release-planning-rel-v0.1-plan`
  Session 4); the submit plan cited non-existent `.wingfoil/scripts/` paths, caught only by
  review (`release-submit-rel-v0.1-plan` Session 1 step 4); task-025 review found a React
  development bundle in the tarball (`NODE_ENV=test` reaching `prepack`, `task-025 §review round 1`).
- 5 of 8 bugs came from reviews or release validation, not from tests: bug-002, 003, 006, 007, 008
  (each `§Evidence`).

**T2 — Tests that did not catch what they should.**
- The harness hid two defects: the fixture builder stripped `GIT_*` (bug-002 §Evidence); every
  launcher and e2e test ran from the checkout, so the packed package that could not start was
  found only at release validation (bug-007 §Evidence). Guard added: `test/package/pack.test.ts`
  and `npm run test:smoke`.
- Tests written after the code in 8 tasks (001, 002, 004, 013, 017, 018, 019, 020), all
  self-reported; review fixes were test-first (task Execution Notes §red/green/refactor).
- Perf and fingerprint assertions passed on cached data: bug-005 (same-size rewrite in one mtime
  tick, found post-merge in task-015); R-05.1 measured on cached data (`task-021 §review round 1`).
- Temp folders leaked by tests and by the console: `/tmp/wfui-typedoc-*` (bug-001), e2e fixtures
  and `wfui-no-hooks-*` (bug-008); no temp-dir convention in `test/README.md`.

**T3 — Machine load.**
- External load (40–300 on 12 cores) caused spurious failures in at least 15 tasks
  (`task-003`…`task-021` §checks) across all five waves (`dev-loop-rel-v0.1-plan` Sessions 1–5).
- It produced bug-001 (timing split into `test:timing`, landed only in Wave 2 with task-010),
  bug-004 (timeouts; re-check partly below the load-15 bar, accepted at the gate) and the
  flaky panel test run with `--retry=2` (`task-020 §integration`).
- `test:timing` skipped for load in 5 tasks and at e2e-smoke (16.6) and submit (18); first green
  release-level run at the tag step (load 1.6–5.8) (`release-publishing-rel-v0.1-plan` Session 1).
- Concurrent suites race on `web/dist`; leaked e2e consoles outlived worktrees until a reaper was
  added (`dev-loop-rel-v0.1-plan` Session 3).

**T4 — Hand transitions and CLI workarounds.**
- No verb: task `backlog → in-progress`, `approved → done` (W-20); plan `active → done` (W-04);
  release `planning → in-development → releasing → released` (`df09286`, `677efa7`, `0f54194`);
  approve-release (OK in chat, RS-6); bug `triaged → planned`, `planned → in-progress`,
  `resolved → closed` (bug-001 … 007 §Triage & Execution Notes).
- Release and bug hand transitions have no W-entry; `df09286` cites W-04, which is about plans
  (`release-publishing-rel-v0.1-plan` Inputs).
- 19 feedback notes, all `open`, inbox "Last sync: none" (`docs/wingfoil-feedback/README.md`);
  about ten shaped daily work (F-003, 004, 010–016, 018, 019). W-22 and W-23 have no F-note.

**T5 — Workflows inherited from WingFoil, not tailored.**
- dl-001 Actions planned adapting the copied workflows before the first release-cycle;
  `release-publishing` was still unadapted (dl-004 Context).
- Absent artefacts cited: `.github/workflows/publish.yml`, adr-011, spec-015, dl-087, dl-024
  (`release-publishing.yaml`); `wingfoil-released`, `check:lockfile`, `check:mcp`
  (`release-planning-rel-v0.1-plan` Session 1, rewritten to v1.4).
- Convention mismatches: tag `{release.version}` = `v0.1` vs `v0.1.0` (RV-7); release commit in
  `submit` vs `tag` (RS-3); bug check `bugs where tags=[…]` vs bugs without `tags`
  (`release-submit-rel-v0.1-plan` review round 1); `docs/examples/` N/A (UD-5); `produces`
  `retro-{release.version}.md` vs the DL id pattern (RT-3); `e2e-smoke.yaml` rewritten for a web
  dashboard (`e2e-smoke-rel-v0.1-plan` Context).
- Repository checkers had to follow: `check_releases.py` accepted only `draft`; `check_tasks.py`
  extended for `GOV` tasks (`1d55674`).

**T6 — Specs amended while coding.**
- Spec gaps or amendments in at least 9 tasks (003, 004, 005, 006, 008, 009, 011, 012, 021);
  user decisions W3-1 … 47, W4-1 … 22 (`dev-loop-rel-v0.1-plan` Sessions 2–4). Positive: gaps
  fed back to the specs with dated Process Notes, not left in code.
- Still open: spec-007 §1/§3/§6 and spec-006 §1 differ from the code (UD-7); spec-002 §4
  incremental parse deferred (CHANGELOG); spec-007 §7 Windows manual check.

**T7 — Agents and coordination.**
- At least 14 agent stops (usage limits, rate limits, network, reboot, session end) across Waves
  2–5, all resumed from commits with no recorded loss (`dev-loop-rel-v0.1-plan` Sessions 2–5).
- The rules file in `/tmp` was lost on a reboot, moved to a git-ignored `.notes/` (RV-9); an agent
  acted on its own recommendations before the user answered → rule "when told to wait, wait"
  (`dev-loop-rel-v0.1-plan` Session 3).
- Merge collisions between parallel tasks: 004, 006 (async `cliBuildFor` broke task-011's test,
  `6f9802e`), 008, 011 (task Execution Notes). Positive: explicit hand-overs and the
  "depends_on acknowledged" step caught inherited conventions in 002, 003, 005, 010, 021.

**T8 — Planning and scope.**
- Budget raised from 6 to 9 active days at the load decision; calendar 2026-10-02 → 2026-10-11;
  validation, submit and publishing all on 2026-10-11 (`release-planning-rel-v0.1-plan` Session 2;
  `minor-v0.1` Execution Notes). No per-phase actuals recorded.
- Four governance tasks (022–025) added outside the backlog; tasks 21 → 25 (`minor-v0.1`
  Implementation; ES-5). Backlog and module counts in a commit message were wrong until the audit
  (`release-planning-rel-v0.1-plan` Session 4 A7).
- Bug fixes absorbed into later tasks tie them to a later wave (bug-001 fixed in Wave 2, bug-005
  open from Wave 4 to the end) (bug Execution Notes).

**T9 — Public repository hygiene.**
- A local path outside the repository and internal session names reached committed text; found
  after the tag by a cross-project request, fixed by dl-005; history and tag `v0.1.0` keep the old
  text (dl-005 Context, Rationale). dl-005 Actions: consider a lint or review check.
- Plan frontmatter `version` drifted from the Context header (`dev-loop-rel-v0.1-plan`: 0.7 vs
  0.8).

**T10 — What went well.**
- Final gates: `test:coverage` 1949 passed (96.67 % statements), e2e 129/129, smoke 4/4,
  `test:timing` green at the tag (`release-submit-rel-v0.1-plan`, `release-publishing-rel-v0.1-plan`).
- bug-001 … 007 closed before release; bug-004 closed by a measured load experiment; eight
  limitations documented in `CHANGELOG.md`.
- Repository checkers negative-tested on injected defects; red-first commits cited in 10 tasks.
- Process lessons turned into rules (load threshold, wait-at-checkpoint, phase-boundary rule for
  cross-project requests).

### Additional points — decisions (the approver: "as recommended")

- Step 3 — inventory and improvement themes presented; no further points from the approver.
- **RT-7** — v0.2 task "load-independent tests" (T2, T3): one temp-dir convention (under
  `TempWorkspace`) with bug-008; perf and fingerprint assertions prove a fresh read, not cached
  data; the package smoke (`test:smoke`) as a gate at every wave. An Action of the retrospective
  DL, not a separate DL.
- **RT-8** — spin-off DL "hand transitions" (T4): `wingfoil-cli` W-entries for the release and bug
  hand transitions; feedback note F-020 for WingFoil; the missing F-notes for W-22 and W-23.
- **RT-9** — spin-off DL "tailor the inherited workflows" (T5), carried out within `wingfoil-sync`
  (RV-10, RT-6): `release-publishing`, `release-submit` (tag name, release commit, bug check) and
  `retrospective` (`produces`).
- **RT-10** — v0.2 task "public-text check" (T9, dl-005 Actions): a test that fails on absolute
  paths outside the repository in tracked text; session names stay a review-checklist item.
- **RT-11** — v0.2 task for the spec amendments of UD-7 (spec-007 §1/§3/§6, spec-006 §1), planned
  in `release-planning` of `minor-v0.2`.
- **RT-12** — process rules recorded in the retrospective DL, no separate DLs: an adversarial
  reviewer who runs the tool for security fixes; per-phase actuals in the release Execution Notes;
  plan frontmatter `version` kept equal to the Context header; governance tasks planned at
  `release-planning`.

### Capture

- Step 4: `memory add` of dl-006 (retrospective, `bea2d45`), dl-007 (hand transitions, RT-8,
  `a54adfd`) and dl-008 (inherited workflows, RT-9, `2d133a5`); bodies filled by editing the
  drafts. Independent read-only review: round 1 FAIL (5 major, 8 minor, 7 nits — a bug credited
  to review instead of release validation, an unsourced load claim, a tag placeholder giving
  `vv0.1.0` and not decided, an unsourced description of `wingfoil-sync`, an option not chosen by
  the approver); round 2 FAIL (3 minor, 2 nits introduced by the fixes); round 3 PASS.
