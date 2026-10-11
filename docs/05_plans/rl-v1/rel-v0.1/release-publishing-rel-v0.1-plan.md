---
id: release-publishing-rel-v0.1-plan
type: plan
title: "Release publishing rel-v0.1"
status: active
version: "0.1"         # optional — plan version
workflow: "release-publishing"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.2 · **Date:** 2026-10-11 (0.1: plan created; 0.2: Session 1 — timing, tag)
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

- **Approver:** the tag push (step 3); WFCoord told about the tag only with the approver's OK
  (RS-8); the plan finalization.
- **Agent:** timing retry, tag, hand transition, Execution Notes, Session log, commits, push.
- **Completion:** tag `v0.1.0` on `origin`, release `minor-v0.1` `released`, plan `done`. Next:
  `retrospective` of `minor-v0.1`, in a new session, from the inputs recorded below.

## Session log

### Session 1 — 2026-10-11

- Plan created (`eb1c0a3` add, `88fc010` submit → `active`).
- **Step 1 — `test:timing`** on `f830064` (20:40–20:42, load 1.6 → 5.8; source unchanged since
  `ac3b5b5`): **3/3 + 14/14 passed**. REQ-PERF-03 20/20 within 5 s (251–427 ms); REQ-PERF-06
  10/10 within 3 s (217–268 ms); TT-PERF-04 p95 (warm cache, 20 runs): Memory list 97, element
  panel 46, DNA 43, Directives 149, Team 58, Documentation 60 ms. Supersedes the skip recorded in
  `release-submit-rel-v0.1-plan` (load 18).
