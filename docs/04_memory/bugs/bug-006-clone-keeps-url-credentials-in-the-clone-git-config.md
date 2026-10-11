---
id: bug-006-clone-keeps-url-credentials-in-the-clone-git-config
type: bug
title: "Clone keeps URL credentials in the clone git config"
status: closed
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
- triage (2026-10-10): approved by the user as **low** severity.
- fix: **absorbed into task-021-accessibility-page-title-and-performance-pass** (dl-045 pattern;
  `bug:` list + its own Acceptance Criterion), option (c) decided by the user: refuse clone URLs
  carrying a password with a new spec-006 §3 refusal code. `triaged → planned` set by hand (no CLI
  verb); it moves to `in-progress` when task-021 starts.
- start (2026-10-10): task-021 started (Wave 5) → `planned → in-progress` by hand (bug.sync_state; no CLI
  verb); it is submitted together with task-021.
- fix (2026-10-11, task-021): `POST /api/projects/clone` refuses a URL holding credentials with 422
  `credentials-in-url` (spec-006 §3, no `detail`, catalogue `error.credentialsInUrl` with the SSH /
  credential-helper hint). The check runs before any file-system, state or git work, so nothing is
  cloned and no credential reaches a command line, a file or the state.
  - Decisions: W5-14 (code), W5-15 (any userinfo in http(s)/ftp(s)), W5-18 (a password in `ssh://`
    and scp-like addresses), W5-19 (any userinfo in `git://`).
  - Hardening across review rounds 1–3: the `<transport>::<address>` form; any slashes or
    backslashes after the scheme; a percent-encoded `:`; control characters refused as an invalid
    request (400).
  - Commits on the task branch: `5aa9f5b`, `b31dc0d`, `9c780e2`, `b53c0ee` (W5-18), `902fc8e`; tests in `test/server/projects/remote.test.ts`,
    `test/server/http/projects.test.ts`, `test/server/state/store.test.ts` and
    `test/e2e/add-project.spec.ts` › "bug-006 — Refuse a clone URL holding credentials".
- close (2026-10-11): fixed by task-021 (`done`); its tests green in the e2e-smoke run on `main`
  `0d719fe` (incl. `add-project.spec.ts` › "bug-006 — Refuse a clone URL holding credentials") —
  release validation of minor-v0.1 (plan `e2e-smoke-rel-v0.1-plan`, RV-5). The two accepted limits (scp-like `@` in the path without `/`; unknown schemes reaching
  `git clone`) are known limitations of v0.1 (`docs/user-guide.md`, `CHANGELOG.md`).
  → `resolved → closed`.
