---
id: release-publishing-rel-v0.2-plan
type: plan
title: "Release publishing rel-v0.2"
status: done
version: "0.2"         # optional — plan version
workflow: "release-publishing"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.2 · **Date:** 2026-10-21 (0.1: plan created; 0.2: Session 1 log — tag, the tag run, the first version by hand, the GitHub Release, released; inputs for the retrospective)
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

### Session 1 — 2026-10-20 – 2026-10-21

- Plan created (`fd1fb22` add, `64e9420` submit → `active`); `main` pushed so that the tag's commit
  is on `origin/main` (the gate's check 4).
- **Step 2 — tag:** `git diff --name-only 8b217b0 HEAD` = `CLAUDE.md`, `minor-v0.2.md`, the two
  `release-*` plans, `docs/cli-reference.md`, `docs/publishing.md`, `docs/user-guide.md` (no
  source, test or package file). `git tag -a v0.2.0 -m "WingFoil UI v0.2.0 — Unblock"` on `64e9420`
  (tag object `3bd4851`); `node scripts/check-release-tag.mjs v0.2.0 <sha>`: the four checks ok.
- **Step 3 — tag push:** the approver's OK in chat ("procedi con il push del tag");
  `git push origin v0.2.0` → `refs/tags/v0.2.0` on `origin` (`git ls-remote`).
- **Step 4 — publish:** tag run `39497286374`: `gate` (tag checks, gates, `npm pack`) and `stage`
  (`test:publish-smoke`, Node 22.12.0) green; `promote` waited on `npm-publish` and was **rejected**
  by the approver (the run ends `failure`, nothing staged). The agent downloaded the
  `wingfoil-ui-tarball` artifact at the approver's request: `wingfoil-ui-0.2.0.tgz`, 586 837 bytes,
  integrity
  `sha512-DV23ATWQGkaFNQZaCoAQAh6VJ1Zm+zFcUU8fNSGWfH/WTwcBaRlzbxPPPvCPEjQJ03gIc8PzK48OVbKpLEhPMw==`;
  `package.json` `wingfoil-ui` `0.2.0`, not private; 145 files within `files`, no source, test or
  `.wingfoil/` file, the bin mode 755; README, CHANGELOG, LICENSE, the message catalogue, the
  contracts' `matrix.json` and `capabilities.json` and the bin byte-equal to the tag's; the same
  file list and built files as the third dry run's tarball (only `package.json`, README, CHANGELOG
  differ). The approver's `npm publish <tarball> --access public`: first `E404` on the PUT (the npm
  session in the user config had expired; nothing published), then, after `npm login`, `+
  wingfoil-ui@0.2.0` with "Your package is being processed". For under three minutes the registry
  listed only `0.0.0-stage` ("Temporary package placeholder for staged publishing") as `latest`;
  `0.2.0` was listed at 21:19:56Z and became `latest`. Post-check: `npm view wingfoil-ui@0.2.0
  version` → `0.2.0`, `dist.integrity` = the artifact's, 145 files, no attestation (no provenance,
  as planned); `npm install wingfoil-ui@0.2.0` in an empty folder resolves it from
  `registry.npmjs.org` with that integrity and `npx --no -- wingfoil-ui --version` prints `0.2.0`.
  The approver then did checklist steps 5 (trusted publisher `wingfoil/wingfoil-ui`, `publish.yml`,
  `npm-publish`, stage only) and 6 (2FA required, tokens disallowed), reported in chat.
- **Step 5 — GitHub Release** (RS2-3), on the approver's OK ("procedi con la GitHub Release"): `gh
  release create v0.2.0 --verify-tag --title v0.2.0 --latest`; notes = a preface (the hand publish,
  the tag run, the local test results) and the CHANGELOG `[0.2.0]` section with its relative links
  made absolute to the tag; assets `wingfoil-ui-0.2.0.tgz` (the published tarball),
  `coverage-summary.json` (the totals of `test:coverage` on `76570c5`) and `test-results.md` (the
  pre-release checks). Not attached: `coverage-final.json`, `clover.xml` — they hold 183 absolute
  local paths (dl-005). The Release is the repository's latest; it started no Actions run. Deviation
  from step 5 as planned: `--latest` added, a preface before the CHANGELOG section, and only the
  coverage totals instead of the full coverage reports (dl-005).
- `docs/publishing.md` 0.4 (`48a2ac7`, the approver's request): the npm session check, the
  processing of a first publish and its `0.0.0-stage` placeholder, the post-check, checklist steps
  4–6 done, the GitHub Release's assets.
- **Step 6 — mark-released:** `dc4feac` `wf(release): minor-v0.2 [releasing → released]` (hand
  transition, W-25); `check_releases.py` OK.
- **Step 7:** Execution Notes "Submit & Publishing" of `minor-v0.2` completed (effort row of the
  11th active day); plan finalized (separate commit).

### Inputs for the retrospective of `minor-v0.2`

Raw material, gathered at the end of `publishing`; the retrospective decides what to keep.

- **Where the record is:** `minor-v0.2.md` Execution Notes (planning → publishing, effort table);
  the eight plans of `docs/05_plans/rl-v1/rel-v0.2/` (decisions RP-*, W0-* … W6-*, RV2-*, UD2-*,
  ES2-*, RS2-*); task and bug Execution Notes (`docs/04_memory/v0.2/`, `docs/04_memory/bugs/`);
  `docs/wingfoil-feedback/`; directive `wingfoil-cli` *Known behaviours*.
- **Budget:** 8 active days planned (RP-8), 11 used — Wave 6 on the 8th, release validation on the
  9th–11th (RV2-1 deviation, accepted by the approver).
- **Already recorded for the retrospective:** `e2e-smoke-rel-v0.2-plan` *For the retrospective*
  (the base-pack adoption before the v0.3 release-planning; W-27 placeholders named like elements;
  bug-019 found by dogfooding — a long-id fixture element; the `opener.ts` follow-up of task-043);
  `dev-loop-rel-v0.2-plan` Session 7 follow-ups and W4-16 (the declared Auto-update risk vs a
  structural fix); UD2-5 and UD2-7 (spec-007 amendments, the Wave 6 follow-ups); ES2-3 (accepted
  e2e-smoke gaps).
- **The first CI run of the repository** found three test-suite defects invisible locally
  (bug-020 the OS account's name, bug-021 git ≥ 2.48 `origin/HEAD`, bug-022 git 2.55 wording): the
  local git is 2.43, the runner's 2.55. Options: a CI run per task or wave (cost), a newer local
  git, the strict-identity wrappers of `test/README.md`. The machine-free slot checks the load only
  at its start (bug-023, fix in v0.3).
- **Publishing:** the npm pipeline's `promote`, trusted publisher and provenance are still
  unproven — first exercised by v0.3's tag. The first hand publish showed two things the checklist
  did not foresee (an expired npm session answers 404; the `0.0.0-stage` placeholder, which stays
  in the version list — the approver may deprecate it); `docs/publishing.md` 0.4 records them.
- **GitHub Release:** made by hand for `v0.2.0` (RS2-3); a governance task of v0.3 for WingFoil's
  automatic `release` job (after `promote`, once the version is live; the gate's test reports —
  needs test reporters in `gate`, `changelog-section` and `wait-npm-version` scripts, the
  `publish-workflow` test invariants). The local coverage reports cannot be published (absolute
  paths).
- **`test:timing` evidence:** RV2-3 planned to reuse the Wave 6 runs; a change to a timed view
  (Today, task-043) after them made a re-run on the release tree necessary (RS2-2) — a rule
  candidate: re-run timing when `git diff` since the timing evidence touches a timed path.
- **Bug fields:** bug-019 and bug-023, found in v0.2 and fixed in v0.3, had an empty `release` and
  would have failed the bug check of `release-submit` 1.1; the triage of a bug planned for a later
  release should set `release` (RS2-4).
- **Approver exceptions:** a mistaken reject of bug-016 removed with `git reset --keep` before any
  push (e2e-smoke); AC-3 of task-045 proved by CI instead of a local coverage run (release-submit
  Session 1).
- **Review effort:** task-040 took 5 independent + 5 adversarial rounds (its Execution Notes; the
  security rounds kept finding new tool-sourced string fields); the release commit's review took 3
  rounds, two of them for wrap and Version-line slips introduced by the fixes themselves.
- **WingFoil feedback:** the publish-pipeline note drafted outside the repository (it fits no
  `wingfoil-cli` W-entry, so the inbox test refuses it) needs a way to be filed.
- **Housekeeping left for the retrospective:** merged local `design/*` branches of v0.2
  (`release-planning_v0.2`, `user-docs_v0.2`, `e2e-smoke_v0.2`); the npm placeholder `0.0.0-stage`.

