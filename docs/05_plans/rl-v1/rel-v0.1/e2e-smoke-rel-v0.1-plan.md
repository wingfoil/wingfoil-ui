---
id: e2e-smoke-rel-v0.1-plan
type: plan
title: "E2E smoke rel-v0.1"
status: active
version: "0.1"         # optional — plan version
workflow: "e2e-smoke"
phase: "rel-v0.1"
scope: "rl-v1/rel-v0.1"
element: "minor-v0.1" # optional — the Memory element this phase iterates (e.g. a release id)
release: "v0.1"       # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

**Version:** 0.1 · **Date:** 2026-10-11 (0.1: plan created)
**Branch:** `design/e2e-smoke_v0.1` (merged to `main` with `--no-ff` at the end, on the approver's OK)
**Workflows:** `sw-life-cycle` → `release-line-cycle` (`rl-v1`) phase `delivery` → `release-cycle`
(`minor-v0.1`, v1.1) phase `e2e-smoke` = `e2e-smoke` (`.wingfoil/workflows/custom/e2e-smoke.yaml`
v1.0, the web-dashboard rewrite of WingFoil's dl-023 CLI smoke); task-025 through `dev-loop` v1.4
**Roles:** qa (every smoke step), developer / reviewer (task-025), approver (gates) — Roberto
Pompermaier holds all of them; the agent runs the suites, develops task-025 through a developer
agent and runs the independent reviews (no approval authority)
**Input:** release `docs/04_memory/planning/v1/minor-v0.1.md` (`in-development`, success criteria);
`user-docs-rel-v0.1-plan` (`done`, merge `3a74e9c`; decisions RV-1…RV-10); `test/README.md` v0.23;
bugs bug-004, bug-005, bug-006 (`resolved`)
**Evidence:** `test:timing` green on `946ca4b` (user-docs plan, Session 1); handoff of session "WFUI
v0.1 - 9. implementation W5"

Why now: `user-docs` is done; `release-cycle` v1.1 runs `e2e-smoke` before `submit`. The gate is
**staged**: warn on failure until it runs green for a release, then hard-reject.

Preconditions:
- `npm run -s wingfoil -- --version` prints `0.2.2`, the version `package.json` pins for `wingfoil`.
- `user-docs-rel-v0.1-plan` is `done` and merged.

Produces: task-025 `done` (bug-007 `resolved`); the smoke report of every step below on `main`
after the merge of task-025; bug-004 re-checked under load; bug-004/005/006 (and bug-007 if
resolved) `closed`.

## Phases / Steps

### Mapping of `e2e-smoke.yaml` onto this repository

| Step | Command / suite | Covers | Gap → task-025 |
|------|-----------------|--------|----------------|
| fixture-project | `test/harness/fixtures/` (kanban, custom, unknown without `ui.yaml`, team, large) built with the pinned CLI | element states shown by the v0.1 screens | `Scrum` template never used (AC-4) |
| drive-browser | `npm run test:e2e` (Playwright, Chromium only in v0.1 — TT-INT-08) | read views, switcher, add/clone, header, identity and role views; Kanban, custom, unknown fixtures | "every commit is `wf(…)`/`chore(ui)`" untested → v0.1 makes no governed write: history unchanged (AC-5). Gate actions, "local changes", "behind": not in v0.1 (no governed write) |
| local-security | `test/launcher/local-security.test.ts` (raw HTTP, REQ-SEC-02/03) + `test/server/http/guards.test.ts` (in `test:coverage`) | loopback only, session token, Origin/Host/`Sec-Fetch-Site`, confinement | — |
| accessibility | `npx playwright test test/e2e/accessibility.spec.ts` (also in `test:e2e`) | axe 0 serious/critical on the 16 screens, both themes; keyboard path of every view | — (no gate action in v0.1) |
| contract | `npm run test:contract` | CLI JSON contract, `wingfoil_min` 0.2.2 … pinned 0.2.2 | — |
| launch | — | — | packaged app cannot start (bug-007; AC-1…AC-3) |
| gate | this plan's report | staged: warn | — |

Also run on `main`, as for every merge: `typecheck`, `lint`, `format:check`, `test:coverage`,
`docs:api`, `check_tasks.py`, `check_releases.py`.

### Steps

| # | Step | Role | Output | Stop-check |
|---|------|------|--------|------------|
| 1 | This plan; mapping; bug-007 ingest (`add`+`submit` by the agent, triage by the approver); task-025 (`add`+`submit`, approve → `backlog`) | qa, approver | plan `active`; bug-007 `triaged → planned`; task-025 `backlog` | `check_tasks.py` OK |
| 2 | task-025 through `dev-loop`: worktree `.worktrees/task-025-…`, developer agent (rules `.notes/dev-rules.md`), design checkpoint with numbered decisions ES-8…, TDD, independent review until PASS, approver gates, merge to `main`, push | developer, reviewer, approver | task-025 `done`; bug-007 `resolved` | gates green on the merge |
| 3 | Smoke run on `main` after the merge: every step of the mapping, the launch smoke (AC-3) | qa | smoke report in Session log | every step green (staged: a failure warns) |
| 4 | bug-004 re-check (RV-4): two runs of `test:coverage` + `test:e2e` at load ≥ 15 (synthetic load if the machine is idle) | qa | runs with load and timings in Session log | no timeout in either run |
| 5 | Close bugs (RV-5): a "close" note committed in each bug, then one approve command by the approver (`resolved → closed`) | tech-lead, approver | bug-004/005/006/007 `closed` | — |
| 6 | Gate: report, approver's OK; plan finalized; merge `design/e2e-smoke_v0.1`; push | approver | plan `done` | approver's OK |

### Decisions taken at the start (2026-10-11, approver: "ok procedi" = all as recommended)

- ES-1 The gap found by `npm pack --dry-run` is **bug-007** ("Packed package cannot start and would
  ship private and development files", severity medium), absorbed into task-025.
- ES-2 `launch` for v0.1: make the package correct and smoke it locally without publishing — `npm
  pack` → install the tarball in a temp folder → `npx wingfoil-ui --no-open` → UI reachable; a
  `files` allow-list, runtime dependencies at the root, `prepack: npm run build`, a test failing on
  any path outside the allow-list. `private: true` stays (RV-8).
- ES-3 task-025 adds a `Scrum` fixture (`wingfoil init --template Scrum`) and its e2e smoke (Memory
  list, element panel, axe in both themes).
- ES-4 task-025 adds the "no commit" check: a console session on a fixture leaves its history and
  working tree unchanged (the only v0.1 write is a clone into a new folder).
- ES-5 task-025 is run through the full dev-loop (worktree, developer agent, independent review
  until PASS, the approver's two approvals). It is a governance task (`module: governance`,
  `ref: GOV`): `check_tasks.py` requires each backlog item to be listed by exactly one task, and
  US-S-01 / TT-ARC-01 belong to task-002 — accepted deviation from "a task serves its backlog
  items", recorded here.
- ES-6 bug-004 re-check on `main` after the merge of task-025, two runs at load ≥ 15, synthetic load
  (`stress-ng` or a parallel build loop) only for the duration of the runs.
- ES-7 The whole smoke runs on `main` after the merge of task-025; a green run is recorded as the
  first green run of the staged gate, so the gate hard-rejects from the next release.

## Handoff

- **Approver:** triage of bug-007, the two approvals of task-025, the design decisions of task-025,
  the bug-closing approve command, the gate, the plan finalization and the merges.
- **Agent:** suites, task-025 development through a developer agent and independent reviews,
  hand transitions (W-01), Session log, commits, push after each merge.
- **Completion:** every smoke step green on `main` (or its failure recorded as a staged warning);
  bug-004 re-checked; bugs closed; plan `done`; branch merged and pushed. Next: `submit` +
  `publishing` (RV-1), plans `release-submit-rel-v0.1-plan` and `release-publishing-rel-v0.1-plan`.

## Session log

### Session 1 — 2026-10-11

- Plan created; mapping above. `npm pack --dry-run --json` on `3a74e9c`: 707 files, ~2.2 MB, no
  `dist/`, includes `export/`, `export1/`, `.idea/`, `.mcp.json`, `test/`, `docs/` → bug-007
  (`94109fe` add, `058ed45` submit → `open`). task-025 (`785ae00` submit → `pending`);
  `check_tasks.py` OK (25 tasks).
