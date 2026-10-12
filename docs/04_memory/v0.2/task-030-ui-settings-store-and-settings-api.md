---
id: task-030-ui-settings-store-and-settings-api
type: task
title: "UI settings store and settings API"
status: pending
release: "v0.2"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.2"]               # optional — additional labels, e.g. [today, a11y]
ref: "TT-STATE-09"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The UI settings of C4 in the local state store and their API: the `settings` keys, types,
defaults and ranges of spec-006 §2, the `actionLog` field with its cap (`actionLogCap`, trimmed
when the cap is lowered), `GET /api/settings` and `PUT /api/settings` (the whole object, RP-28),
and the `settings` event of spec-004 §6. Server foundation of wave 1 (RP-43).

**Backlog items:** TT-STATE-09

## Acceptance Criteria

- **TT-STATE-09** (REQ-STATE-09 — UI settings defaults): [boolean] A first start shows exactly these defaults; changing one takes effect within 120 s without a restart. *Verified by:* e2e.
  Scenarios (`@v0.2`): C-07.1, C-07.3, Y-07.2.
  Here: a first start (no `settings` in `state.json`, or a v0.1 file with `{}`) reads exactly the defaults of spec-006 §2; a stored value of the wrong type or out of range reads as its default, an unknown key is dropped at the next write (RP-39); `PUT` with any key missing, a wrong type or an out-of-range integer → 400 `invalid-request`, nothing stored; a valid `PUT` → 200 with the stored settings and one `settings` event; lowering `actionLogCap` trims the oldest `actionLog` entries in the same write (RP-38). The "within 120 s" part is proved by task-034-auto-sync-scheduler-and-auto-push.

e2e closure — scenarios that need a screen are proved here by API and unit tests and close in:
task-041-ui-settings-page-and-theme-setting: C-07.1, C-07.3; task-040-update-and-push-from-the-sidebar: Y-07.2.

Cross-cutting: the task's `contracts/api` schemas are committed first (RP-43) and checked against every response of its routes; every new `/api/` route adds its rows to `test/launcher/local-security.test.ts` (REQ-SEC-02/03); process audits as in `test/server/snapshot/support.ts` (`AuditedRunner`).

## Implementation Notes

- `spec-006` §2 (settings table, `actionLog`), §4 (lock, atomic write), §5 (no secret); `spec-004`
  §3 (`settings.schema.json`), §4 v0.2 note (`PUT /api/settings`: rows 1, 2, 4), §6 (`settings`);
  `contracts/state/state.schema.json` gains `settings` and `actionLog` shapes.
- RP-19 (`fetchIntervalSeconds` 15–3600, default 60), RP-26 (`actionLogCap` 100–100 000, default
  5 000), RP-28, RP-38, RP-39; RP-15 (`confirmAgentLaunch` stored, effective from WingFoil 0.3).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
