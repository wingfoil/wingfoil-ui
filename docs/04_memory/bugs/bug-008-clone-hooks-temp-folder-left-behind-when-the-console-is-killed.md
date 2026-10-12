---
id: bug-008-clone-hooks-temp-folder-left-behind-when-the-console-is-killed
type: bug
title: "Clone hooks temp folder left behind when the console is killed"
status: planned
severity: "low"           # REQUIRED — critical | high | medium | low
release-origin: "v0.1"     # optional — release where the bug was FOUND, e.g. "v0.1"
release: "v0.2"            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: "S2"            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"             # optional — server | web | contracts
wingfoil_version: "0.2.2"   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

The empty hooks folder every clone uses (`/tmp/wfui-no-hooks-*`, `server/src/projects/clone.ts`
`noHooksDir`) is removed only on the process `exit` event, so a console stopped by a signal it
does not handle (SIGKILL, or the e2e reaper killing the process group) leaves it behind.

## Steps to Reproduce

1. Start the console; add a remote project (clone) so `noHooksDir()` creates the folder.
2. Kill the console with `kill -9 <pid>` (or let the e2e reaper kill a console after a clone test).
3. `ls -d /tmp/wfui-no-hooks-*`: the folder is still there.

## Expected Behavior

No temporary folder of the console outlives it, or a stale one is removed at the next start; at
most one exists per running console.

## Actual Behavior

- `clone.ts:105-116`: `mkdtemp(os.tmpdir()/wfui-no-hooks-)`, removed by
  `process.once('exit', rmSync…)` — not run on SIGKILL or a crash.
- 174 empty folders (mode 0700, no data) found in `/tmp` on 2026-10-11, created 2026-10-10/11 by
  test runs (e2e clone tests, Vitest workers).
- Also seen: `/tmp/wfui-e2e-fx-*` (7) and `/tmp/wfui-e2e-large-*` (1) from the e2e support
  (`test/e2e/support/fixtures.ts`, `test/harness/fixtures/large.ts`) — test-side, same cause to check.

## Evidence

- Found by the independent reviewer of task-025, round 2 (2026-10-11), while checking that its
  runs left nothing behind; the folders pre-date that run.

## Notes

- Severity low: the folder is empty and private (0700); a console stopped normally (Ctrl-C,
  SIGTERM via the launcher's stop handling) removes it.
- Options: (a) create it under the console's own state/run directory and remove stale ones at
  start; (b) reuse a fixed per-user path instead of `mkdtemp`; (c) pass an empty hooks path with
  `-c core.hooksPath=` pointing to a non-existent or `/dev/null`-like location if git accepts it
  (to be checked with git itself). Plus the e2e support cleaning its fixture folders on teardown.
- Planned for v0.2 by the approver (2026-10-11); listed as a known limitation of v0.1 at release
  submit.

## Triage & Execution Notes
- fix: **planned into task-026-load-independent-tests-and-one-temp-folder-convention**
  (release-planning v0.2 build-backlog, plan `release-planning-rel-v0.2-plan` RP-42; dl-006
  action 1; `bug:` list of the task). `triaged → planned` set by hand (directive `wingfoil-cli`
  W-26).
