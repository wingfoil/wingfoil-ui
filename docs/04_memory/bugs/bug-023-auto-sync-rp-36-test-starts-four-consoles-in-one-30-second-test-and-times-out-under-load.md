---
id: bug-023-auto-sync-rp-36-test-starts-four-consoles-in-one-30-second-test-and-times-out-under-load
type: bug
title: "Auto-sync RP-36 test starts four consoles in one 30 second test and times out under load"
status: triaged
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.2"     # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"             # optional — server | web | contracts
wingfoil_version: "0.2.2"   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

`test/server/sync/auto-sync.test.ts` "RP-36 / D34-5: no remote, no fetch target, or a refspec
outside refs/remotes/ → skipped, …" (line 133) builds a fixture and starts four consoles one after
another inside one test with the 30 s budget; under heavy machine load it times out, so
`test:coverage` fails although the behaviour is right (a bug-004-class load sensitivity). Test-only.

## Steps to Reproduce

1. A loaded machine (1-minute load 20–26 on 12 cores, swap full).
2. `npm run test:coverage`.

## Expected Behavior

The default suite is load-independent (bug-004, task-026): each test's budget covers its own
work under load, or the test is split so each part has its own budget.

## Actual Behavior

Timed out at 30 s in three `test:coverage` runs of task-045 (2026-10-20, load 20–26); the file
passes alone (40/40). In the same runs `element-writes.test.ts` W2-5 and `snapshot/watcher.test.ts`
review F3 timed out once each.

## Evidence

task-045's Execution Notes (gates) and its independent review: unrelated to that task's diff.
The second `workflow_dispatch` dry run (run `39328350689`, GitHub runner) passed RP-36.

## Notes

Approver (2026-10-20): fix in release v0.3 (split the test, one console per case); input of the
v0.2 retrospective, together with the machine-free slot checking the load only at the start.

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->
