---
id: bug-018-cancel-in-the-gate-footer-opened-from-today-moves-the-focus-to-the-main-region-instead-of-the-today-action-that-opened-the-panel
type: bug
title: "Cancel in the gate footer opened from Today moves the focus to the main region instead of the Today action that opened the panel"
status: triaged
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.2"     # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "web"             # optional — server | web | contracts
wingfoil_version: "0.2.2"   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: "Chromium (Playwright), keyboard, mouse and Escape"            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

When the element panel is opened from a Today action and its gate footer is closed with *Cancel*
(or Escape, or a mouse click on Cancel), the focus lands on the main region (`main#main`) instead
of returning to the Today action that opened the panel; keyboard users lose their place in Today.

## Steps to Reproduce

1. A kanban fixture copy (`wingfoil@0.2.2`) with `task-001-login-form` pending its gate; the console
   as a member holding `approver` (Morgan), on Today.
2. Focus the Today action "Approve task-001-login-form" and press Enter: the element panel opens with
   the gate footer, the reason field focused.
3. Tab to *Cancel* and press Enter (or press Escape, or click *Cancel*).

## Expected Behavior

The panel closes and the focus returns to the control that opened it — the Today action — as the
Memory list does for its rows (X-06.3, v0.1) and as the UX reference asks for panels ("return
focus"); `#main` only when that control no longer exists.

## Actual Behavior

The focus moves to `main#main` in all three ways of closing.

## Evidence

Probe at task-043 design (2026-10-18, Chromium, a scratch spec through the machine-free slot, 4
passed, file deleted): `document.activeElement` after Cancel is `main#main`. spec-003 §6 says
nothing about Cancel; `docs/00_reference/ux-reference.md` §4.2 says "return focus" without a target;
X-06.3 (v0.1) names the opener for the Memory list.

## Notes

Found by task-043 (e2e-smoke gaps of v0.2, AC-3) while designing the keyboard Cancel walk; decision
D43-5 option (a) (the approver, 2026-10-18): the opener is the target, the current behaviour is a
defect, absorbed into task-043 (a small `web/src/today/` change mirroring the Memory list, red test
first). Suspected cause: Today opens the panel through navigation without recording its opener.

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->
