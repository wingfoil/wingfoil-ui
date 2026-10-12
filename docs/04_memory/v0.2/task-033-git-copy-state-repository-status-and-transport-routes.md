---
id: task-033-git-copy-state-repository-status-and-transport-routes
type: task
title: "Git copy state repository status and transport routes"
status: pending
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-STATE-04"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-031-today-api-and-memory-updates-feed", "task-032-governed-writes-submit-approve-and-reject"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Git sync on the server side, without the scheduler: the copy state (spec-010 §1) from the
existing status read, the repository-state key and `repo` event (§2), the repository status of
`GET /api/p/:pid` (§3), the manual transport routes `POST …/git/fetch`, `/git/update`, `/git/push`
(§4) with their refusals (§5) and preconditions (§8), the condition `has-remote` (§7, spec-001
§6), the copy-state reasons of the descriptor (spec-003 §6 rule 4) and row 8 of spec-004 §4 added
to the governed writes of task-032-governed-writes-submit-approve-and-reject. Also closes the server enforcement of REQ-SEC-08 across
governed writes, update and push (RP-48).

**Backlog items:** TT-STATE-04, TT-SEC-08

## Acceptance Criteria

- **TT-STATE-04** (REQ-STATE-04 — Governed actions refused on a stale or ambiguous copy): [percentage] 100 % of governed-action requests with the copy behind, diverged or on a detached HEAD get HTTP 409; after a successful fast-forward the same requests succeed. (v0.2 scope: the `ui.yaml` writes are v0.3.) *Verified by:* e2e · API test.
  Scenarios (`@v0.2`): G-12.1, G-12.2, G-12.3, Y-05.1, Y-06.1, Y-06.2, Y-01.3.
  Here: copy state per row of spec-010 §1 from recorded porcelain outputs (local upstream, upstream without tracking ref = `no-upstream`, RP-32); row 8 → 409 `stale-copy` under the write lock; update refusals of §5 (`detached-head`, `no-upstream`, `diverged`, `local-changes-in-the-way` with `detail.files` relative) → 409, 0 transport processes; a manual update is `pull --ff-only` and is not cancellable (RP-37).
- **TT-SEC-08** (REQ-SEC-08 — Read-only for unidentified users, enforced by the server): [percentage] 100 % of governed-write, update and push requests from such users get HTTP 403 and start 0 processes; a fetch (it changes only remote-tracking refs) and the per-user local settings are not in scope; every listed scenario passes. *Verified by:* e2e · API test.
  Scenarios (`@v0.2`): S-13.2, S-15.2, T-01.2, C-08.1, C-08.2, C-09.1, C-09.2.
  Here (RP-48, RP-14, RP-34): for each identity kind `not-in-team`, `no-identity`, `ambiguous`, every governed write, update and push → 403 `not-in-team` with 0 processes; a fetch is allowed.

- Transport (spec-010 §4): argument arrays exactly as the table (no `+`, `--ff-only`, `--prune`,
  `--no-recurse-submodules`, `CLONE_SETTINGS`, `--no-optional-locks`), environment with
  `GIT_TERMINAL_PROMPT=0` and `GIT_SSH_COMMAND=ssh -o BatchMode=yes` only when no ssh command is
  configured (RP-24); fetch target per RP-36 (`no-fetch-target` otherwise); fetch and push
  cancellable (process group killed on abort, RP-37); git failure → 422 `git-refused`, message
  kept in `sync.*.lastError`, never logged or stored; nothing to do → 200, no process.
- Key and events (spec-010 §2, RP-40): the key changes on `branch.ab`, upstream and remote-list
  changes, not on a re-read of the same state; `repo` is sent when the copy state or a last error
  changes, never for a new `lastSuccessAt` alone.
- REQ-INT-06 process audit: every git process uses an allowed subcommand.

e2e closure — G-12.1, G-12.2, G-12.3, Y-05.1, Y-06.1, Y-06.2 close in task-040-update-and-push-from-the-sidebar; Y-01.3 in
task-039-repository-status-and-fetch-in-the-sidebar; S-13.2, S-15.2 in task-037-gate-footer-with-every-outcome; T-01.2 in task-036-today-requires-you-and-waiting-on-others; C-08.1, C-08.2, C-09.1, C-09.2 in
task-035-how-to-join-panel (those screens rely on the v0.1 identity and row 5 of task-032-governed-writes-submit-approve-and-reject; this task adds the API
proof over all five routes).

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review. Scope: argument and ref injection through remote and branch names, `ext::`/`fd::`
transports, `GIT_SSH_COMMAND` handling, credentials in errors and logs, hooks during pull/push
(RP-23).

## Implementation Notes

- `spec-010` §1–5, §7, §8, §9; `spec-004` §3 (`repository.schema.json`, `project.schema.json`
  `conditions`, `git.response.schema.json`), §4 row 8 and v0.2 note, §5 git codes, §6 `repo`;
  `spec-001` §6 project conditions; `spec-003` §6 rule 4; `adr-001` D5, D7.
- RP-14, RP-21 (fetch under the write lock), RP-23, RP-24, RP-25, RP-32, RP-34, RP-35, RP-36,
  RP-37. The `merge` subcommand and the `git.ts` comment belong to task-034-auto-sync-scheduler-and-auto-push.
- Every new refusal code gets its `error.<code>` key in the web catalogue (spec-008 §4).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
