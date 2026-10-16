---
id: bug-015-catalogue-strings-e2e-check-can-miss-an-api-answer-under-load-and-flag-data-as-uncatalogued-text
type: bug
title: "Catalogue strings e2e check can miss an API answer under load and flag data as uncatalogued text"
status: in-review
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "web"          # optional — server | web | contracts
wingfoil_version: ""   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: "Firefox (Playwright)" # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

The X-09.1 e2e check (every string on a screen comes from the message catalogue) can miss an API
answer under heavy load and then reports data shown by the page — the type filters that only
`GET /config` declares — as text outside the catalogue.

## Steps to Reproduce

1. Load average far above the core count (158 on 12 cores in the observed run).
2. `npm run test:e2e -- accessibility.spec.ts` (with other specs in the same run).
3. Firefox, "X-09.1 — Render every string from the message catalogue: memory list".

## Expected Behavior

The check compares the page's texts with the catalogue and with every API answer the page used;
data shown by the page is never reported, whatever the load (load-independent default gates,
bug-004).

## Actual Behavior

The test failed once listing the 0-element type filters (`adr`, `decision-log`, `release`,
`release-line`, `tech-spec`) as uncatalogued text. Re-run alone at load 156 (Firefox,
`-g 'X-09.1' --repeat-each=3`): 69 passed, the memory list screen 3/3.

## Evidence

- task-042-notification-bell-all-roles-summary-and-empty-today Execution Notes, review round 2
  (the three-engine run: 245 passed, 1 failed) and review round 3 (analysis).
- `test/e2e/support/strings.ts` `recordApiData`: answers are learnt only through
  `page.on('response')`; `strings()` awaits only the parses already pending when it is called; a
  failed `response.json()` is swallowed (`() => {}`). `test/e2e/accessibility.spec.ts`: the
  comparison runs once, without a retry.

## Notes

- Suspected root cause: in Firefox the `response` event of `GET /config` can reach the test after
  the page already shows the filters and the check has started; or the body read fails under load
  and the answer is lost silently. Pre-existing (v0.1 test support); task-042's extra
  `GET /today` adds one more answer to parse but does not cause it.
- Suggested fix: retry the comparison (`expect.poll(..., { timeout: COLD_READ_MS })`), and/or wait
  explicitly for the screen's `GET /config` answer; record a failed body read instead of
  swallowing it, so the check fails with the real cause.
- Severity low: a test-only false failure under extreme load; the product is not affected.

## Triage & Execution Notes
- fix: **absorbed into task-042-notification-bell-all-roles-summary-and-empty-today** (AC "bug-015", `bug:` list of the task; the approver's triage, 2026-10-15); `triaged → planned` set by hand (directive `wingfoil-cli` W-26).
