---
id: bug-021-commit-provenance-checker-flags-the-origin-head-ref-that-git-2.48-and-later-create-on-fetch
type: bug
title: "Commit provenance checker flags the origin HEAD ref that git 2.48 and later create on fetch"
status: in-review
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

The commit-provenance checker of task-043 (`test/harness/commit-provenance.ts`) reports
`ref added or moved: refs/remotes/origin/HEAD` when git is 2.48 or later: from that version
`git fetch` creates `refs/remotes/<remote>/HEAD` by default (`remote.<name>.followRemoteHEAD`).
Test-only; it fails `test/harness/commit-provenance.test.ts` (3 tests) and would fail
`test/e2e/commit-provenance.spec.ts` on such a git.

## Steps to Reproduce

1. git 2.48 or later (the GitHub runner has 2.55.0; this machine 2.43.0).
2. `npm run test:coverage` (or the checker's self-test alone).
3. Locally with git 2.43: `git remote set-head origin main` in the session copy before the
   after-snapshot reproduces it.

## Expected Behavior

A remote-tracking `HEAD` symref that git creates or updates by itself is not a change caused by the
UI: the checker ignores `refs/remotes/<remote>/HEAD` (and still checks every other ref).

## Actual Behavior

The 3 self-test cases fail with `ref added or moved: refs/remotes/origin/HEAD`.

## Evidence

GitHub Actions run `39315562583` (the first `workflow_dispatch` dry run on `main` `08a84db`), job
`gate`, *Tests with coverage*: the 3 failures of `test/harness/commit-provenance.test.ts`, distinct
from bug-020's identity failures; found by task-044's design (D44-6).

## Notes

Approver (2026-10-19, D44-6 (a)): absorbed into task-044 with an added acceptance criterion; not
hidden with `followRemoteHEAD = never` in the harness configuration.

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->

- 2026-10-19 — triage (approver): `low`, test-only; absorbed into task-044 as AC-5 (D44-6 (a)).
