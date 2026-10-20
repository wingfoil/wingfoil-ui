---
id: bug-022-project-list-sanitiser-test-depends-on-git-quoting-the-gitdir-path-and-git-2.55-prints-null
type: bug
title: "Project list sanitiser test depends on git quoting the gitdir path and git 2.55 prints null"
status: resolved
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

The bug-017 test "add: git quoting a gitdir with control and bidi characters"
(`test/server/http/projects.test.ts:1141`) expects git to quote the `gitdir:` path of a loose
`.git` file in its refusal, so that the sanitiser shows U+202E as `\u202e`; git 2.55 prints
`fatal: not a git repository: (null)` instead, without the path, and the test fails. Test-only:
the sanitiser still passes no raw character (the test's first assertion holds).

## Steps to Reproduce

1. git 2.55 (the GitHub runner); this machine has 2.43, where git quotes the path.
2. `npm run test:coverage` (or the file alone).

## Expected Behavior

The test proves the sanitiser on git's refusal text with every supported git version: it drives a
refusal whose text quotes data the test chose, without depending on one message's format and
without a branch on the git version.

## Actual Behavior

`AssertionError: expected 'fatal: not a git repository: (null)' to contain '\u202e'`.

## Evidence

GitHub Actions run `39328350689` (the second `workflow_dispatch` dry run, `main` `f73294e`, after
task-044): job `gate`, *Tests with coverage*: 1 failed, 3219 passed, 1 skipped — the only failure.

## Notes

Approver (2026-10-19): a compact test-only governance task (task-045), then a third dry run.

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->

- 2026-10-19 — triage (approver): `low`, test-only; absorbed into task-045.
