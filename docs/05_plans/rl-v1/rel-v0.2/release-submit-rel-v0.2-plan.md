---
id: release-submit-rel-v0.2-plan
type: plan
title: "Release submit rel-v0.2"
status: done
version: "0.2"         # optional — plan version
workflow: "release-submit"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.3 · **Date:** 2026-10-20 (0.1: plan created; pre-step — registry checklist, the first dry run, task-044; 0.2: Session 1 log — pre-step done, three dry runs, task-044 and task-045, bugs 020–023; 0.3: Session 2 log — steps 2–8, release approved)
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
| 1 | This plan (`add` + `submit`); pre-step above | tech-lead | plan `active`; task-044, task-045 `done`; a green dry run on `main` (done: run `39451186680`) | the dry run's `gate` and `stage` green |
| 2 | Execution Notes of `minor-v0.2` — "Implementation" closing bullet, "User docs", "E2E smoke", "Submit & Publishing" so far (what happened, not lessons); effort table rows of release validation | tech-lead | `docs(release)` commit | review step 4 |
| 3 | **release-commit:** version `0.2.0` in the root, `contracts`, `server`, `web` `package.json` and `package-lock.json` (`npm version 0.2.0 --no-git-tag-version --workspaces --include-workspace-root`); CHANGELOG `[Unreleased]` → `[0.2.0] - <tag date>` with its links; the user-docs hand-over (README status and install, user guide introduction, `CLAUDE.md` project status as released, RS-5 of v0.1); Version/Date headers | tech-lead | `chore(release): v0.2.0` commit | review step 4 |
| 4 | Independent fresh-context read-only review of steps 2–3, repeated until PASS (nothing above nit) | reviewer | review report | PASS |
| 5 | **pre-release-checks** on the release commit, in series through the machine-free slot (RV2-3): tasks (`check_tasks.py v0.2`, task-026 … task-045 `done`); bugs of `v0.2` (`release` `v0.2`, or empty with `release-origin` `v0.2`) `resolved`/`closed` — bug-019 and bug-023 (`triaged`, fix in v0.3) are known (bug-019 a known limitation of the user docs, approver 2026-10-19; bug-023 test-only); `check_releases.py`; `tests.passing`: `typecheck`, `lint`, `format:check`, `docs:api`, `test:contract`, `test:e2e:chromium`, `test:smoke` and `test:publish-smoke` (the installed package prints `0.2.0`), `test:timing` evidence per RV2-3; `tests.coverage(min: 80)`: `test:coverage`; `npm audit --omit=dev` 0 and the full audit against the accepted list (RV2-7) | qa | report in Session log | every check green |
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

### Session 1 — pre-step (2026-10-19 – 2026-10-20)

- Plan created (`61ad052` add, `4eb32f0` submit → `active`). Registry checklist and first dry run as
  in *Pre-step* above.
- **task-044** (bug-020; D44-1 … D44-8, the approver: "as recommended"): the harness `.gitconfig` sets
  `user.name = Test Harness` and `user.useConfigOnly = true` (no email); a local strict run with a
  `git` wrapper first on `PATH` (`test/README.md` *Git identity*). The design found that 3 of the 61
  failures had another cause: git ≥ 2.48 creates `refs/remotes/<remote>/HEAD` on fetch and task-043's
  commit-provenance checker reported it → **bug-021** (`4e15e49`… ingested, triaged low `fc65f08`,
  absorbed as AC-5): the checker ignores that symref only while it points under its remote.
  Independent review round 1 FAIL (blocker: one AC-5 case passed only on git < 2.48, reproduced by
  the reviewer with a wrapper emulating `followRemoteHEAD`), round 2 PASS. Gates under the wrappers:
  `test:coverage` 3220 passed / 1 skipped, `test:e2e:chromium` 319. Approved `ce9e2a1`, merged
  `891aab5`, `done` `f73294e`; bug-020, bug-021 `resolved`.
- **Second dry run** (run `39328350689` on `f73294e`): `gate` failed on one test only — the bug-017
  case of `test/server/http/projects.test.ts`, which relied on git quoting a `gitdir:` path; git 2.55
  prints `fatal: not a git repository: (null)` → **bug-022** (`3a4d79f`, `7698515`, triaged low
  `93996c1`) absorbed into **task-045** (compact dev-loop, the approver): the case now drives a refusal
  quoting a `core.repositoryformatversion` value the test chose (git's `die_bad_number` quotes it on
  every version). Independent review PASS (two nits recorded). Local `test:coverage` failed three
  times on timeouts in untouched files at load 20–26 (`auto-sync.test.ts` RP-36 every time) →
  **bug-023** (`e3ca6f8`, triaged low `ef9d875`, fix in v0.3); the approver accepted the third dry
  run as AC-3's evidence. Approved `7c717ae`, merged `547714f`, `done` `c22d847`.
- **Third dry run** (run `39451186680` on `main` `c22d847`): **all green** — `gate` (Node 22.22.2)
  install, typecheck, lint, format, `test:coverage` 3220 passed / 1 skipped (statements 96.56 %,
  branches 91.4 %), `test:smoke` 4/4, `npm pack` (artifact `wingfoil-ui-tarball`, 587 057 bytes);
  `stage` (Node 22.12.0) `test:publish-smoke` 11/11 — the "not verified yet" item of
  `docs/publishing.md`; `promote` skipped (dispatch). `npm ci` in `stage` warns `EBADENGINE` for
  development dependencies (eslint, jsdom) that ask for a newer Node — expected (D29-5), harmless.
- Bugs closed by the approver with the CLI: bug-020 `13d3751`, bug-021 `5486b14`, bug-022 `c45cd8f`
  (close notes and `release: "v0.2"` `2950ad8`). Open for v0.3: bug-019 (an element id over 100
  characters cannot be opened; known limitation of v0.2) and bug-023 (`triaged`).
- WingFoil 0.3.0 was released on 2026-10-19 (a cross-project notice): no effect on v0.2 (pinned
  0.2.2); this repository's workflow `include:` values are already names, not paths (input of the
  base-pack alignment, see `e2e-smoke-rel-v0.2-plan` *For the retrospective*).
- **Next:** steps 2–8 in a new session (the approver), then `release-publishing` in the same
  session (RV2-1): tag `v0.2.0`, the tag run, `promote` rejected and the first publish by hand
  (checklist step 4), checklist steps 5–6.

### Session 2 — steps 2–8 (2026-10-20)

- State checked at the start against the previous session's handoff: `main` = `origin/main` =
  `95f01de`, no worktree, no tag `v0.2.0`; task-026 … task-045 `done`; bugs closed except bug-019
  and bug-023 (`triaged`); release `in-development`; dry run `39451186680` green on `c22d847`;
  registry name still `404`, environment `npm-publish` with a required reviewer and the tag rule
  `v*`; CLI `0.2.2`. Differences found: `web/src/today/` changed after `33ab602` (task-043,
  bug-018), and Today is timed (TT-PERF-01), so the Wave 6 timing runs no longer cover the release; bug-019
  and bug-023 had an empty `release` with `release-origin` `v0.2`, so the bug check would count them
  for this release.
- **Decisions** (the approver, 2026-10-20: "as recommended", except the GitHub Release):
  - RS2-1 Steps 2–8 and `release-publishing` in this session (RV2-1): tag `v0.2.0` on `main`, its
    push on a separate OK; the approver rejects the tag run's `promote` deployment, publishes
    `0.2.0` by hand from the run's `wingfoil-ui-tarball` artifact (checklist step 4, no provenance),
    then does checklist steps 5–6; post-check `npm view wingfoil-ui@0.2.0 version`; `releasing →
    released` by hand.
  - RS2-2 `test:timing` re-run on the release tree, alone through the slot (RV2-3's Wave 6 evidence
    does not cover the Today change).
  - RS2-3 A GitHub Release for `v0.2.0`, as WingFoil makes one (the approver; option A): made by
    hand once the version is live, on the approver's OK — `gh release create v0.2.0 --verify-tag
    --title v0.2.0`, the CHANGELOG `[0.2.0]` section as notes, the published tarball and the
    coverage reports of the release tree's local run as assets. WingFoil's automatic `release` job
    (after `promote`, the gate's test reports) would be skipped anyway for a rejected `promote`; it
    becomes a governance task of v0.3 (input of the retrospective).
  - RS2-4 bug-019 and bug-023 get `release: "v0.3"` (a field, no state change), so the bug check of
    `release-submit` 1.1 assigns them to the release that fixes them.
- **Step 2** — Execution Notes of `minor-v0.2` (`448d812`): the Implementation closing bullet,
  "User docs", "E2E smoke", "Submit & Publishing" so far, two effort rows of release validation
  (the 10th active day recorded as an RV2-1 deviation); bug-019 and bug-023 `release: "v0.3"`.
- **Step 3** — release commit `8b217b0` `chore(release): v0.2.0`: `0.2.0` in `package.json`,
  `contracts/`, `server/`, `web/` and five `package-lock.json` entries (`npm version 0.2.0
  --no-git-tag-version --workspaces --include-workspace-root`); CHANGELOG `[0.2.0] - 2026-10-20` and
  its links, the first version on npm published by hand; README (status released, install from npm
  first); user guide 0.20; CLI reference 0.4; `docs/publishing.md` 0.3 (the first version by hand,
  `stage` verified on Node 22.12.0, the GitHub Release of `v0.2.0` by hand); `CLAUDE.md` 0.7 (the
  status as released, RS-5 of v0.1, and how `0.2.0` is published).
- **Step 4** — independent review (fresh context, read-only, adversarial): round 1 FAIL — 1 major
  (the `docs/publishing.md` Version line not bumped), 3 minor (a bullet dated 2026-10-19 reported
  events of 2026-10-20; effort-row start times without a source; the RV2-1 deviation not named), 6
  nits — fixed `ab34824`; round 2 FAIL — 1 minor (two unwrapped lines left by the round-1 edit), 2
  nits — fixed `7ab00d7`; round 3 **PASS** (1 nit: a command split across lines, fixed `76570c5`).
- **Step 5 — pre-release-checks** on `76570c5` (21:44–22:26, in series, every heavy gate through
  the machine-free slot; `git diff --name-only 8b217b0 76570c5` = `CLAUDE.md`, `minor-v0.2.md`,
  `docs/cli-reference.md`, `docs/publishing.md`, `docs/user-guide.md` — documents only):
  - tasks: `check_tasks.py v0.2` OK (20 tasks · 46 backlog items · 46 listed); task-026 … task-045
    `done`.
  - bugs of `v0.2` (`release` `v0.2`, or empty with `release-origin` `v0.2`): bug-008 … bug-018,
    bug-020 … bug-022 — 14, all `closed`; bug-019 and bug-023 `triaged` for v0.3 (RS2-4);
    `check_releases.py` OK (5 releases · 44/44 MVP features).
  - `tests.passing`: `typecheck`, `lint`, `format:check`, `docs:api` ✓ · `test:contract` **263
    passed, 1 skipped** · local-security (`local-security.test.ts`, `launcher.test.ts`,
    `guards.test.ts`, `element-writes.test.ts`) **251/251** · `test:e2e:chromium` **319 passed**
    (10.4 min, load up to 12.8) · `test:smoke` **4/4** and `test:publish-smoke` **11/11** (both
    assert `--version` and `GET /api/server` against the package version `0.2.0`); `node
    bin/wingfoil-ui.cjs --version` → `0.2.0` · `test:timing` (RS2-2; 21:45–22:08, alone, load
    2.1–5.6) **6/6 + 23/23**: REQ-PERF-03 20/20 within 5 s (300–552 ms), REQ-PERF-06 10/10 within
    3 s (284–363 ms), TT-PERF-01 Today p95 134 ms (after one commit p95 734 ms), TT-PERF-02 approve
    p95 647 ms and submit p95 579 ms, TT-PERF-04 p95 47–117 ms, TT-PERF-07 10/10 within 65 s
    (59.4–60.0 s).
  - `tests.coverage(min: 80)`: `test:coverage` **3220 passed, 1 skipped**, statements **96.56 %**,
    branches 91.4 %.
  - `npm audit --omit=dev` 0; the full audit 9 (3 critical, 6 high) — `verdaccio`,
    `@verdaccio/hooks`, `@verdaccio/local-storage-legacy`, `handlebars`, `braces`, `micromatch`,
    `fast-glob`, `globby`, `compression`: the accepted dev-only list (RV2-7), no new finding.
  - No console, registry process or `wfui-*` entry left; working tree clean.
- **Step 6 — enter-releasing:** `116395d` `wf(release): minor-v0.2 [in-development → releasing]`
  (hand transition, W-25); `check_releases.py` OK. `main` pushed (no Actions run: `publish.yml`
  triggers on tags and dispatch only).
- **Step 7 — approve-release:** the approver, in chat on 2026-10-20: "approvo la release v0.2,
  procedi con il passo 8" — release `minor-v0.2` approved for publishing on `116395d`
  (pre-release-checks on `76570c5`).
- **Step 8:** plan finalized (separate commit). Next: `release-publishing-rel-v0.2-plan` in this
  session (RS2-1).
