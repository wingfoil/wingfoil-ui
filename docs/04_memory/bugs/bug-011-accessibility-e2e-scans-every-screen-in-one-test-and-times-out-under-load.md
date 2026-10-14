---
id: bug-011-accessibility-e2e-scans-every-screen-in-one-test-and-times-out-under-load
type: bug
title: "Accessibility e2e scans every screen in one test and times out under load"
status: in-progress
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.2" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "web"          # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: "Firefox (Playwright)" # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

The accessibility e2e scenarios X-06.4 (axe scan) and X-09.1 (every string from the catalogue)
loop over every `SCREENS` entry inside one Playwright test, so their duration grows with each
screen a task appends and, under machine load, X-06.4 exceeds the 180 s test timeout on Firefox.

## Steps to Reproduce

1. Branch of task-036-today-requires-you-and-waiting-on-others (19 `SCREENS` entries after its
   two new screens), machine load about 27.
2. `npm run test:e2e -- test/e2e/accessibility.spec.ts` (three engines).
3. Firefox X-06.4 runs out the 180 s test timeout; the console is torn down and the next page
   load is refused.

## Expected Behavior

The default e2e gate is load-independent (bug-004, `test/README.md`): a scenario's duration does
not grow with the number of screens of the release, and adding a screen cannot push an existing
test past its timeout.

## Actual Behavior

`test/e2e/accessibility.spec.ts` X-06.4 runs `screen.open` plus `scanThemes` (both themes) for
every `SCREENS` entry in a single test; X-09.1 does the same for the catalogue check. Alone, X-06.4
takes about 2.1 min on Firefox and 2.0–2.1 min on Chromium and WebKit; under load it times out on
Firefox.

## Evidence

- task-036 Execution Notes (checks): own specs on three engines 257 passed, 1 failed (Firefox
  X-06.4, timeout at 180 s, load 27); `accessibility.spec.ts` re-run alone on Firefox: 10 passed,
  X-06.4 2.1 min.
- task-036 independent review, round 1, finding F3.

## Notes

- Severity low: test-only, no product defect; the scans pass when the run is not starved.
- Fix: generate one test per `SCREENS` entry, titled with the scenario id and the screen name,
  sharing one console per worker (worker-scoped fixture or `beforeAll`); the same for X-09.1.
  The e2e closure rows keep the scenario ids.
- Proposed absorption: task-036-today-requires-you-and-waiting-on-others (in progress; it brought
  `SCREENS` to 19), so the Wave 2 three-engine gate runs with the fix.

## Triage & Execution Notes
- fix: **absorbed into task-036-today-requires-you-and-waiting-on-others** (AC bug-011, `bug:`
  list of the task; the approver's triage, 2026-10-14); `triaged → planned` set by hand (directive
  `wingfoil-cli` W-26).
- 2026-10-14: `planned → in-progress` by hand (W-26), task-036 already in progress.
