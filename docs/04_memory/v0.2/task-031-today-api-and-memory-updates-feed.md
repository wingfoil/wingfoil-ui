---
id: task-031-today-api-and-memory-updates-feed
type: task
title: "Today API and Memory updates feed"
status: pending
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-PERF-11"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The Today output of spec-003 §5 served by `GET /api/p/:pid/today?view=<role>` — Requires you,
Waiting on others and the all-roles summary — with `actor.basis` (spec-003 §8), and the Memory
events feed `GET /api/p/:pid/events/memory?before=&limit=` for the bell's *Updates* (spec-004 §3,
spec-002 §1, §3). Builds on the existing placement (`server/src/descriptor/placement.ts`) and the
project-wide event parse (`server/src/git/memory-log.ts`). Server foundation of wave 1 (RP-43).

**Backlog items:** TT-PERF-11

## Acceptance Criteria

- **TT-PERF-11** (REQ-PERF-11 — Display limits): [numeric] Bell *Updates*: last 10 Memory events; all-roles summary: ≤ 3 items per role plus "N more". (v0.2 scope: *Recent activity* is a v0.3 card.) *Verified by:* e2e.
  Scenarios (`@v0.2`): S-21.1, S-23.4.
  Here: `summary[].items` holds at most 3 rows and `more` = `count − 3` when positive, else 0; `summary` is absent for a single-role member and for an unidentified user; `events/memory` defaults to `limit` 10, newest first, with `more`.

- Today output (spec-003 §5): for every fixture (kanban, custom, unknown) and every role view of
  each member, `requiresYou` equals the elements placed in Requires you by `placement()` in the
  §5 order (rejected work first, then oldest in state); `waitingOnOthers` excludes them (T-11.3);
  an unidentified user gets `view` and `requiresYou` `null` and Waiting on others computed as for
  a member holding no role (RP-27); `?view=` not in `roleViews` → 400 `invalid-request`.
- A warm `GET …/today` starts 0 processes (snapshot cache, `adr-001` D6).

e2e closure — S-21.1, S-23.4 close in task-042-notification-bell-all-roles-summary-and-empty-today; the Today rows close in task-036-today-requires-you-and-waiting-on-others.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

## Implementation Notes

- `spec-003` §5 (Today output, hand transitions declared waiting — RP-13), §8 (`actor.basis`:
  `submitter`, `creator`, `last-transition`); `spec-004` §3 (`today.schema.json`,
  `memory-events.schema.json`); `spec-002` §1, §3 (§4 incremental parse is v0.3, RP-9).
- The descriptor schema change (`actor.basis`) touches `contracts/api/descriptor.schema.json`;
  task-033-git-copy-state-repository-status-and-transport-routes later adds the copy-state reasons' computation (codes already in the schema).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
