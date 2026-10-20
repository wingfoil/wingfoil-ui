---
id: release-publishing-rel-v0.2-plan
type: plan
title: "Release publishing rel-v0.2"
status: active
version: "0.1"         # optional — plan version
workflow: "release-publishing"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-20 (0.1: plan created)
**Branch:** `main` (RV2-1; the tag is created on `main`)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`, v1.1) phase `publishing` = `release-publishing`
(`.wingfoil/workflows/custom/release-publishing.yaml` v1.2: `tag`, `publish`, `mark-released`)
**Roles:** tech-lead (tag, publish, mark-released), approver (the tag push, the `promote`
deployment, the npm publish, the registry setup, the GitHub Release) — Roberto Pompermaier holds
both; the agent creates the tag, follows the run, writes the hand transition, the Session log and
the GitHub Release on the approver's OK (no approval authority, no npm credential)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`releasing`, `116395d`);
`release-submit-rel-v0.2-plan` (`done`, `0febbdb`; decisions RS2-1 … RS2-4, approve-release on
2026-10-20); `docs/publishing.md` 0.3 (the pipeline, the approver checklist, *Every release*,
*GitHub Release*)
**Evidence:** `release-publishing-rel-v0.1-plan` (the v0.1 run of this phase, tag only, dl-004);
pre-release-checks green on `76570c5` (release-submit Session 2)

Why now: the approver approved the release for publishing (`release-submit` step 7);
`release-cycle` v1.1 runs `publishing` next, then `retrospective` (another session).

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `main` = `origin/main`; release `minor-v0.2` `releasing`; `release-submit-rel-v0.2-plan` `done`.
- The approver checklist of `docs/publishing.md` steps 1–3 done; step 4 → the first version by hand.

Produces: the annotated tag `v0.2.0` on `main`, pushed to `origin`; the tag run of `publish.yml`
(`gate`, `stage` green, `promote` rejected); `wingfoil-ui@0.2.0` live on npm (published by hand by
the approver from that run's tarball, no provenance); checklist steps 5–6 done; the GitHub Release
`v0.2.0`; release `minor-v0.2` `released`; the inputs for the retrospective.

## Phases / Steps

| # | Step (`release-publishing.yaml`) | Role | Output | Stop-check |
|---|----------------------------------|------|--------|------------|
| 1 | This plan (`add` + `submit`) | tech-lead | plan `active` | — |
| 2 | **tag** — pre: on `main`, release work on `main` (RV2-1, no release branch); only docs/governance files changed after the release commit `8b217b0`; `git tag -a v0.2.0 -m "WingFoil UI v0.2.0 — Unblock"` on `main` HEAD; the tag checks of `scripts/check-release-tag.mjs` run locally | tech-lead | local tag `v0.2.0` | `git diff --name-only 8b217b0 v0.2.0` has no source, test or package file; `check-release-tag.mjs v0.2.0 <sha>` passes |
| 3 | Push the tag: `git push origin v0.2.0` — starts `publish.yml` (RV2-8) | approver's OK, tech-lead | tag on `origin`; the tag run | the approver's separate OK |
| 4 | **publish** — the run's `gate` (tag checks, the repository gates, `npm pack`) and `stage` (`test:publish-smoke` on Node 22.12.0) green; the approver **rejects** the `promote` deployment (no trusted publisher yet, checklist step 4), downloads the run's `wingfoil-ui-tarball` artifact, checks its name and version, runs `npm publish wingfoil-ui-0.2.0.tgz --access public` with 2FA; then checklist step 5 (trusted publisher, stage only) and step 6 (2FA required, tokens disallowed). Post-check: `npm view wingfoil-ui@0.2.0 version` answers `0.2.0` | approver, tech-lead | `wingfoil-ui@0.2.0` live | `gate` and `stage` green; post-check |
| 5 | GitHub Release `v0.2.0` (RS2-3), on the approver's OK: `gh release create v0.2.0 --verify-tag --title v0.2.0`, notes = the CHANGELOG `[0.2.0]` section, assets = the published tarball and the coverage reports of the release tree's local run | tech-lead | the Release | the approver's OK |
| 6 | **mark-released**: hand transition (W-25) | tech-lead | `wf(release): minor-v0.2 [releasing → released]` | version live on npm |
| 7 | Execution Notes "Submit & Publishing" of `minor-v0.2`; inputs for the retrospective in the Session log; plan finalized (separate commit); push | tech-lead | plan `done` | — |

A failed `gate` or `stage` publishes nothing: fix on `main`; the approver decides whether `v0.2.0` is
tagged again on the fixed commit or a patch follows (`docs/publishing.md`, *Every release*).

## Handoff

- **Approver:** the tag push (step 3); the `promote` rejection, the npm publish with 2FA and
  checklist steps 5–6 (step 4); the OK for the GitHub Release (step 5); the plan finalization.
- **Agent:** the tag and its local checks, following the run, the post-check, the GitHub Release
  on the approver's OK, the hand transition, Execution Notes, Session log, commits, push. Never an
  npm command that writes to the registry, never a credential.
- **Completion:** tag `v0.2.0` on `origin`, `wingfoil-ui@0.2.0` live on npm, the GitHub Release,
  release `minor-v0.2` `released`, plan `done`. Next: `retrospective` of `minor-v0.2`, in a new
  session, from the inputs recorded below.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->
