---
id: task-002-launcher-and-http-server-skeleton
type: task
title: "Launcher and HTTP server skeleton"
status: pending
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-001-workspace-tooling-and-e2e-harness"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The `wingfoil-ui` command and the HTTP server skeleton: `bin` stub with the Node.js check, options, start sequence, loopback listeners on `127.0.0.1` and `::1`, browser opening without a shell, stop sequence and exit codes (spec-007); Fastify serving the static `web/` build and the `/api/` prefix (spec-004 §1).

**Backlog items:** TT-ARC-01, TT-PERF-06, TT-SEC-01, US-X-03

- US-X-03 — As a member, I want requests from other machines refused (loopback only), so that nobody on my network reads or acts on my projects

## Acceptance Criteria

- **TT-ARC-01** (REQ-ARC-01 — Local server on Node.js, run with npx): [boolean] On a machine with only Node.js 22.12 and git installed, `npx wingfoil-ui` serves the UI on 127.0.0.1; with Node.js 20.x it exits with a non-zero status and opens no port. *Verified by:* e2e-smoke `launch`.
  Scenarios (`@v0.1`): S-01.1, S-01.2, S-01.3.
- **TT-PERF-06** (REQ-PERF-06 — Server start): [numeric] ≤ 3.0 s in 10 out of 10 runs. *Verified by:* e2e-smoke `launch`.
  Scenarios (`@v0.1`): S-01.1.
- **TT-SEC-01** (REQ-SEC-01 — Loopback only): [boolean] Every listening socket of the server process is bound to a loopback address; a connection to the machine's network address is refused. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): X-03.1, X-03.2.
- **US-X-03** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/local-security.feature`: X-03.1 Listen on the loopback interface only; X-03.2 Refuse a connection on the machine's network address

## Implementation Notes

- `spec-007-launcher-command-line` (whole), `spec-004` §1; `adr-001` D8; `adr-002` (Fastify, pino).
- REQ-PERF-06: no project read before the URL is printed.
- Scenarios that need a screen are proved here by API and unit tests against the same
  fixtures; their e2e run closes in the `web` task that depends on this one.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
