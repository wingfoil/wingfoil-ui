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

**Version:** 0.3 · **Date:** 2026-10-11 (0.1: plan created; 0.2: review round 1 fixes — check script paths, bug-008 reading;
0.3: Session 1 log — review, pre-release-checks)
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
| 1 | This plan (`add` + `submit`) | tech-lead | plan `active` | — |
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
| all tasks tagged `v0.1` `done` | `python3 docs/03_backlog/X_tools/check_tasks.py` + status of task-001…025 |
| all bugs tagged `v0.1` `resolved`/`closed` | bugs carry no `tags`: read as the bugs with `release`/`release-origin` v0.1 — bug-001…007 `closed`; bug-008 (origin v0.1) re-planned to `release: v0.2` at triage, an accepted known limitation (UD-4) · `python3 docs/03_backlog/X_tools/check_releases.py` |
| `tests.passing` | `typecheck`, `lint`, `format:check`, `test:e2e`, `test:smoke` (prints `0.1.0`), `test:contract`, local-security, accessibility, `docs:api`; `test:timing` only if the 1-minute load is below 12, else recorded as skipped (the run on `946ca4b` stands) |
| `tests.coverage(min: 80)` | `npm run test:coverage` |

Never run `test`/`test:coverage`, `test:e2e` and `test:smoke` concurrently in one checkout (they
rebuild `web/dist`).

### Decisions taken at the start (2026-10-11, approver: "tutto come consigliato")

- RS-1 Two plans, one per phase: this one and `release-publishing-rel-v0.1-plan`.
- RS-2 Work on `main` (RV-1); WingFoil dl-024's "release branch merged to main" is met trivially.
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

- Plan created (`2de8140` add, `ca9cc26` submit → `active`); decisions RS-1 … RS-8 above.
- **Step 2** — Execution Notes of `minor-v0.1` (`250840d`): "Implementation" (one bullet per
  wave, W1 … W5, closing bullet), "User docs", "E2E smoke"; drafted by an agent from the three
  phase plans and checked against `git log`.
- **Step 3** — dl-004 (`90e22ee` add, body `76337d7`; created now because `CLAUDE.md` cites it).
  Release commit `ac3b5b5` `chore(release): v0.1.0`: version `0.1.0` in `package.json`,
  `contracts/`, `server/`, `web/` and five `package-lock.json` entries (`npm version 0.1.0
  --no-git-tag-version --workspaces --include-workspace-root`; no other lockfile change),
  `private: true` unchanged; CHANGELOG `[0.1.0] - 2026-10-11` and bug-008 line; user guide 0.2
  bug-008 limitation; `CLAUDE.md` 0.2 project status (RS-5). Pushed.
- **Step 4** — independent review: round 1 **FAIL** — 1 major (plan's check-script paths
  `.wingfoil/scripts/` do not exist → `docs/03_backlog/X_tools/`), 4 minor (bug-008 "tagged v0.2":
  bugs carry no `tags`; bug-004 load below 15 at times not stated; review figures incomplete;
  AC-1/AC-3 rewording and open spec-007 §7 Windows check missing), 5 nits (dl-004 evidence,
  user-guide bug-008 wording broader than the code — SIGINT/SIGTERM/SIGHUP clean up, "dl-024"
  read as local, step 1 role, `CLAUDE.md` "released" before the tag — accepted as RS-5: if
  approve-release falls back, the line is reverted). Fixed in `1579760` (user guide 0.3; registry
  404 re-checked with `curl`). Round 2 **PASS**; its 3 nits (ragged wraps and "accepted" without
  an author in the Execution Notes; checks run on `ac3b5b5` while HEAD moved) fixed in this
  Session log commit — the third by the file list below.
- **Step 5 — pre-release-checks** on `ac3b5b5` (18:43–18:56, sequential, background, no branch
  switch; logs in the session scratchpad):
  - tasks: `check_tasks.py` OK (25 tasks · 72 backlog items · 72 listed); task-001 … 025 `done`.
  - bugs: bug-001 … 007 `closed`; bug-008 `triaged`, `release: v0.2` (known limitation, UD-4);
    `check_releases.py` OK (5 releases · 44/44 MVP features).
  - `tests.passing`: `npm ci`, build, typecheck, lint, format:check ✓ · `test:e2e` **129/129**
    (6.6 min, load ~25) · `test:smoke` **4/4** (the installed package prints `0.1.0`; `node
    bin/wingfoil-ui.cjs --version` → `0.1.0`) · `test:contract` **144 passed, 1 skipped** ·
    local-security **136/136** · accessibility **10/10** · `docs:api` ✓ · `test:timing`
    **skipped** (load 18.05 ≥ 12; the run on `946ca4b` stands — no source under `server/src`,
    `web/src`, `contracts/src` changed since; to be retried before the tag, RV-6).
  - `tests.coverage(min: 80)`: `test:coverage` **1949 passed, 1 skipped**, statements **96.67 %**,
    branches 90.97 %, functions 97.22 %, lines 98.33 %.
  - After `ac3b5b5` only docs/governance files changed (`git diff --name-only ac3b5b5 HEAD`:
    dl-004, `minor-v0.1.md`, this plan, `docs/user-guide.md`); `prettier --check` on them ✓.
