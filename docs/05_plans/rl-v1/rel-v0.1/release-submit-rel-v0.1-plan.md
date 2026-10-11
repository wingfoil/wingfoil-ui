---
id: release-submit-rel-v0.1-plan
type: plan
title: "Release submit rel-v0.1"
status: active
version: "0.1"         # optional — plan version
workflow: "release-submit"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-11 (0.1: plan created)
**Branch:** `main` (RV-1: `submit` and `publishing` work on `main`, no design branch)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`, v1.1) phase `submit` = `release-submit` (`.wingfoil/workflows/custom/release-submit.yaml`
v1.0)
**Roles:** qa (pre-release-checks), tech-lead (enter-releasing), approver (approve-release) —
Roberto Pompermaier holds all of them; the agent runs the suites, writes the release commit and
the hand transition, and runs the independent review (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md` (`in-development`);
`dev-loop-rel-v0.1-plan` (`done`, `946ca4b`); `user-docs-rel-v0.1-plan` (`done`, merge `3a74e9c`,
decisions RV-1…RV-10, UD-1…UD-10); `e2e-smoke-rel-v0.1-plan` (`done`, merge `a33fca7`, decisions
ES-1…ES-17, first green run of the staged gate on `0d719fe`)
**Evidence:** handoff of session "WFUI v0.1 - 10. user-docs+e2e-smoke" (2026-10-11)

Why now: `implementation`, `user-docs` and `e2e-smoke` are done and merged; `release-cycle` v1.1
runs `submit` next, then `publishing` (plan `release-publishing-rel-v0.1-plan`), then
`retrospective` (another session).

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `main` = `origin/main`; the three previous plans of `rel-v0.1` are `done`.

Produces: the release commit `chore(release): v0.1.0` on `main` (version, CHANGELOG date, known
limitations, project status); the Execution Notes of `minor-v0.1`; the pre-release-checks report
on the release commit; release `minor-v0.1` `releasing`; the approver's approval to publish.

## Phases / Steps

| # | Step (`release-submit.yaml`) | Role | Output | Stop-check |
|---|------------------------------|------|--------|------------|
| 1 | This plan (`add` + `submit`) | qa | plan `active` | — |
| 2 | Execution Notes of `minor-v0.1` — "Implementation", "User docs", "E2E smoke" (what happened, not lessons) | tech-lead | `docs(release)` commit | review step 4 |
| 3 | Release commit: version `0.1.0` in the root, `contracts`, `server`, `web` `package.json` and `package-lock.json` (`private: true` unchanged, RV-8); CHANGELOG `[0.1.0]` date; bug-008 in the known limitations of the user guide and the CHANGELOG (UD-4); `CLAUDE.md` project status (UD-3); Version/Date headers | tech-lead | `chore(release): v0.1.0` commit | review step 4 |
| 4 | Independent fresh-context read-only review of steps 2–3, repeated until PASS | reviewer | review report | PASS (nothing above nit) |
| 5 | **pre-release-checks** on the release commit, sequential, in background, without switching branch | qa | report in Session log | every check green |
| 6 | **enter-releasing**: hand transition (no verb; release states are `waiting` after `planning`) | tech-lead | `wf(release): minor-v0.1 [in-development → releasing]` | — |
| 7 | **approve-release**: the approver's explicit OK in chat, recorded in the Session log (no CLI gate) | approver | approval recorded | approver's OK |
| 8 | Plan finalized (separate commit), push | tech-lead | plan `done` | — |

### pre-release-checks mapping

| Check (`release-submit.yaml`) | How |
|-------------------------------|-----|
| all tasks tagged `v0.1` `done` | `python3 .wingfoil/scripts/check_tasks.py` + status of task-001…025 |
| all bugs tagged `v0.1` `resolved`/`closed` | status of bug-001…007 (bug-008 is tagged `v0.2`) + `check_releases.py` |
| `tests.passing` | `typecheck`, `lint`, `format:check`, `test:e2e`, `test:smoke` (prints `0.1.0`), `test:contract`, local-security, accessibility, `docs:api`; `test:timing` only if the 1-minute load is below 12, else recorded as skipped (the run on `946ca4b` stands) |
| `tests.coverage(min: 80)` | `npm run test:coverage` |

Never run `test`/`test:coverage`, `test:e2e` and `test:smoke` concurrently in one checkout (they
rebuild `web/dist`).

### Decisions taken at the start (2026-10-11, approver: "tutto come consigliato")

- RS-1 Two plans, one per phase: this one and `release-publishing-rel-v0.1-plan`.
- RS-2 Work on `main` (RV-1); dl-024's "release branch merged to main" is met trivially.
- RS-3 Commit order: plan → Execution Notes → release commit → review → pre-release-checks →
  `releasing` → approval → finalize; push after each state commit.
- RS-4 The CHANGELOG `[0.1.0]` date is the tag date (2026-10-11 if tagged today).
- RS-5 The release commit already states the final project status in `CLAUDE.md` (released as tag
  `v0.1.0`), so the tagged tree describes itself.
- RS-6 approve-release = the approver's explicit OK in chat, recorded in the Session log.
- RS-7 (for `publishing`) dl-004 records the skipped npm step (RV-8); tag `v0.1.0` annotated on
  `main` HEAD at the tag step, after checking that only governance/docs files changed since the
  gated release commit; push of the tag on a separate OK; no GitHub Release; mark-released by hand.
- RS-8 Retrospective inputs in the publishing plan's Session log; WFCoord told about the tag only
  after its push and with the approver's OK; merged local `design/*` branches and `/tmp/wfui-*`
  left in place (retrospective).

## Handoff

- **Approver:** the decisions above, the approval of the release (step 7), the plan finalization.
- **Agent:** Execution Notes, release commit, suites, independent review, hand transition,
  Session log, commits, push.
- **Completion:** release `minor-v0.1` `releasing` with every pre-release check green on the
  release commit and the approver's OK recorded; plan `done`. Next: `publishing`
  (`release-publishing-rel-v0.1-plan`).

## Session log

### Session 1 — 2026-10-11

- Plan created (`2de8140` add).
