---
id: retrospective-rel-v0.2-plan
type: plan
title: "Retrospective rel-v0.2"
status: active
version: "0.4"         # optional — plan version
workflow: "retrospective"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.4 · **Date:** 2026-10-21 (0.1: plan created; 0.2: explore — friction inventory; 0.3:
additional-points decisions, T7 corrected; 0.4: capture)
**Branch:** `main` (RT2-1, as RT-1 of v0.1)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`, v1.1) phase `retrospective` = `retrospective`
(`.wingfoil/workflows/custom/retrospective.yaml` v1.2: `explore`, `additional-points`, `capture`,
`approve`)
**Roles:** facilitator (explore, capture), approver (additional-points, approve) — Roberto
Pompermaier is the approver; the agent facilitates (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`released`, `dc4feac`; tag
`v0.2.0`; `wingfoil-ui@0.2.0` on npm); the seven `done` plans of `docs/05_plans/rl-v1/rel-v0.2/`,
starting from `release-publishing-rel-v0.2-plan` → *Inputs for the retrospective of `minor-v0.2`*;
tasks task-026 … task-045 (`docs/04_memory/v0.2/`); bugs bug-008 … bug-023
(`docs/04_memory/bugs/`); dl-006, dl-007, dl-008; `docs/wingfoil-feedback/`; directive
`wingfoil-cli` *Known behaviours*; `docs/publishing.md` 0.4

Why now: release `minor-v0.2` is `released` (`release-publishing-rel-v0.2-plan` `done`);
`release-cycle` v1.1 closes with `retrospective`.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `main` = `origin/main`; release `minor-v0.2` `released`; the other plans of `rel-v0.2` `done`.

Produces: a source-cited friction inventory (in this plan), including the check of dl-006's
Actions against the v0.2 record; the retrospective decision-log (`ready` after the approver's
`memory approve`); any spin-off decision-logs for configuration or process changes the approver
selects. No change to `.wingfoil/` and no base-pack alignment in this phase: they are decided here
and carried out afterwards, with the approver's OK (RT2-5).

## Phases / Steps

| # | Step (`retrospective.yaml`) | Role | Output | Stop-check |
|---|-----------------------------|------|--------|------------|
| 1 | This plan (`add` + `submit`) | facilitator | plan `active` | — |
| 2 | **explore** — three read-only miner agents in parallel (RT2-2): (a) tasks 026–045; (b) bugs 008–023, dl-006 … dl-008, `docs/wingfoil-feedback/`, `wingfoil-cli` W-entries, `docs/publishing.md`; (c) the release doc and the seven plans (Execution Notes, Session logs, decisions). Synthesis: friction inventory grouped by theme, with the status of each dl-006 Action (RT2-3) | facilitator | inventory below | every item cites a file (and section or id) |
| 3 | **additional-points** — inventory and improvement themes presented in chat with options and one recommendation each; the approver adds points and chooses which become spin-off DLs, v0.3 tasks or rules (RT2-4). No commit beyond the Session log | approver | decisions in the Session log | the approver's answer |
| 4 | **capture** — `memory add --type decision-log --title "Retrospective v0.2"` and any spin-off DLs; bodies filled by editing the drafts; independent read-only review with fresh context until PASS; `memory submit` | facilitator | DLs `in-discussion` | review PASS (nothing above nit) |
| 5 | **approve** — the approver runs `memory approve <dl-id>` (`in-discussion → ready`) | approver | DLs `ready` | `git log` shows the approve commits |
| 6 | Execution Notes "Retrospective" of `minor-v0.2`; housekeeping chosen at step 3; plan finalized (separate commit); push | facilitator | plan `done` | — |

## Handoff

- **Approver:** the additional points and the choices of step 3; `memory approve` of the
  retrospective DL and of any spin-off DL (step 5); the OK before each step and before closing the
  plan.
- **Agent:** explore, synthesis, DL drafting, reviews, `memory add` / `submit`, Session log,
  commits, push.
- **Completion:** retrospective DL `ready`, plan `done`. Next, with the approver's OK: the actions
  decided at step 3 that come before `release-planning` of `minor-v0.3` (e.g. the `.wingfoil/`
  alignment), then `release-cycle` `release-planning` for `minor-v0.3`.

## Session log

### Session 1 — 2026-10-21

Decisions (checkpoint, the approver: "as recommended"):

- **RT2-1** — one plan `retrospective-rel-v0.2-plan`, on `main` (as RT-1): the phase writes only
  this plan, the DLs and the release's Execution Notes.
- **RT2-2** — explore by three parallel read-only miner agents (tasks; bugs + DLs + feedback;
  release doc + plans), run on a mid-size model, then one synthesis by the facilitator.
- **RT2-3** — the explore checks each Action of dl-006 (and of dl-007, dl-008) against the v0.2
  record: done, partly done or not done, with the source.
- **RT2-4** — spin-off DLs, v0.3 tasks and process rules are chosen at `additional-points`.
- **RT2-5** — no edit of `.wingfoil/`, no base-pack alignment and no pin change in this phase; no
  heavy gate is planned; no tag push, `workflow_dispatch` or registry write.

State at start (checked 2026-10-21):

- `main` = `origin/main` = `47fd6ec`, no worktree; local and `origin` branches
  `design/inception_v1`, `design/release-planning_v0.2`, `design/user-docs_v0.2`,
  `design/e2e-smoke_v0.2`.
- `minor-v0.2` `released`; the seven plans of `rel-v0.2` `done`; task-026 … task-045 `done`;
  bug-008 … bug-023 `closed` except bug-019 and bug-023 (`triaged`, `release: "v0.3"`). bug-018 is
  `closed` with an empty `release`.
- Tag `v0.2.0` on `origin`; `wingfoil-ui` on npm: `latest` = `0.2.0`, versions `0.0.0-stage`,
  `0.2.0`; GitHub Release `v0.2.0` (three assets).
- Pinned CLI `0.2.2`; `wingfoil` `latest` on npm is `0.3.0`.

Steps:

- Step 1: plan created (`be26dd8` add, `081a35e` submit → `active`).
- Step 2 — explore: three read-only miners (RT2-2), synthesis below; claims the miners disagreed
  on were re-checked against the files (plan versions, `Last sync`, spec-007 Process Notes, UD2-7).

### Friction inventory of `minor-v0.2`

Sources: `task-NNN §…` = `docs/04_memory/v0.2/`; `bug-NNN §…` = `docs/04_memory/bugs/`; plan ids
and decision ids = `docs/05_plans/rl-v1/rel-v0.2/`; *RN* = `minor-v0.2.md` Execution Notes;
`F-NNN` = `docs/wingfoil-feedback/`; `W-NN` = directive `wingfoil-cli` *Known behaviours*. v0.1
themes (`retrospective-rel-v0.1-plan` T1 … T10) are marked recurred, improved or fixed.

**T1 — Independent review is still the main defect filter (positive, with a cost; v0.1 T1
recurred).**
- Round 1 was not a PASS in 18 of 20 tasks (exceptions task-042, PASS with minors, and task-045);
  a major or blocker at round 1 in 10 tasks (028, 029, 032, 033, 036, 037, 038, 040, 041, 044);
  about 59 independent rounds in all, 5 in task-034 and task-040 (task Execution Notes §review).
- Reviews and design probes, not tests, found 8 of the 16 bugs (bug-008, 010, 011, 013, 014, 015,
  017, 018 — each `§Evidence`).
- Document and plan reviews ran FAIL → FAIL → PASS five times: spec review and backlog audit
  (`release-planning-rel-v0.2-plan` Sessions 2, 4), governance alignment (FAIL → PASS),
  user-docs, the release commit (RN *Submit & Publishing*). Several round-2 findings were slips the
  round-1 fixes introduced: a Version line not bumped, wraps, ids shifted by the renumbering, a
  stale effort table (`release-submit-rel-v0.2-plan` Session 2; `release-planning-rel-v0.2-plan`
  Session 4).

**T2 — Machine load and the cost of heavy gates (v0.1 T3 recurred, mitigated).**
- Load-bound test defects, same class as bug-004: bug-009 (load ~25), bug-011 (27), bug-015
  (158), bug-023 (20–26, fix in v0.3) (each `§Evidence`).
- Three-engine `test:e2e` at the seven wave gates took 20–38 min each, 59.8 min at e2e-smoke (935
  tests, load 11–19); W0-9 restricted it to wave gates for cost (`dev-loop-rel-v0.2-plan`
  Sessions 1–7; RN *E2E smoke*).
- `test:timing` skipped on `main` for load at Waves 0, 1, 3; a false regression alarm under another
  project's build (RP-9, task-042; Wave 6 2 127 ms → 744 ms p95 alone) (`dev-loop-rel-v0.2-plan`
  Sessions 1, 2, 4, 5, 7).
- The machine-free slot (approver, Wave 5) checks the load only when it grants; long gates still
  ran under load (bug-023 §Notes); slot waits are not recorded per gate.

**T3 — Green locally, red on the first CI run (new).**
- The repository's first CI run was the `workflow_dispatch` dry run at release-submit; three dry
  runs found bug-020 (no full name on the runner's account), bug-021 (git ≥ 2.48
  `refs/remotes/<r>/HEAD`) and bug-022 (git 2.55 wording); local git is 2.43, the runner's 2.55
  (`release-submit-rel-v0.2-plan` Session 1; bug-020 … bug-022 §Evidence).
- Cost: two test-only tasks (task-044, task-045) and about one active day (RN effort table, the
  10th); task-044 round 1 had a blocker that held only on git < 2.48 (task-044 §review).
- The strict-git wrappers now in `test/README.md` *Git identity* reproduce the runner (task-044
  §design).

**T4 — Security of tool-sourced input: guards that did not converge (v0.1 T1 lesson, recurred).**
- Adversarial rounds: 17 over five tasks (026, 032, 033, 034, 040); each security task needed 3–5
  (task Execution Notes §review; RP-47 extended to task-040).
- W4-16 reversed W4-12 and W4-15: the auto-update value heuristics were removed (shell expansion
  bypassed them, they blocked common configs) and the risk declared (spec-010, user guide,
  CHANGELOG); the structural options are left to this retrospective (`dev-loop-rel-v0.2-plan`
  Session 5 *For the retrospective*; task-034 §For the retrospective).
- bug-017 grew over four rounds (add, clone, CLI warnings, file names) (task-040 §review); open
  follow-ups: the typed `SafeToolMessage`, the key-rendering build (UD2-5; task-040).
- task-029 (publish pipeline permissions) had no adversarial round; its round 1 found that a
  dispatch on a tag could reach `promote` (task-029 §review).

**T5 — Specs amended while coding, gaps accepted (v0.1 T6 recurred).**
- Approved specs or the UX reference amended in place in 12 of 20 tasks; most often spec-004
  §3–§5 and spec-010 (032, 033, 034, 040); UX reference 1.1 → 1.10 (task Execution Notes;
  RN *Implementation*).
- dl-006 action 5 was done at release-planning (RP-11, spec-007 *Process Notes*), but new
  differences of spec-007 §1/§3/§6 are open: UD2-7, "a governance task after v0.2", none planned
  yet (`user-docs-rel-v0.2-plan`).
- Accepted gaps: ES2-3 (six, e.g. no route-inventory test, Scrum and `unknown` fixtures with no UI
  write); task-043's `opener.ts` follow-up (`e2e-smoke-rel-v0.2-plan`; task-043 §review).

**T6 — Hand transitions, field hygiene and the CLI (v0.1 T4 improved).**
- dl-007 landed: W-25, W-26, F-020 … F-022 (`7af83f1`) and release commits cite W-25. Still every
  task needs two hand transitions (W-20), bugs two (W-26), the release three (W-25).
- Bug `release` field: bug-019 and bug-023 would have failed the bug check with an empty field
  (RS2-4, fixed by hand); bug-018 is `closed` with `release: ""` (not covered by RV2-2's stamp).
- W-27 cost a full redo of the 17 task ids at planning (RN *Planning*) and recurred at task-043
  (`task-018`, reset before push); the directive still does not say that placeholders must be
  named like elements (`e2e-smoke-rel-v0.2-plan` *For the retrospective*; W-27).
- Feedback inbox: 26 notes, all `open`, *Last sync: none* (GA-5 skipped it); the README context does
  not mention F-023 … F-026; a note on WingFoil's publish pipeline fits no W-entry, so the inbox test
  (`test/wingfoil-feedback.test.ts`, first-line rule) refuses it and it stays unfiled.

**T7 — Planning, budget and validation (v0.1 T8 recurred).**
- 8 active days planned (RP-8, raised from 5), 11 used; release validation took 3 days against 1
  planned (RV2-1 deviation) (RN effort table).
- The three validation rows have no working-time figure (RN effort table) — dl-006 action 6 only
  partly applied.
- Three governance tasks were added at validation (task-043, 044, 045); in v0.1 the
  governance tasks task-022 … 025 were added late too (RN *Implementation*; dl-006).
- RV2-3 planned to reuse the Wave 6 timing evidence; a change to a timed view after it made a re-run
  necessary (RS2-2).

**T8 — Publishing and release automation (new).**
- `0.2.0` published by hand, without provenance: no trusted publisher before a first version; the
  tag run's `promote` was rejected (RV2-4; `release-publishing-rel-v0.2-plan` Session 1).
- Unproven until v0.3's tag: OIDC trusted publisher, `npm stage publish`, the `npm-publish`
  approval, provenance (`docs/publishing.md` 0.4).
- Surprises the checklist did not foresee: E404 on an expired npm session; the `0.0.0-stage`
  placeholder that stays listed (`docs/publishing.md` 0.4).
- GitHub Release by hand (RS2-3; W6-1 had planned none); the coverage reports could not be attached
  (absolute local paths, dl-005) (`release-publishing-rel-v0.2-plan` Session 1).
- `release-publishing.yaml` 1.2 still says the pipeline "is planned for minor-v0.2" (its header).

**T9 — Dogfooding and test data (new).**
- Closing bugs from the console found bug-019 at once (ids over 100 characters; fixture ids are
  short); 8 of 12 decisions went through the action log (66.7 %), the other four were CLI approvals
  forced by bug-019 (`e2e-smoke-rel-v0.2-plan` ES2-1; bug-019 §Evidence).
- bug-016 was found by the approver using the console, not by a test (bug-016 §Evidence).

**T10 — Plan and document hygiene (v0.1 T9 partly fixed).**
- The public-text check (task-028) works: it flagged other tasks' notes and tests at integration
  (task-028 §integration).
- Plan frontmatter `version` differs from the Context `Version` in 2 of 7 plans:
  `release-submit-rel-v0.2-plan` (0.2 vs 0.3), `release-publishing-rel-v0.2-plan` (0.1 vs 0.2) —
  the rule of dl-006 action 6 is not enforced.

**T11 — Agents and coordination (v0.1 T7 improved).**
- Three interruptions recorded (2 h, a crash of ~10 min, a reboot), no loss (RN effort table);
  merge conflicts only on append-only and version lines (RP-43, RP-55; task Execution Notes
  §merge).
- The same `ConsoleOptions.settings` helper was written in three parallel tasks (038, 039, 041); a
  Vitest run rebuilt `web/dist` during an e2e run in a shared worktree (task-043 §deviation).

**T12 — What went well.**
- 17 planned tasks plus 3 test-only tasks, every gate green on the release tree: `test:coverage`
  3220 passed (96.56 % statements), e2e 935 on three engines at e2e-smoke, contract 263,
  local-security 251, smoke 4/4, publish-smoke 11/11, `test:timing` alone (RN *Submit &
  Publishing*).
- Design probes found defects before code (bug-013 a v0.1 hole, bug-014, bug-018, W-28) (task-033,
  task-034, task-043, task-032 §design); guard-removal checks recorded wherever a test passed first
  (at least 8 tasks).
- Three CI dry runs before the tag found three defects with no tag and no publish; the tag run's
  tarball was checked against the tag and the third dry run (`release-publishing-rel-v0.2-plan`).
- The governance pre-step (~1 h) removed v0.1 T4 and T5 before planning
  (`governance-alignment-rel-v0.2-plan`).
- Known limitations and declared residuals written into the user guide and CHANGELOG (UD2-4, UD2-5).

### Actions of the v0.1 records — status

| Action | Status | Source |
|--------|--------|--------|
| dl-006 1 — load-independent tests (temp convention + bug-008, fresh reads, `test:smoke` at every wave gate) | done; load-bound defects recurred (T2) | task-026; `dev-loop-rel-v0.2-plan` wave gates W0–W6 |
| dl-006 2, 3 — dl-007, dl-008 | done | `governance-alignment-rel-v0.2-plan`; `7af83f1`, `48017db` |
| dl-006 4 — public-text check | done | task-028 |
| dl-006 5 — spec-007 §1/§3/§6, spec-006 §1 | done at release-planning (RP-11), new differences open (UD2-7) | spec-007 *Process Notes* |
| dl-006 6 — adversarial reviewer who runs the tool | done (5 tasks); not for task-029 | T4 |
| dl-006 6 — per-phase actuals | partly: validation rows not recorded | T7 |
| dl-006 6 — plan `version` = header | not done: 2 of 7 plans drift | T10 |
| dl-006 6 — governance tasks at release-planning | partly: 026 … 029 planned, 043 … 045 added at validation | T7 |
| dl-007 — W-25, W-26, F-020 … F-022, `.wingfoil/README.md`, commits citing W-25 | done; no feedback sync yet | T6 |
| dl-008 — three workflows tailored | done; `release-publishing.yaml` header stale | T8 |

### Additional points — decisions (the approver: "as recommended", point 1 with a precondition)

- Step 3 — inventory, the status of the v0.1 actions and sixteen improvement points presented
  with options and one recommendation each; no further points from the approver.
- **RT2-6** — spin-off DL "governance alignment before v0.3" (T6, T8; points 1, 8, 10): a
  `governance-alignment` pre-step of `minor-v0.3` before its `release-planning`, as in v0.2. It
  starts only when WingFoil-Templates has published its `base` pack (the approver's precondition).
  Contents: the pin advances to WingFoil 0.3 only if the contract tests pass on 0.3; the `base`
  pack is adopted with dl-008's tailoring re-applied; directive `wingfoil-cli` is re-checked
  against 0.3, W-27 included (its wording fixed — placeholders named like elements — or the entry
  limited to 0.2.2 if 0.3 fixes the counter); the first-line rule of
  `test/wingfoil-feedback.test.ts` is widened to notes that report no CLI behaviour, the
  publish-pipeline note is filed as the next F-note and the first feedback sync is run; the stale
  header of `release-publishing.yaml` is corrected.
- **RT2-7** — spin-off DL "CI and environment checks in the dev loop" (T3, T10; points 3, 12): one
  `workflow_dispatch` run of `publish.yml` on `main` at every wave gate (`promote` is skipped on a
  dispatch), under a standing OK of the approver recorded in that DL; the strict-git wrappers of
  `test/README.md` *Git identity* in the self-check of every task that touches git; a newer local
  git is left to the approver. A v0.3 task adds a check that a plan's frontmatter `version` equals
  its Context `Version`.
- **RT2-8** — W4-16 (T4, point 2): the declared auto-update risk stays in v0.3 (off by default); a
  time-boxed design spike on a structural guard (fast-forward only when no incoming path is matched
  by a `.gitattributes` filter, diff or merge driver, or a temporary `info/attributes` override),
  with an adversarial probe; no new heuristic. If the spike does not converge, the declared risk
  stays.
- **RT2-9** — load (T2, point 4): bug-023 is fixed in v0.3; rule: no test starts more than one
  console in one test body; the slot stays as it is, and every heavy-gate log records the load and
  the slot wait.
- **RT2-10** — GitHub Release (T8, point 5): a governance task of v0.3 for the automatic `release`
  job after `promote`, attaching the coverage totals only.
- **RT2-11** — `test:timing` (T2, T7, point 6): run alone through the slot at every wave gate and at
  `pre-release-checks`, with no diff-based rule.
- **RT2-12** — bug `release` field (T6, point 7): the triage of a bug fixed in a later release sets
  `release`; absorption into a task stamps it; a v0.3 check flags closed bugs with an empty
  `release`. bug-018 gets `release: "v0.2"` at step 6 (a field, no state change).
- **RT2-13** — spec-007 §1/§3/§6 (T5, point 9, UD2-7): amended in `identify-specs` of the
  `release-planning` of `minor-v0.3`, as RP-11, not by a separate task.
- **RT2-14** — housekeeping at step 6, each with the approver's OK at that step (point 11): delete
  the merged `design/release-planning_v0.2`, `design/user-docs_v0.2`, `design/e2e-smoke_v0.2`
  locally and on `origin`, keep `design/inception_v1`; the npm placeholder `0.0.0-stage` is the
  approver's call (deprecate or leave); the unfiled feedback draft is removed once filed (RT2-6).
- **RT2-15** — plan versions (T10, point 12): the frontmatter `version` of
  `release-submit-rel-v0.2-plan` and `release-publishing-rel-v0.2-plan` aligned to their Context
  `Version` at step 6.
- **RT2-16** — process rules in the retrospective DL (T1, T7, T9, points 13, 14, 16): a checklist
  before every re-review (Version/Date line, wraps, ids and counts); release validation budgeted at
  2–3 active days, with tasks found at validation an expected category and working time recorded on
  validation days; a fixture element with a long id within bug-019's fix, and an action-log ratio
  target of 80 % in v0.3.
- **RT2-17** — v0.3 release-planning candidates (T4, T5, point 15): the typed `SafeToolMessage`,
  the key-rendering build, task-043's `opener.ts` follow-up, the ES2-3 gaps.
- **RT2-18** — records: the retrospective DL "Retrospective v0.2" (RT2-8 … RT2-17, the status of the
  v0.1 actions) and the two spin-off DLs of RT2-6 and RT2-7.

### Capture

- Step 4: `memory add` of dl-009 (retrospective, `76ef22b`), dl-010 (governance alignment before
  v0.3, RT2-6, `f56185f`) and dl-011 (CI runs and environment checks, RT2-7, `c350869`); bodies
  filled by editing the drafts. Independent read-only review, a fresh reviewer each round: round 1
  FAIL (3 major — wrong v0.1 validation facts, a wrong cause for the RS2-2 re-run, a rationale
  confusing `wingfoil_min` with the support matrix; 14 minor — rules and scope the approver had not
  chosen, unsourced counts, parts of RT2-9/RT2-11/RT2-13 dropped, an incomplete status of the v0.1
  actions); round 2 FAIL (1 major — a red contract said not to block the `base` pack, not decided;
  3 minor); round 3 FAIL (1 minor — v0.1's task-022 … task-024 called test-only); round 4 PASS (2
  nits, fixed). The conflict with the `$comment` of `contracts/matrix.json` (the matrix advances
  only through `release-planning`) is recorded in dl-010 as a deviation. This plan's header
  `Version` lagged its frontmatter after `8e448e2` (found by round 1) and is aligned.
