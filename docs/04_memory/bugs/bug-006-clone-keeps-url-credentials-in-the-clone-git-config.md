---
id: bug-006-clone-keeps-url-credentials-in-the-clone-git-config
type: bug
title: "Clone keeps URL credentials in the clone git config"
status: triaged
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

`POST /api/projects/clone` with a URL that carries credentials (`https://user:password@host/repo.git`)
runs `git clone -- <url> <dir>` as given: the password ends up in plain text in the clone's
`.git/config` (`remote.origin.url`) and is visible in the process list while git runs.

## Steps to Reproduce

1. Start the console; open *Add project…* → *Remote git repository*.
2. Enter a URL with userinfo, e.g. `http://alex:s3cret@127.0.0.1:<port>/private.git` (a local
   HTTP remote with Basic auth, as in task-014's S-07.3 test support `test/e2e/support/git-http.ts`)
   and a working directory; confirm.
3. After the clone: `git -C <dir> config remote.origin.url`; while it runs: `ps -ef | grep clone`.

## Expected Behavior

The console never persists a credential it was given (directive security-secrets): the clone's
`origin` holds the URL without userinfo (as the project list already does via `stripUserinfo`),
and the password is not exposed in a process command line — or URLs with a password are refused
with a catalogue reason pointing to a credential helper.

## Actual Behavior

- `remote.origin.url` = `http://alex:s3cret@127.0.0.1:<port>/private.git` (git's default behaviour).
- The `git clone` command line (`server/src/git/git.ts` `cloneArgs`) holds the URL with the password.
- The UI's state is already clean: `server/src/state/store.ts` `stripUserinfo` removes the userinfo
  from the stored `remote`, and the add-project dialog strips it from the progress line (task-014,
  review R1).

## Evidence

- Found in the review of task-014 (Wave 4, 2026-10-10), round 1, while checking that the S-07.3
  credentials are never echoed; code path `server/src/projects/clone.ts` → `cloneArgs(url, …)`.

## Notes

- Options: (a) after a successful clone, `git -C <dir> remote set-url origin <url without
  userinfo>` (the password still appears in `ps` during the clone); (b) pass the credentials through
  a one-shot credential helper / `GIT_ASKPASS` env and clone the stripped URL (nothing on the command
  line or on disk); (c) refuse URLs with a password (`error.*` key + catalogue text suggesting SSH or a
  credential helper). Spec impact: spec-006 §3 (a new refusal code for c) or spec-004 §3.
- Severity low: the user typed the credential into their own local console for their own clone;
  git itself behaves the same from the command line.
- Fix outside Wave 4 (task-008's ground): decided by the user when triaging.

## Triage & Execution Notes
