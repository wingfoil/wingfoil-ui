---
id: release-publishing-rel-v0.1-plan
type: plan
title: "Release publishing rel-v0.1"
status: done
version: "0.1"         # optional — plan version
workflow: "release-publishing"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.5 · **Date:** 2026-10-11 (0.1: plan created; 0.2: Session 1 — timing, tag; 0.3: tag pushed,
released, retrospective inputs; 0.4: review nits; 0.5: dl-005 neutral wording)
**Branch:** `main` (RV-1; the tag is created on `main`, WingFoil dl-024)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`, v1.1) phase `publishing` = `release-publishing`
(`.wingfoil/workflows/custom/release-publishing.yaml` v1.1)
**Roles:** tech-lead (tag, publish, mark-released), approver (the tag push, the publish approval)
— Roberto Pompermaier holds both; the agent creates the tag, writes the hand transition and the
Session log (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md` (`releasing`);
`release-submit-rel-v0.1-plan` (`done`, `c8201b7`; decisions RS-1 … RS-8, approve-release on
2026-10-11); `dl-004-npm-publishing-deferred-for-v0.1` (`ready`, `f830064`)

Why now: the approver approved the release for publishing (`release-submit`, step 7);
`release-cycle` v1.1 runs `publishing` next, then `retrospective` (another session).

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `main` = `origin/main`; release `minor-v0.1` `releasing`; `release-submit-rel-v0.1-plan` `done`.

Produces: the annotated tag `v0.1.0` on `main`, pushed to `origin`; the `publish` step skipped by
dl-004; release `minor-v0.1` `released`; the inputs for the retrospective.

## Phases / Steps

| # | Step (`release-publishing.yaml`) | Role | Output | Stop-check |
|---|----------------------------------|------|--------|------------|
| 1 | This plan (`add` + `submit`); `test:timing` retried (RV-6: before the tag) | tech-lead, qa | plan `active`; timing result | load below 12, else recorded as skipped |
| 2 | **tag** — pre: on `main`, release work merged to `main` (met: RV-1, no release branch). The workflow's `git.commit("release {version}")` is the release commit `ac3b5b5` made in `release-submit` (RS-3); check that only docs/governance files changed after it; `git tag -a v0.1.0 -m "WingFoil UI v0.1.0 — Read-only console"` on `main` HEAD | tech-lead | local tag `v0.1.0` | `git diff --name-only ac3b5b5 v0.1.0` has no source, test or package file |
| 3 | Push the tag: `git push origin v0.1.0` | approver's OK, tech-lead | tag on `origin` | the approver's separate OK |
| 4 | **publish** — skipped (dl-004): no `publish.yml`, no npm stage, no npm approval; post-check "staged version approved on npm and live" not applicable; no GitHub Release (RS-7) | tech-lead | skip recorded | dl-004 `ready` |
| 5 | **mark-released**: hand transition (no verb) | tech-lead | `wf(release): minor-v0.1 [releasing → released]` | tag pushed |
| 6 | Execution Notes "Submit & Publishing" of `minor-v0.1`; retrospective inputs below; plan finalized (separate commit); push | tech-lead | plan `done` | — |

## Handoff

- **Approver:** the tag push (step 3); the cross-project requester told about the tag only with the
  approver's OK (RS-8); the plan finalization.
- **Agent:** timing retry, tag, hand transition, Execution Notes, Session log, commits, push.
- **Completion:** tag `v0.1.0` on `origin`, release `minor-v0.1` `released`, plan `done`. Next:
  `retrospective` of `minor-v0.1`, in a new session, from the inputs recorded below.

## Session log

### Session 1 — 2026-10-11

- Plan created (`eb1c0a3` add, `88fc010` submit → `active`).
- **Step 1 — `test:timing`** started on `f830064` (20:40–20:42, load 1.6 → 5.8; only plan and
  governance commits landed during the run; source unchanged since `ac3b5b5`): **3/3 + 14/14
  passed**. REQ-PERF-03 20/20 within 5 s (251–427 ms); REQ-PERF-06 10/10 within 3 s (217–268 ms);
  TypeDoc build 2535 ms; S-27.2 DNA view recovered in 422 ms (`@live-refresh`); TT-PERF-04 p95 (warm cache, 20 runs): Memory list 97, element
  panel 46, DNA 43, Directives 149, Team 58, Documentation 60 ms. Supersedes the skip recorded in
  `release-submit-rel-v0.1-plan` (load 18).
- **Step 2 — tag:** `v0.1.0` for release `v0.1` (RV-7; the workflow's `{release.version}` would
  give `v0.1`); on `main`, release work on `main` (RV-1); `git diff --name-only ac3b5b5 HEAD`
  = dl-004, `minor-v0.1.md`, the two `release-*` plans, `docs/user-guide.md` (no source, test or
  package file). `git tag -a v0.1.0 -m "WingFoil UI v0.1.0 — Read-only console"` on `545d56c`
  (tag object `8a6e859`).
- **Step 3 — tag push:** the approver's OK in chat (push the tag, inform the cross-project
  requester, proceed); `git push origin v0.1.0` → `refs/tags/v0.1.0` on `origin`
  (`git ls-remote`). The cross-project requester informed (informational message).
- **Step 4 — publish:** skipped by dl-004 (`ready`, `f830064`): no `publish.yml` run, no npm stage
  or approval, post-check not applicable; no GitHub Release (RS-7).
- **Step 5 — mark-released:** `0f54194` `wf(release): minor-v0.1 [releasing → released]` (hand
  transition); `check_releases.py` OK.
- **Step 6:** Execution Notes "Submit & Publishing" of `minor-v0.1` completed; plan finalized
  (separate commit).

### Inputs for the retrospective of `minor-v0.1`

Raw material, gathered at the end of `publishing`; the retrospective decides what to keep.

- **Where the record is:** `minor-v0.1.md` Execution Notes (planning → publishing); the six plans
  of `docs/05_plans/rl-v1/rel-v0.1/` (Session logs, decisions W*, RV-*, UD-*, ES-*, RS-*); task
  and bug Execution Notes (`docs/04_memory/v0.1/`, `docs/04_memory/bugs/`); `docs/wingfoil-feedback/`;
  directive `wingfoil-cli` *Known behaviours*.
- **Accepted deviations of v0.1:** `docs/examples/` N/A (UD-5); task-025 as a governance task
  outside the backlog (ES-5), like 022–024; npm `publish` step skipped (dl-004); element panel
  non-modal (W4-8); no code split, entry ≈ 709 kB (W5-8); e2e on Chromium only (TT-INT-08);
  TT-ARC-07 moved to v0.3; bug-004 re-check partly below load 15; several e2e specs and fixture
  tests written after the code (W1, W3); AC-1/AC-3 of task-025 reworded at design.
- **Known limitations shipped** (user guide, CHANGELOG): bug-006's two edge cases, a killed clone
  leaves its folder, header R9 (W5-16), Windows tested with mocks only (spec-007 §7 manual check
  open), no cap on event streams, full git walk (spec-002 §4 → v0.2), React Aria "Dismiss"
  (W5-1), bug-008 (temp hooks folder on a kill; v0.2).
- **Work after v0.1:** spec-007 §1/§3/§6 and spec-006 §1 amendments to match the code (UD-7);
  bug-008 (v0.2); the npm publishing pipeline and `private: true` removal (dl-004 Actions); the
  `wingfoil-sync` procedure and `.wingfoil/` alignment with WingFoil-Templates (RV-10); merged
  local `design/*` branches and `/tmp/wfui-*` folders left in place (RS-8).
- **Observations from submit/publishing:** the release commit is made in `submit` (before the
  checks) although `release-publishing.yaml` places `git.commit("release …")` in `tag`; the
  bug check `bugs where tags=[…]` does not match this project's bugs (no `tags`; `release` /
  `release-origin` used instead); release `in-development → releasing → released` and
  approve-release have no verb (hand commits, OK in chat); `test:timing` depends on machine load
  (skipped at 18:56 at load 18, green at 20:40 at load 1.6); the plan of submit cited a wrong
  script path, caught only by the independent review; the tag is `{release.version}` in the
  workflow (`v0.1`) but `v0.1.0` by RV-7; the `publish` phase cites WingFoil-only artefacts
  absent here (`.github/workflows/publish.yml`, adr-011, spec-015, dl-087, dl-024) — input for
  tailoring the workflow (`wingfoil-sync`); hand transitions of release states (`df09286`,
  `677efa7`, `0f54194`) rest on the `memory.yaml` comment, with no `wingfoil-cli` W-entry
  (`df09286` cites W-04, which is about plans).
- **Process lessons recorded by earlier phases:** Vitest's `NODE_ENV=test` reaching `prepack`
  (task-025); concurrent suites racing on `web/dist`; agents interrupted by usage limits and
  resumed from commits; rules file for agents in `.notes/dev-rules.md` (git-ignored, RV-9);
  messages from other sessions deferred to phase boundaries (RV-10).
