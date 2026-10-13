---
id: bug-009-memory-list-e2e-reads-the-filter-names-once-and-fails-under-load
type: bug
title: "Memory list e2e reads the filter names once and fails under load"
status: resolved
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "web"          # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: "Chromium (Playwright 1.63.0)" # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

The Memory list e2e spec reads the type and state filter names once, without retrying, so under
machine load it compares a partly rendered filter list and fails (S-28.1 kanban saw 2 of 7 types).

## Steps to Reproduce

1. Load the machine (load average above ~20, e.g. a parallel `npm run test:coverage` in another
   checkout).
2. `npm run test:e2e` (Chromium).
3. S-28.1 kanban in `test/e2e/memory-list.spec.ts` may fail: the type filter holds 2 of the 7
   expected names.

## Expected Behavior

The test waits until the filter list shows what the user will read (retrying assertion) and
passes at any load; the default gates are load-independent (bug-004, dl-006 action 1).

## Actual Behavior

- `test/e2e/memory-list.spec.ts` `filterNames()` reads the links once with `evaluateAll`; the
  calls at S-28.1 (`expect(await filterNames(typeList(page))).toEqual(...)`) and two more
  single-shot calls in the same file do not retry. Only one call uses `expect.poll`.
- Seen on 2026-10-13 by the task-026 developer agent: `test:e2e` 128 passed, 1 failed (S-28.1
  kanban) at load ~25; the same file alone passed 21/21.

## Evidence

- task-026 Execution Notes (gate results of its `test:e2e` run); the file passes when run alone.

## Notes

- Severity low: test-only, no product defect; the list renders completely once the read ends.
- Fix: wrap every `filterNames` comparison in `expect.poll(...)` (or a retrying `toHaveText` on
  the filter links). Proposed absorption: task-027 (e2e on Firefox and WebKit), which runs the same
  spec on three engines.

## Triage & Execution Notes
- fix: **absorbed into task-027-e2e-suite-on-firefox-and-webkit** (AC-5, `bug:` list of the task;
  the approver's triage, 2026-10-13); `triaged → planned` set by hand (directive `wingfoil-cli`
  W-26).
