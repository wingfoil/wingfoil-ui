---
id: dev-loop-rel-v0.2-plan
type: plan
title: "Dev-loop — rel-v0.2"
status: active
version: "0.1"         # optional — plan version
workflow: "dev-loop"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: "minor-v0.2" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.2"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-12 (0.1: plan created, Wave 0 scope)
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
| red / green / refactor | tests first; `refactor` gate: typecheck, lint, format, `test:coverage` ≥ 80 %, `docs:api`, `test:e2e` (three engines after task-027), `check_tasks.py v0.2` | developer agent |
| review | independent fresh-context read-only review agent, repeated until PASS; adversarial security reviewer who runs the tools itself for task-032, task-033, task-034 and task-026's `clone.ts` change (RP-47); `main` merged into the task branch, then `memory submit` (`in-progress → in-review`) | coordinator; reviewer agents |
| done | `memory approve --reason …` (`in-review → approved`) run by the approver in the checkout holding the task; merge to `main` with `--no-ff` (within a wave in task-number order, each rebased/merged on `main` first, RP-55); push; remove the worktree; `approved → done` **by hand**, commit `wf(task): <id> [approved → done]`; push | approver, coordinator |

Rules for every wave:
- Parallel developer agents, one per worktree; the coordinator owns transitions, reviews, merges and
  pushes. Developer-agent rules are given to each agent at launch (updated for v0.2: folder
  `docs/04_memory/v0.2/`, `check_tasks.py v0.2`, three engines after task-027, `test:smoke` gate,
  RP-53 fetch interval 15 s in `test:e2e` and real budgets only in `test:timing` on Chromium,
  append-only shared files of RP-43/RP-55).
- `test:timing` only at load < 12; otherwise at the end of the wave on `main`, otherwise deferred
  to release validation and recorded here. `npm test`/`test:coverage`, `test:e2e` and `test:smoke`
  never run concurrently in one checkout.
- Wave gate on `main` at the end of each wave: full suite, `test:e2e`, `test:smoke` (task-026
  AC-3).
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
- **Next:** Wave 0 — task-026 and task-028 in parallel, then task-027.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — Wave 0: governance (2026-10-12)

- Start confirmed by the approver: Wave 0 as planned (task-026 and task-028 in parallel, then
  task-027); parallel developer agents in worktrees, as in v0.1.
- `npx playwright install-deps` first failed on an unrelated stale apt source of the machine
  (fixed by the approver); then it succeeded (RP-44 precondition met).
