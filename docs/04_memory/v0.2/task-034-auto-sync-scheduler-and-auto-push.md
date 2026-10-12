---
id: task-034-auto-sync-scheduler-and-auto-push
type: task
title: "Auto sync scheduler and auto-push"
status: pending
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-PERF-07"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-030-ui-settings-store-and-settings-api", "task-032-governed-writes-submit-approve-and-reject", "task-033-git-copy-state-repository-status-and-transport-routes"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The auto-sync scheduler and auto-push of spec-010 §6: one timer ticking every
`fetchIntervalSeconds`, automatic fetch (killed after 60 s), the automatic update `merge --ff-only
… @{u}` right after a successful fetch (RP-41), and auto-push after each successful governed
write from the UI, reported in the write response's `push` field (spec-004 §5).

**Backlog items:** TT-PERF-07

## Acceptance Criteria

- **TT-PERF-07** (REQ-PERF-07 — Remote freshness): [numeric] Remote commit → "1 behind" (or fast-forward) within 65 s in 10 out of 10 trials; with auto-fetch off, 0 `git fetch` processes in 120 s. *Verified by:* e2e.
  Scenarios (`@v0.2`): Y-02.1, Y-05.2, C-07.3.
  Here: with the default interval, a commit pushed to the fixture's bare remote shows as `behind: 1` in `GET /api/p/:pid` (or is fast-forwarded with `autoUpdate` on) within 65 s in 10 of 10 trials; with `autoFetch` off the process audit counts 0 `git fetch` in 120 s. Both are elapsed-time runs: `test:timing` on Chromium (RP-44); the default suite and the e2e closures run with `fetchIntervalSeconds` = 15 (RP-53).

- Scheduler (spec-010 §6, RP-18, RP-40): scope = projects with an open snapshot, `has-remote` and
  a fetch target; one project at a time; an overlapping tick is skipped; a project whose write
  lock is busy is skipped (RP-41); a change of `autoFetch` or `fetchIntervalSeconds` re-arms the
  timer with one immediate tick (C-07.3 within 120 s), any other change is read at the next tick.
- Automatic fetch and auto-push killed after 60 s of process time (RP-20, RP-33) → `sync.fetch.lastError`
  / `push: {status: failed, code: push-timeout}`; the automatic update runs the §5 checks on a
  fresh status, only for an identified user (RP-14), and keeps a refusal in `sync.update.lastError`.
- Auto-push (RP-22): `push` = `off` | `pushed` | `failed` with git's `message` or a §5 `code`; a
  failed push never fails the write; there is no periodic push.
- Round-3 note of spec review: `server/src/git/git.ts` `GIT_ALLOWED_SUBCOMMANDS` gains `merge`
  (SARD REQ-INT-06 v0.10, always with `--ff-only`) and its "Never merge…" comment is corrected to
  "never a merge commit"; a unit test proves no merge commit even with `merge.ff=false`.

RP-53: Y-02.1, Y-02.3, Y-05.2 and C-07.3 run in `test:e2e` on the three engines with `fetchIntervalSeconds`
= 15 (its minimum, RP-19); the real 60 s interval and the 65 s / 120 s budgets are measured only
in `test:timing`, on Chromium (RP-44).

e2e closure — Y-02.1 closes in task-039-repository-status-and-fetch-in-the-sidebar; Y-05.2 in task-040-update-and-push-from-the-sidebar; C-07.3 in task-041-ui-settings-page-and-theme-setting; the
"pushed" toast (G-13.1) in task-038-submit-footer-action-toasts-and-blocked-actions; Y-07.3 in task-040-update-and-push-from-the-sidebar.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review. Scope: unattended processes (timeouts, process-group kills, nothing left running at stop),
auto-push target (never forced, upstream only).

## Implementation Notes

- `spec-010` §4 (automatic update row), §6, §9; `spec-004` §5 (`push` outcome, `push-timeout`);
  `spec-006` §2 (settings read at each tick); `adr-001` D5 and its 2026-10-12 note; SARD
  REQ-INT-06, REQ-ARC-03 class (c); directive `cli-only-writes` 1.6.
- RP-18, RP-19, RP-20, RP-22, RP-33, RP-40, RP-41.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
