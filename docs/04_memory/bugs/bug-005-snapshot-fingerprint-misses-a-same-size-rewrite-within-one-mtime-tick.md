---
id: bug-005-snapshot-fingerprint-misses-a-same-size-rewrite-within-one-mtime-tick
type: bug
title: "Snapshot fingerprint misses a same-size rewrite within one mtime tick"
status: resolved
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"       # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

The unit test `test/server/snapshot/fingerprint.test.ts` › "reads a file again only when its lstat
changed (review R2)" is flaky (2 failures in 5 runs at load < 1): it rewrites a file with content of
the same size (`one` → `ONE`) right after writing it, on a fingerprinter whose clock is set past the
racy window (`LATER`), so when both writes fall in one mtime tick the `lstat` is unchanged and the
cached mark is (correctly) kept.

## Steps to Reproduce

1. On `main` at `9535af6` (after task-015), machine idle (load average < 1).
2. Run `npx vitest run test/server/snapshot/fingerprint.test.ts` five times.

## Expected Behavior

The test passes deterministically: it proves that an entry is re-read when its `lstat` changes.

## Actual Behavior

2 runs out of 5 fail with `AssertionError: expected '56a4e8ad…' not to be '56a4e8ad…'` at the
`not.toBe(first)` after the rewrite (and `lastReads` stays 0).

## Evidence

- Post-merge checks of task-015 on `main` (2026-10-10): `test:coverage` 1685 passed, 1 failed (this
  test); five isolated re-runs at load 0.6: 3 pass, 2 fail.

## Notes

- No product code at fault: `server/src/snapshot/fingerprint.ts` already applies git's "racy git"
  rule (`RACY_WINDOW_MS`, review round 3 N1 of task-010) — a mark taken within 3 s of the file's
  mtime is not trusted. The test disables it on purpose (`LATER` clock) to count reads, but then
  makes a change that the `lstat` cannot see: same size, possibly same mtime tick.
- Proposed fix: make the change visible to `lstat` deterministically — different-size content, or
  an explicit `utimes` to a later mtime before the second fingerprint.
- Found during Wave 4 of v0.1 (plan `dev-loop-rel-v0.1-plan`, Session 4), post-merge checks of
  task-015. To be absorbed into task-016 (dl-045), decided by the user.

## Triage & Execution Notes
- triage (2026-10-10): approved by the user as **low** severity (flaky unit test, no product code at
  fault).
- fix: **absorbed into task-016-project-header-version-identity-and-role-view** (dl-045 pattern;
  the task lists this bug in `bug:` with its own Acceptance Criterion). `triaged → planned` set by
  hand (no CLI verb); it moves to `in-progress` when task-016 starts.
- start (2026-10-10): task-016 started (Wave 4) → `planned → in-progress` by hand (dev-loop `start` step `bug.sync_state`; no CLI verb for this edge).
