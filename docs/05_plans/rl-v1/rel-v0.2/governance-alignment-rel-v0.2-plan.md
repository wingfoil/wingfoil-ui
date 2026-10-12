---
id: governance-alignment-rel-v0.2-plan
type: plan
title: "Governance alignment rel-v0.2"
status: active
version: "0.1"         # optional — plan version
workflow: "governance-alignment"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-12 (0.1: plan created, checkpoint decisions GA-1…GA-5)
**Branch:** `main` (GA-1)
**Workflow:** none — an ad-hoc plan (GA-2). `workflows.yaml` has no workflow for this alignment;
`governance-alignment` is the plan's `workflow` token only. Its outcome is an input of the
`reconcile-governance` phase of `release-planning` for `minor-v0.2`
(`.wingfoil/workflows/custom/release-planning.yaml` v1.4).
**Roles:** tech-lead (the agent: edits, notes, reviews coordination), approver (checkpoint
decisions, OK on the result) — Roberto Pompermaier is the approver; the agent has no approval
authority.
**Input:** dl-007 and dl-008 (`docs/04_memory/design/dls/`, both `ready`); dl-006 Actions;
`retrospective-rel-v0.1-plan` decisions RT-6, RT-9 and RV-10 of `user-docs-rel-v0.1-plan`;
directive `wingfoil-cli` 1.6; `docs/wingfoil-feedback/`; the WingFoil repository
`wingfoil/wingfoil` at tag `v0.2.2` (GA-3).

Why now: the retrospective of `minor-v0.1` is done (`retrospective-rel-v0.1-plan` `done`,
`dfa7246`); dl-007 and dl-008 are due before `release-planning` of `minor-v0.2`, and RT-6 places
the `.wingfoil/` alignment right after the retrospective.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`;
  `npm view wingfoil versions` lists `0.2.1`, `0.2.2` (2026-10-12): the pin does not advance.
- `main` = `origin/main` = `dfa7246`; release `minor-v0.1` `released`; every plan of `rel-v0.1`
  `done`.

Produces: directive `wingfoil-cli` with the W-entries of dl-007; feedback notes for the release
and bug hand transitions and for W-22 and W-23; the three workflows of dl-008 tailored; the
`.wingfoil/` base re-stated as `wingfoil/wingfoil@v0.2.2`; the skipped feedback sync recorded;
`.wingfoil/README.md` aligned. All `.wingfoil/` changes are committed before any later CLI verb
(directive `wingfoil-cli` W-24).

## Phases / Steps

| # | Step | Role | Output | Stop-check |
|---|------|------|--------|------------|
| 1 | This plan (`add` + `submit`) | tech-lead | plan `active` | — |
| 2 | **dl-007** — W-entries for the release-state hand transitions with approve-release, and for the bug hand transitions; listed in `.wingfoil/README.md` beside W-04 and W-20; feedback notes for those transitions, W-22 and W-23, each reproduced with `wingfoil@0.2.2` alone, added to the ledger | tech-lead | directive `wingfoil-cli` 1.7; new notes | every new entry names its commit form and deciding role; every note has command, output, version |
| 3 | **dl-008** — tailor `release-publishing.yaml`, `release-submit.yaml`, `retrospective.yaml` (version bump each); drop the stale "TODO before the first release-cycle" in `workflows.yaml` | tech-lead | three workflows tailored | no reference to an artefact absent from this repository; `workflow list` loads them |
| 4 | **Template alignment** — compare `.wingfoil/` with `wingfoil/wingfoil@v0.2.2` (GA-3); re-state the base in the "derived from" headers; record what is not adopted | tech-lead | headers and notes | each file's upstream difference is adopted or recorded as not adopted |
| 5 | **Feedback sync skipped** (GA-5) — `Last sync:` note in `docs/wingfoil-feedback/README.md` | tech-lead | note | — |
| 6 | Independent fresh-context read-only review of steps 2–5 until PASS (nothing above nit); re-read the whole changed file after every fix | reviewer (agent) | PASS | review PASS |
| 7 | Approver's OK on the result; commits per step; push; plan finalized (separate commit) | approver, tech-lead | plan `done` | the approver's OK in chat |

## Handoff

- **Approver:** the checkpoint decisions (GA-1…GA-5, given); the OK on the reviewed result
  (step 7). No `memory approve` is needed: the plan has no gate (W-04) and directives, workflows
  and feedback notes are not Memory elements.
- **Agent:** reproductions, edits, review coordination, Session log, commits, push.
- **Completion:** plan `done`. Next: `release-cycle` phase `release-planning` for `minor-v0.2`
  (plan `release-planning-rel-v0.2-plan`), whose `reconcile-governance` phase cites this plan and
  whose `define-scope` phase takes GA-4.

## Session log

### Session 1 — 2026-10-12

Decisions (checkpoint, the approver: "as recommended", after two corrections):

- **GA-1** — branch `main`, as for the release phases of `minor-v0.1` (RV-1, RT-1).
- **GA-2** — this alignment is an ad-hoc plan, closed before `release-planning`; its
  `reconcile-governance` phase cites it as done.
- **GA-3** — the base for the template alignment is the WingFoil release this project pins,
  `wingfoil/wingfoil@v0.2.2`, not WingFoil's current `main`: changes made on WingFoil's `main`
  after `v0.2.2` target WingFoil 0.3 and are reviewed when the pin advances to 0.3, each project
  adopting what fits it. The previously declared base `c43221c4` (2026-10-01) is a `main` commit
  after `v0.2.2` (2026-09-29); between the two, `.wingfoil/` differs in two files only
  (`git diff --stat v0.2.2 c43221c4 -- .wingfoil` in `wingfoil/wingfoil`: `memory.yaml`,
  `directives/custom/command-baseline.md`).
- **GA-4** — npm publishing of `wingfoil-ui` is in the scope of `minor-v0.2`: the sequencer's Q1
  (`docs/01_vision/07_sequencer.md`) publishes the package from the first releases as `0.x`, and
  dl-004 deferred it from v0.1 to "a later release" (dl-004 Actions). Recorded here for
  `release-planning` `define-scope`.
- **GA-5** — the feedback sync (directive `wingfoil-cli` rule 7) is skipped for this
  `release-planning`: WingFoil has not defined the procedure yet (task-023 Implementation Notes).
  No note status is changed.

Steps:

- Step 1: plan created (`d72f8dc` add).
