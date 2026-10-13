---
id: dev-loop-rel-v0.2-plan
type: plan
title: "Dev-loop — rel-v0.2"
status: active
version: "0.2"         # optional — plan version
workflow: "dev-loop"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.2 · **Date:** 2026-10-13 (0.1: plan created, Wave 0 scope; 0.2: Wave 0 session log, e2e engine rule W0-9)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.2`) phase `implementation` = `dev-loop` iterated over every task with status `backlog`
and `release: v0.2` (`.wingfoil/workflows/custom/release-cycle.yaml` v1.1, `dev-loop.yaml` v1.4)
**Roles:** developer (start, red, green, refactor, done), architect (design), reviewer (review),
approver (gates) — Roberto Pompermaier holds all of them; the agent develops, drafts and runs the
independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.2.md` (`in-development`, `24c2dbe`); tasks
`docs/04_memory/v0.2/task-026` … `task-042` (`backlog`); bug-008 (`planned`, absorbed into
task-026); tech-specs `spec-001` … `spec-004`, `spec-006` … `spec-010` (`approved`, spec-010 new in
v0.2, the others amended in place at `release-planning`); ADRs `adr-001`, `adr-002`; BDD
conventions `docs/02_requirements/02_bdd/00_conventions.md`
**Evidence:** `release-planning-rel-v0.2-plan` (`done`, merge `12182cd`; decisions RP-1 … RP-55);
dl-006 (retrospective v0.1, actions 1, 4, 6); directives `wingfoil-cli` v1.9 (W-01 … W-27),
`cli-only-writes` v1.6, `claim-evidence`

Why now: `minor-v0.2` is `in-development` and its 17 tasks are `backlog`; `release-cycle` phase
`implementation` runs `dev-loop` once per task. One plan covers the whole phase; each wave is run
by one session and logged below.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `release-planning-rel-v0.2-plan` is `done`; `check_tasks.py v0.2` → 17 tasks · 46 backlog items
  · 46 listed, OK (the checker defaults to v0.1: always pass `v0.2`).
- Before task-027: the approver has installed the WebKit system dependencies
  (`npx playwright install-deps`, RP-44) — done 2026-10-12.

Produces: the code of `server/`, `web/`, `contracts/` and the governance tooling with their tests;
every v0.2 task `done`, merged to `main`; each task's **Execution Notes** filled per phase; one row
per wave in the release's effort table (dl-006 action 6).

## Phases / Steps

Waves (RP-43, RP-55); critical path 026 → 030 → 032 → 033 → 034 → 038/039 → 040.

| Wave | Tasks | Theme |
|------|-------|-------|
| 0 | task-026, task-028, then task-027 | governance: load-independent tests and temp folders (bug-008), public-text check, e2e on Firefox and WebKit |
| 1 | task-030, task-031, task-035 | settings store and API, Today API and memory events feed, *How to join* |
| 2 | task-032, task-036 | governed writes and action log, Today screen |
| 3 | task-033, task-037 | git copy state and transport routes (spec-010), gate footer |
| 4 | task-034, task-042 | auto-sync scheduler and auto-push, notification bell |
| 5 | task-038, task-039, task-041 | submit footer and toasts, sidebar status and fetch, settings page |
| 6 | task-040 | update and push from the sidebar (closes G-13.2's sidebar step, RP-52) |
| any | task-029 | npm publishing pipeline (RP-54), before release validation; registry setup by the approver before `release-submit` (RP-46) |

Per task (`dev-loop` v1.4):

| Phase | What happens | Who |
|-------|--------------|-----|
| start | `backlog → in-progress` **by hand** (W-20): set `status:` and commit `wf(task): <id> [backlog → in-progress]` on `main`; a bug the task absorbs `planned → in-progress` by hand (`wf(bug): <id> [planned → in-progress] — <task> started`, W-26); branch `task/<task-id>`, worktree `.worktrees/<task-id>` | agent (coordinator) |
| design | classify each AC red-first / characterization and read the Execution Notes of every `depends_on` task (hard gate) — both recorded in the task's Execution Notes; a spec gap → numbered decisions with a recommended option, answered by the approver; an approved spec is amended in place with a dated Process Note | agent; approver for decisions |
| red / green / refactor | tests first; `refactor` gate: typecheck, lint, format, `test:coverage` ≥ 80 %, `docs:api`, `test:e2e:chromium` + the task's own e2e specs on three engines (W0-9), `check_tasks.py v0.2` | developer agent |
| review | independent fresh-context read-only review agent, repeated until PASS; adversarial security reviewer who runs the tools itself for task-032, task-033, task-034 and task-026's `clone.ts` change (RP-47); `main` merged into the task branch, then `memory submit` (`in-progress → in-review`) | coordinator; reviewer agents |
| done | `memory approve --reason …` (`in-review → approved`) run by the approver in the checkout holding the task; merge to `main` with `--no-ff` (within a wave in task-number order, each rebased/merged on `main` first, RP-55); push; remove the worktree; `approved → done` **by hand**, commit `wf(task): <id> [approved → done]`; push | approver, coordinator |

Rules for every wave:
- Parallel developer agents, one per worktree; the coordinator owns transitions, reviews, merges and
  pushes. Developer-agent rules are given to each agent at launch (updated for v0.2: folder
  `docs/04_memory/v0.2/`, `check_tasks.py v0.2`, the e2e engine rule W0-9, `test:smoke` gate,
  RP-53 fetch interval 15 s in `test:e2e` and real budgets only in `test:timing` on Chromium,
  append-only shared files of RP-43/RP-55).
- `test:timing` only at load < 12; otherwise at the end of the wave on `main`, otherwise deferred
  to release validation and recorded here. `npm test`/`test:coverage`, `test:e2e` and `test:smoke`
  never run concurrently in one checkout.
- Wave gate on `main` at the end of each wave: full suite, `test:e2e` (three engines, W0-9),
  `test:smoke` (task-026 AC-3).
- Out-of-scope defects: bug-ingest (add + submit by the agent, triage approve by the approver),
  then absorption into a task. A new task in `docs/04_memory/v0.2/` follows W-27 (placeholders so
  the number continues from task-042; no commit contains them).

## Handoff

- **Agent:** runs each task through `dev-loop` with developer agents, the independent and
  adversarial reviews, `memory add`/`submit`, the hand transitions, the merges and pushes; keeps
  the session log and the release's effort table.
- **Human (approver):** answers the numbered decisions; runs every `memory approve` (one command
  given by the agent); authorises merges to `main`.
- **Checkpoints:** design decisions; end of review (approve); before each merge; end of each wave.
- **Completion:** every v0.2 task `done` and merged; plan finalized by hand (`status: done`, commit
  `wf(plan): finalize dev-loop-rel-v0.2-plan [active → done]`, W-04).
- **Next:** Wave 1 — task-030, task-031, task-035 (merge in task-number order, RP-55).

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — Wave 0: governance (2026-10-12)

- Start confirmed by the approver: Wave 0 as planned (task-026 and task-028 in parallel, then
  task-027); parallel developer agents in worktrees, as in v0.1.
- `npx playwright install-deps` first failed on an unrelated stale apt source of the machine
  (fixed by the approver); then it succeeded (RP-44 precondition met).
- **Done and merged** (`--no-ff`; each after an independent fresh-context review repeated until
  PASS and the approver's `memory approve`): task-026 (merge `b6c36d7`, done `5a2d55c`; review
  2 rounds, adversarial security review of the `clone.ts` change PASS, RP-47), task-028 (`e87f375`,
  `9fb5cd3`; 3 rounds), task-027 (`7fad0cc`, `8009e4a`; 2 rounds). `main` merged into each task
  branch before submit; within the wave merged in task-number order (RP-55).
- **Decisions** (the approver, "as recommended" unless noted; details in each task's Execution
  Notes):
  - **W0-1 (D26-1)** bug-008: `core.hooksPath` = the clone module's own regular file (git probes
    `<file>/<hook>` → `ENOTDIR`); no folder is created, so nothing outlives a killed console; the
    clone is refused before any git process when the file is not a regular file. Checked in every
    shipped form (sources, `server/dist` through the bin, the packed install in `test:smoke`).
  - **W0-2 (D26-2)** one temporary root `wfui-run-*` per test run, set by every runner's global
    setup (`TMPDIR`/`TMP`/`TEMP`), removed by its owner, swept at the next start only when its
    owner is gone; `TempWorkspace` stays the API for new tests.
  - **W0-3 (D26-3, D26-4, D26-5)** fresh-read preconditions on the three named files plus the
    `@live-refresh` tests; `test:smoke` as a wave gate in `test/README.md` and `CLAUDE.md`; the
    SIGKILL test is a bin test with a test-owned temporary folder.
  - **W0-4 (coordinator, task-026 review F1)** an unusable hooks path answers 500 `internal`
    (path only in the server log), not `git-refused` — within spec-004 §5, no amendment.
  - **W0-5 (D28-1 … D28-7)** the public-text check: standard top-level POSIX roots, drive paths,
    `~/` and home variables; global anchored allow-list entries, each with its reason and required
    to match; `/tmp` only for named fictitious folders and `/tmp/wfui-*`; UNC paths out of scope.
  - **W0-6 (D27-1, D27-2, D27-3)** the WebKit axe self-test page styles its own button; `@perf`
    runs on Chromium only; the clipboard helper reads the real clipboard with per-engine grants.
  - **W0-7** bug-009 (Memory list filter names read once, failed under load) ingested and
    absorbed into task-027 (AC-5).
  - **W0-8** bug-010 (a clone runs the user's own configured git commands; no minimum git
    version) ingested from the task-026 security review (pre-existing items P1, P2) and absorbed
    into task-033; its option is chosen at task-033's design. Item P3 (template hooks copied, not
    run) needs no change.
  - **W0-9 (D27-4, option C)** e2e engines: the inner loop of a task runs the whole suite on
    Chromium (`npm run test:e2e:chromium`) and the task's own spec files on the three engines
    (`npm run test:e2e -- <files>`); `npm run test:e2e` (three engines) is the gate of every wave
    and of release validation. Rationale: about 43 e2e runs remain in v0.2; three engines always
    ≈ 25 h of machine time and 6–7 h more on the critical path, option C ≈ 13–14 h. This makes
    RP-53's "in `test:e2e` on the three engines" hold at the wave gates.
  - **W0-10** bugs 008 and 009 (`resolved`) are closed at release validation.
- **Integration findings:** the public-text check flagged, on the merged tree, git's hook probe
  `/dev/null/post-checkout` and two `<placeholder>/…` forms in Execution Notes (allow-list entry
  and rewording); a placeholder written as `<x>/folder` is reported like a path.
- **Gate at the end of the wave** on `main` `8009e4a` (2026-10-13 14:35–15:17): `test:coverage`
  2033 passed, 1 skipped (statements 96.78 %, branches 91.14 %); `test:e2e` three engines 385
  passed (Chromium 133, Firefox 126, WebKit 126; 20.3 min of test time, 39 min wall-clock with the
  build) at load 22; `test:smoke` 4/4; 0 new `wfui-*` entries in the system temporary directory.
  `test:timing` skipped on `main` (load 17.8); it passed on task-026's branch after its merge of
  `main` (load 7–10: Vitest 3/3, Playwright 14/14) — to run on `main` at a later wave end or at
  release validation.
- **Effort:** 2026-10-12 23:30 – 2026-10-13 15:20 wall-clock with an overnight pause (about 9 h
  of working time, mostly waiting for agents and suites).
- **Hand-overs to Wave 1:** temporary folders follow `test/README.md` *Temporary folders*; new
  absolute example paths must be allow-listed or reworded (public-text check); copy buttons are
  tested with `test/e2e/support/clipboard.ts` (task-035, C-08.2); e2e per W0-9.
