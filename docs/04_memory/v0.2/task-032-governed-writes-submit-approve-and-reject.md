---
id: task-032-governed-writes-submit-approve-and-reject
type: task
title: "Governed writes submit approve and reject"
status: pending
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-STATE-03"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-030-ui-settings-store-and-settings-api"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The first governed writes: `POST /api/p/:pid/elements/:eid/submit`, `/approve`, `/reject`
(spec-004 §3) through the CLI adapter (`memory submit`, `memory approve --reason`, `memory reject
--reason`), under the per-project write lock, with the preconditions of spec-004 §4 rows 1–7 and
9 (row 8 is added by task-033-git-copy-state-repository-status-and-transport-routes), the write response of §5 (`push` in its full shape, `status:
off` until task-034-auto-sync-scheduler-and-auto-push), the `write` event of §6, and the action log of spec-006 §2 (REQ-SEC-10).

**Backlog items:** TT-STATE-03, TT-SEC-10

## Acceptance Criteria

- **TT-STATE-03** (REQ-STATE-03 — Governed actions refused on local changes): [percentage] 100 % of governed-action requests on an element with local changes get HTTP 409 and start 0 CLI processes, including requests sent directly to the API. *Verified by:* e2e · API test.
  Scenarios (`@v0.2`): G-11.1, G-11.2, G-11.3, X-07.3.
  Here: API tests on copies of the fixtures — an element file with local changes (modified, staged, untracked) → 409 `local-changes`, 0 `wingfoil` processes, evaluated from a fresh `git status` under the write lock; a change to another file does not refuse (G-11.3).
- **TT-SEC-10** (REQ-SEC-10 — Dogfooding): [percentage] Between the v0.2 and the v0.3 releases, ≥ 80 % of the approve/reject commits of this repository have their hash in the server's local action log (hash and time, no other data). (v0.2 scope: this repository.) *Verified by:* retrospective (`wf(…)` history).
  Scenarios (`@v0.2`): G-04.1.
  Here (RP-45): every commit of `commits[]` of a successful governed write is appended to `actionLog` as `{sha, at}`, capped by `actionLogCap`; a script (e.g. `scripts/action-log-ratio.mjs`) computes the ratio of this repository's `wf(…)` approve/reject commits in a range found in a given state file; the number itself is recorded at the retrospective after v0.2 (hand transitions are outside it, RP-13).

- Preconditions (spec-004 §4): rows 1–4 and 6 start no process; row 5 (user not identified) → 403
  `not-in-team`, 0 processes (RP-48: the record TT-SEC-08 is closed by task-033-git-copy-state-repository-status-and-transport-routes); row 9
  (`expectedStatus` differs) → 409 `element-changed`, no CLI process; a blank `reason` → 400
  `invalid-request` (G-07.2); a CLI refusal → 422 `cli-refused` with the CLI's message verbatim
  (REQ-INT-04); success → 200 `write.response.schema.json` and one `write` event.
- REQ-SEC-05: the reason (user input) reaches the CLI as one argument, never through a shell
  (`SHELL_PAYLOAD` probe of `test/README.md`); REQ-ARC-03: every commit is a CLI `wf(…)` commit.

e2e closure — G-11.1, G-11.2, G-11.3, X-07.3 close in task-038-submit-footer-action-toasts-and-blocked-actions; G-04.1 in task-037-gate-footer-with-every-outcome.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

Review: adversarial security review (dl-006 action 6, RP-47) — a reviewer who runs the tool itself tries to break the task's guards, besides the independent review.

## Implementation Notes

- `spec-004` §3 (element write routes, `element.submit.request`, `element.decision.request`,
  `write.response`), §4 rows 1–7, 9, §5, §6 (`write`); `spec-006` §2 (`actionLog`); `spec-003` §6
  (the server re-evaluates enablement on every write); `spec-001` §3 (`memory submit`/`approve`/
  `reject` already in `server/src/cli/commands.ts`); `adr-001` D5 (write lock), D7; directive
  `cli-only-writes`; dl-002 (permissions left to WingFoil: the role is not checked by the server).
- W-24: `memory submit` commits the target's uncommitted edits — hence the fresh row-7 check.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
