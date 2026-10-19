---
id: release-submit-rel-v0.2-plan
type: plan
title: "Release submit rel-v0.2"
status: active
version: "0.1"         # optional — plan version
workflow: "release-submit"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-19 (0.1: plan created; pre-step — registry checklist, the first dry run, task-044)
**Branch:** `main` (RV2-1: `submit` and `publishing` work on `main`, no design branch)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`, v1.1) phase `submit` = `release-submit` (`.wingfoil/workflows/custom/release-submit.yaml`
v1.1: `release-commit`, `pre-release-checks`, `enter-releasing`, `approve-release`)
**Roles:** tech-lead (release-commit, enter-releasing), qa (pre-release-checks), approver
(approve-release) — Roberto Pompermaier holds all of them; the agent writes the release commit and
the hand transition, runs the suites and the independent review (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`in-development`);
`dev-loop-rel-v0.2-plan` (`done`, `e692674`); `user-docs-rel-v0.2-plan` (`done`, merge `5a53911`;
RV2-1 … RV2-8, UD2-1 … UD2-8 and the hand-over to `release-submit`); `e2e-smoke-rel-v0.2-plan` (`done`,
merge `08a84db`; ES2-1 … ES2-4, smoke green on `b286ab9`, bugs closed, bug-019 for v0.3);
`docs/publishing.md` (the approver's checklist, *Every release*)
**Evidence:** `release-submit-rel-v0.1-plan` (RS-1 … RS-8); the previous session's handoff

Why now: `implementation`, `user-docs` and `e2e-smoke` are done and merged; `release-cycle` v1.1 runs
`submit` next, then `publishing` (plan `release-publishing-rel-v0.2-plan`, same session, RV2-1).

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `main` = `origin/main`; the previous plans of `rel-v0.2` are `done`.
- The approver's registry checklist done (RV2-4) and a green `workflow_dispatch` dry run on `main`
  (RV2-5) — see *Pre-step* below.

Produces: the release commit `chore(release): v0.2.0` on `main`; the Execution Notes of
`minor-v0.2`; the pre-release-checks report on the release commit; release `minor-v0.2`
`releasing`; the approver's approval to publish.

## Phases / Steps

### Pre-step (2026-10-19): registry checklist, the first dry run

- **Registry checklist** (`docs/publishing.md`, RV2-4), reported by the approver on 2026-10-19:
  step 1 (`wingfoil-ui` free on the registry), step 2 (2FA, authorization and writes) and step 3
  (GitHub environment `npm-publish`, the approver as required reviewer, tags `v*`) done; step 4 —
  a trusted publisher **cannot** be configured for a name with no version yet. Consequence (the
  checklist's own branch): the first version `0.2.0` is published **by hand** by the approver, with
  2FA, from the `wingfoil-ui-tarball` artifact of the tag run (gate + stage green), after rejecting
  that run's `promote` deployment; steps 5 (trusted publisher, stage only) and 6 (2FA, tokens
  disallowed) right after; no token at any time; that one version has no provenance.
- **First dry run** (RV2-5, on the approver's OK): `gh workflow run publish.yml --ref main` on
  `08a84db` → run `39315562583`: job `gate` failed at *Tests with coverage* (61 tests in 7 files,
  "Author identity unknown": the test harness sets no `user.name` and the runner's account has no
  full name); `stage`, `promote` skipped. Install, typecheck, lint and format passed on the runner.
  → bug-020 (ingested `4e15e49`/`a4da2c7`, triaged low by the approver `b1dd18f`) absorbed into the
  test-only governance task **task-044** (`d784898`, `fd82469`, approved `624cef6`, `in-progress`
  `aca0dcb`), through `dev-loop`; merged to `main`; then a second dry run on the approver's OK.

### Steps

| # | Step (`release-submit.yaml`) | Role | Output | Stop-check |
|---|------------------------------|------|--------|------------|
| 1 | This plan (`add` + `submit`); pre-step above | tech-lead | plan `active`; task-044 `done`; a green dry run on `main` | the dry run's `gate` and `stage` green |
| 2 | Execution Notes of `minor-v0.2` — "Implementation" closing bullet, "User docs", "E2E smoke", "Submit & Publishing" so far (what happened, not lessons); effort table rows of release validation | tech-lead | `docs(release)` commit | review step 4 |
| 3 | **release-commit:** version `0.2.0` in the root, `contracts`, `server`, `web` `package.json` and `package-lock.json` (`npm version 0.2.0 --no-git-tag-version --workspaces --include-workspace-root`); CHANGELOG `[Unreleased]` → `[0.2.0] - <tag date>` with its links; the user-docs hand-over (README status and install, user guide introduction, `CLAUDE.md` project status as released, RS-5 of v0.1); Version/Date headers | tech-lead | `chore(release): v0.2.0` commit | review step 4 |
| 4 | Independent fresh-context read-only review of steps 2–3, repeated until PASS (nothing above nit) | reviewer | review report | PASS |
| 5 | **pre-release-checks** on the release commit, in series through the machine-free slot (RV2-3): tasks (`check_tasks.py v0.2`, task-026 … task-044 `done`); bugs of `v0.2` (`release` `v0.2`, or empty with `release-origin` `v0.2`) `resolved`/`closed` — bug-019 (`triaged`, fix in v0.3) is a known limitation (approver, 2026-10-19); `check_releases.py`; `tests.passing`: `typecheck`, `lint`, `format:check`, `docs:api`, `test:contract`, `test:e2e:chromium`, `test:smoke` and `test:publish-smoke` (the installed package prints `0.2.0`), `test:timing` evidence per RV2-3; `tests.coverage(min: 80)`: `test:coverage`; `npm audit --omit=dev` 0 and the full audit against the accepted list (RV2-7) | qa | report in Session log | every check green |
| 6 | **enter-releasing:** hand transition (W-25) | tech-lead | `wf(release): minor-v0.2 [in-development → releasing]` | — |
| 7 | **approve-release:** the approver's explicit OK in chat, recorded in the Session log (W-25) | approver | approval recorded | the approver's OK |
| 8 | Plan finalized (separate commit), push | tech-lead | plan `done` | — |

Never run `test`/`test:coverage`, `test:e2e`, `test:smoke` or `test:publish-smoke` concurrently in
one checkout (they rebuild `dist`).

## Handoff

- **Approver:** the approvals of task-044 and bug-020, the OK for each dry run, the approval of the
  release (step 7), the plan finalization.
- **Agent:** task-044 through a developer agent and independent reviews, the dry runs on the
  approver's OK, Execution Notes, release commit, suites, independent review, hand transition,
  Session log, commits, push.
- **Completion:** release `minor-v0.2` `releasing` with every pre-release check green on the release
  commit and the approver's OK recorded; plan `done`. Next: `publishing`
  (`release-publishing-rel-v0.2-plan`): tag `v0.2.0`, the tag run, the first publish by hand.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->
