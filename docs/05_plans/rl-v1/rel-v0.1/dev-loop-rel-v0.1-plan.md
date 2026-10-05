---
id: dev-loop-rel-v0.1-plan
type: plan
title: "Implementation rel-v0.1"
status: active
version: "0.2"         # optional — plan version
workflow: "dev-loop"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.2 · **Date:** 2026-10-05 (0.1: plan created, Wave 1 scope; 0.2: Wave 1 session log)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`) phase `implementation` = `dev-loop` iterated over every task with status `backlog`
and tag `v0.1` (`.wingfoil/workflows/custom/release-cycle.yaml` v1.1, `dev-loop.yaml` v1.4)
**Roles:** developer (start, red, green, refactor, done), architect (design), reviewer (review),
approver (gates) — Roberto Pompermaier holds all of them; the agent develops, drafts and runs the
independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md` (`in-development`); tasks
`docs/04_memory/v0.1/task-001` … `task-021` (`backlog`); tech-specs `spec-001` … `spec-004`,
`spec-006` … `spec-009` (`approved`); ADRs `adr-001`, `adr-002` (`accepted`); BDD conventions
`docs/02_requirements/02_bdd/00_conventions.md`
**Evidence:** handoff of `release-planning-rel-v0.1-plan` (`done`, merge `7ccafde`); directives
`wingfoil-cli` v1.2 (W-01 … W-20), `cli-only-writes` v1.4, `claim-evidence`

Why now: `minor-v0.1` is `in-development` and its 21 tasks are `backlog`; `release-cycle` phase
`implementation` runs `dev-loop` once per task. One plan covers the whole phase; each wave is run
by one session and logged below.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `release-planning-rel-v0.1-plan` is `done`; `directives list` → `"warnings": []`;
  `check_tasks.py` passes.

Produces: the code of `server/`, `web/`, `contracts/` with its tests; every v0.1 task `done`, merged
to `main`; the task's **Execution Notes** filled per phase.

## Phases / Steps

Tasks are picked by `depends_on`, **not by number**. Dependency levels: L0 001 · L1 002 · L2 003,
004, 007 · L3 005 · L4 006, 009, 010, 011 · L5 008, 012 · L6 013 · L7 018 · L8 017, 020 · L9 015,
019 · L10 014 · L11 016 · L12 021.

| Wave | Tasks (in order) | Theme |
|------|------------------|-------|
| 1 | 001, 002, 003, 004, 007, 005 | server foundations: workspace and e2e harness, launcher, session, CLI adapter, local state, CLI contracts |
| 2 | 006, 009, 010, 011, 008, 012 | server: version range, identity, snapshot and live updates, descriptor, project APIs |
| 3 | 013, 018, 017, 020, 019 | web core: shell, element panel, memory list, docs, DNA views |
| 4 | 015, 014, 016 | project flows: switcher, add modal, header |
| 5 | 021 | closing pass: accessibility, page title, performance |

Per task (`dev-loop` v1.4):

| Phase | What happens | Who |
|-------|--------------|-----|
| start | branch and worktree `task/<task.id>`; `backlog → in-progress` **by hand** (no verb, W-20): set `status:` and commit `wf(task): <id> [backlog → in-progress]` on `main` before branching | agent |
| design | classify each AC red-first / characterization and read the Execution Notes of every `depends_on` task (hard gate) — both recorded in the task's Execution Notes; a spec gap → `memory add` + `submit` a tech-spec, approved before `red` | agent; approver for new specs |
| red / green / refactor | tests first; `refactor` gate: tests green, coverage ≥ 80 %, TypeDoc complete (server/contracts), lint clean | agent |
| review | BDD/e2e suite for the task's scenarios; independent fresh-context read-only review agent (ACs, tests, spec coherence), re-verified by it after fixes; `memory submit` (`in-progress → in-review`) | agent; reviewer |
| done | `memory approve --reason …` (`in-review → approved`) run by the user; merge to `main` with `--no-ff` after the user's OK; remove the worktree; `approved → done` **by hand**, commit `wf(task): <id> [approved → done]` | approver (user), agent |

### Decisions taken at the start (2026-10-05)

- One plan for the whole `implementation` phase (`workflow: dev-loop`, the `id_pattern` example
  `dev-loop-rel-v0.1-plan`); one session per wave, logged below.
- Wave 1 = 001, 002, 003, 004, 007, 005 (confirmed); later waves as in the table, confirmed by the
  session that runs them.
- Task transitions checked on a scratch clone with `wingfoil@0.2.2`: `submit` from `backlog` and
  from `approved` is refused (`illegal transition … -> pending`, W-20); `submit` moves
  `in-progress → in-review`; `approve` moves `in-review → approved`. `backlog → in-progress` and
  `approved → done` are hand edits with a `wf(task): <id> [from → to]` commit (like W-04).
- Commits: the CLI `wf(…)` commits, the task commits on its branch, one `--no-ff` merge per task
  (asked before merging), plus one plan commit per session (`docs(plan): session N — …`).
- Every task's review is done by an independent fresh-context read-only agent, re-verified by it
  after fixes.
- `main` stays local (not pushed) during Wave 1.

## Handoff

- **Agent:** implements each task through `dev-loop`, fills its Execution Notes, runs the scripted
  checks and the independent review, runs `add`/`submit`, makes the hand transitions, keeps the
  session log, commits.
- **Human (approver):** runs every `memory approve` (W-13), authorises each merge to `main`.
- **Checkpoints:** end of `design` (only if a new tech-spec is needed); end of `review` (approve);
  before each merge; end of each wave.
- **Completion:** every v0.1 task `done` and merged; plan finalized by hand (`status: done`, commit
  `wf(plan): finalize dev-loop-rel-v0.1-plan [active → done]`, W-04).
- **Next:** wave 2 (006, 009, 010, 011, 008, 012) — see Session 1.

## Session log

<!-- One entry per session: date, decisions taken, deviations from this plan. -->

### Session 1 — Wave 1: server foundations (2026-10-05)

- **Done and merged** (`--no-ff`, each after an independent fresh-context review, re-verified by
  the same agent after fixes, and the user's `memory approve`): task-001 (`cef8085`), task-002
  (`cfc7d87`), task-007 (`5708b16`), task-003 (`f534738`), task-004 (`dc6baf6`), task-005
  (`d8960f5`). Review rounds: 001 ×2, 002 ×2, 003 ×3, 004 ×4, 007 ×3, 005 ×2.
- **Process decisions:**
  - Task transitions checked on a scratch clone: `backlog → in-progress` and `approved → done` are
    hand edits with a `wf(task): <id> [from → to]` commit on `main` (W-20, directive 1.3).
  - **Parallel dev-loops** (user request): after task-002, tasks 003, 004, 007 ran in parallel,
    one background agent per worktree (design → refactor only); the coordinator kept every
    transition, review, submit and merge on `main`. Wave statistics are shown at every agent
    update (user preference). Merges one at a time; from task-004 on, `main` is merged into the
    task branch **before** submit, so the approval covers the integrated code.
  - Plan `workflow: dev-loop` (the `id_pattern` example) instead of `release-cycle`.
- **Spec amendments decided by the user** (approved specs edited in place, Process Notes dated):
  spec-004 §1 `Sec-Fetch-Site` check and duplicate `Host` refused, §5 `502 read-error`; spec-006 §4
  lock protocol between consoles (`state.json.lock`, heartbeat, 10 s staleness), temporary file
  `tmp-<pid>-<n>`, `reload`; spec-007 §6 `SIGHUP` like `SIGTERM`, synchronous kill of child
  process groups on forced stop/exit; spec-001 errata — shapes follow WingFoil 0.2.2's own
  schemas (optional fields, `\r?\n` delimiters, merge keys) (`429aab3`, `aba1464`).
- **WingFoil 0.2.2 facts** (directive `wingfoil-cli` 1.3 → 1.5): W-21 `memory add` always writes
  `draft`; W-22 exit 2 may be JSON on stderr, positionals after `--`; W-23 duplicate directive ids;
  W-09 qualified (dangling binding warned only with `--role`). A claimed W-22 "search hides
  undeclared states" was **withdrawn** at review (flawed probe). adr-001 Process Note: the root
  `devDependencies` pin of `wingfoil` is not a runtime dependency. Local requests: R-12.
- **Deviations:** the fixture builder (001) and two coverage tests (002) were written after the
  code; the task-004 agent session was interrupted and the coordinator completed its notes.
- **Environment:** another project's parallel builds pushed the load average to 50–70 on 12
  cores; the REQ-PERF-06 start test (≤ 3.0 s) and the TypeDoc-build test (30 s) then fail and pass
  alone. Every merge was preceded by a full run at low load. **Proposal for Wave 2:** isolate the
  timing tests (sequential Vitest project) and run them only on a quiet machine.
- **Checks on `main` after the wave** (`4d3e6cb`, load ≈ 6): `npm run test:coverage` **547 passed,
  1 skipped** (on-demand sample capture), coverage 96.32 % statements / 90.04 % branches · e2e 3/3
  (Chromium) · lint, format, typecheck clean · `docs:api` OK · `check_tasks.py` OK (21 tasks, 72
  items) · `directives list` → `"warnings": []`.
- **Hand-overs to Wave 2** (in each task's Execution Notes): 006 — `matrix.json`, versioned
  schemas; 008 — clone through the runner with the REQ-SEC-05 probe (`test/harness/security.ts`),
  `store.transaction` short and side-effect-free (may run twice, not re-entrant), `reload()` for
  the list, write-lock key = opaque project id, `GIT_TERMINAL_PROMPT=0`, `dna.project.name`
  optional; 010 — cache `memory search`, re-discover the CLI when `node_modules/wingfoil` changes;
  012 — routes through `buildApp({ register })` (guarded automatically), `read-error` mapping,
  never log `DirectReadError.message`; 013 — `POST /api/session` (Bearer, 204), same-origin
  fetches only, catalogue keys `state.*`; 015 — Playwright needs its own `tsc -b server` step.
- **Bug ingest** (user decision: isolating the timing tests needs a bug, not an ad-hoc change):
  `bug-001-timing-tests-fail-under-external-machine-load` captured through `bug-ingest`
  (`add`/`submit` by the agent, triage `approve` by the user, severity low), **absorbed into
  task-010** (dl-045; it owns TT-PERF-03/05): `bug:` field and an Acceptance Criterion added
  (`443fb08`), bug `triaged → planned` by hand (`eeb7b9e`).
- **`.wingfoil/` alignment** with the WingFoil-Templates `base` pack: between releases, not
  between waves (user decision).
- **Next:** Wave 2 — 006, 009, 010, 011, 008, 012 (by `depends_on`; parallel where independent).

