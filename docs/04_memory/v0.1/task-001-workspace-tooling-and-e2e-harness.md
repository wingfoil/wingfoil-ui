---
id: task-001-workspace-tooling-and-e2e-harness
type: task
title: "Workspace tooling and e2e harness"
status: pending
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-INT-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Set up the npm workspaces `server/`, `web/`, `contracts/` with TypeScript, ESLint (typescript-eslint, the REQ-SEC-05 rule forbidding `exec`, `execSync` and `shell: true` in `server/`), Prettier, Vitest, Playwright with @axe-core/playwright on **Chromium** (REQ-INT-08 staged: three engines from v0.2), and the e2e fixture builder (`kanban`, `custom`, `unknown` fixtures with a bare remote, built with the pinned CLI, as `02_bdd/00_conventions.md` *Fixtures* defines). Every later task runs its tests on this harness.

**Backlog items:** TT-INT-08, TT-SEC-05

## Acceptance Criteria

- **TT-INT-08** (REQ-INT-08 — Supported browsers): [percentage] 100 % of the release's e2e scenarios pass on each of the three engines (v0.1: on Chromium). *Verified by:* e2e-smoke `drive-browser`.
  Scenarios (`@v0.1`): S-01.1, S-28.1, X-06.4.
- **TT-SEC-05** (REQ-SEC-05 — No shell): [boolean] A lint rule finds 0 uses of `exec`, `execSync` or `shell: true` in `server/`; a decision-log titled `x"; touch /tmp/pwned; "` is created with that literal title and `/tmp/pwned` does not exist. *Verified by:* lint · e2e.
  Scenarios (`@v0.1`): S-04.3.

## Implementation Notes

- `adr-002` (stack, tests and quality); BDD conventions `docs/02_requirements/02_bdd/00_conventions.md` (tags, fixtures, standard team).
- e2e on Chromium only in v0.1 (SARD `04` v0.4, REQ-INT-08 staged).
- Directive `wingfoil-cli` (W-01…W-20) for every CLI call made by the fixture builder.
- Scenarios that need a screen are proved here by API and unit tests against the same
  fixtures; their e2e run closes in the `web` task that depends on this one.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
