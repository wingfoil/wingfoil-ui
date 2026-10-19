---
id: bug-012-cli-refusal-messages-can-quote-the-repository-s-absolute-path
type: bug
title: "CLI refusal messages can quote the repository's absolute path"
status: resolved
severity: "low"        # REQUIRED — critical | high | medium | low
release-origin: "v0.2" # optional — release where the bug was FOUND, e.g. "v0.1"
release: "v0.2"            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"       # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

A refusal of the pinned CLI is answered as 422 `cli-refused` with the CLI's message verbatim, and
that message can quote the repository's absolute local path (a failed git command or a Node.js
file error), so the path reaches the browser.

## Steps to Reproduce

1. Any listed project with `wingfoil@0.2.2`.
2. Make a CLI call of the server fail inside one of its git commands or on a file read, e.g. a
   read route (`dna show`, `memory search`, `memory history`, …) or a governed write whose
   element file disappears between the server's fresh check and the CLI's own read.
3. Read the 422 body of the route.

## Expected Behavior

No local absolute path in an HTTP body (spec-004 §5: details of the machine only in the server
log, and since task-032 W2-1 not even there): the CLI's message still reaches the user
(REQ-INT-04, the CLI owns the rules), with the repository's path replaced by a repo-relative
form or a neutral placeholder.

## Actual Behavior

`cliErrorEnvelope` in `server/src/cli/adapter.ts` maps kind `refused` to
`envelope('cli-refused', error.message)`, and `GovernedWrites.write` in
`server/src/writes/governed.ts` returns the CLI's reason refusal the same way. The pinned CLI wraps
a failed git command as `Command failed: git -C <the repository's path> …` and a file error with
its path, so the body can carry the absolute path of the repository.

## Evidence

- task-032-governed-writes-submit-approve-and-reject Execution Notes, *Other `cli-refused`
  answers that can carry a local absolute path* (reported, not changed).
- `dev-loop-rel-v0.2-plan` Session 3, *Open points*.

## Notes

- Severity low: the server is loopback-only with a session token (spec-007), so the reader is the
  user of the same machine; the path is theirs. It still contradicts the rule that machine
  details stay out of HTTP bodies, and a screenshot or a shared log would carry it.
- The governed-write paths that commit before failing are already covered by task-032 W2-1,
  W2-4, W2-5 (`write-incomplete`, fixed message).
- Fix: one server-side redaction of the repository root (and the CLI's own install path) in
  every `cli-refused` message, at the single mapping point, with a test per route family and a
  marker path; the CLI's wording stays otherwise verbatim.
- Proposed absorption: task-033-git-copy-state-repository-status-and-transport-routes (Wave 3; it
  adds the git transport routes and their refusals, and edits the same refusal mapping).

## Triage & Execution Notes
- fix: **absorbed into task-033-git-copy-state-repository-status-and-transport-routes** (AC "bug-012", `bug:` list of the task; the approver's triage, 2026-10-15); `triaged → planned` set by hand (directive `wingfoil-cli` W-26).
- 2026-10-15: `planned → in-progress` by hand (W-26), task-033 already in progress.

- 2026-10-19 — close (release validation of minor-v0.2, `e2e-smoke-rel-v0.2-plan` step 4): fixed by
  task-033 (`done`); its tests are green in the e2e-smoke run on `b286ab9` (`test:coverage` 3213 passed /
  1 skipped, `test:e2e` 935 passed on Chromium, Firefox and WebKit, `test:smoke` 4/4,
  `test:publish-smoke` 11/11); `release` stamped `v0.2` (RV2-2). Closed by the approver from the WingFoil UI console (ES2-1).
