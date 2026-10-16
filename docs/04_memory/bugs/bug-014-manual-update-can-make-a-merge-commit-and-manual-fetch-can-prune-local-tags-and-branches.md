---
id: bug-014-manual-update-can-make-a-merge-commit-and-manual-fetch-can-prune-local-tags-and-branches
type: bug
title: "Manual update can make a merge commit and manual fetch can prune local tags and branches"
status: resolved
severity: "medium"     # REQUIRED — critical | high | medium | low
release-origin: "v0.2" # optional — release where the bug was FOUND, e.g. "v0.1"
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

The manual Update and Fetch of the git copy (task-033's `POST /api/p/:pid/git/update` and
`POST /api/p/:pid/git/fetch`, not yet released) follow the repository's own git configuration in
two harmful ways: `pull --ff-only` can create a two-parent merge commit that drops the incoming
changes (or stage them as a squash), and `fetch --prune` can delete local tags and, with a
mirror-style refspec and a detached HEAD, local branches with their reflogs.

## Steps to Reproduce

1. git 2.43.0; a project whose branch tracks `origin/<b>`, with the remote one commit ahead.
2. Update case: `git config branch.<b>.mergeOptions "-s ours"` (or `pull.twohead=ours`, or
   `branch.<b>.mergeOptions --squash`) in the project, then press Update (POST to the update route).
3. Fetch case A: `git config fetch.pruneTags true` and a local tag the remote lacks, then press
   Fetch (POST to the fetch route).
4. Fetch case B: a configured `remote.origin.fetch` refspec into `refs/heads/*`, HEAD detached
   (a rebase or bisect in progress) and a local branch the remote lacks, then press Fetch.

## Expected Behavior

spec-010 §4: an update only fast-forwards the branch to its upstream — never a merge commit,
never a staged squash; a fetch updates remote-tracking refs and prunes only those; local tags and
branches are never deleted.

## Actual Behavior

- Step 2: exit 0 with a two-parent merge commit that keeps the local tree (`-s ours`,
  `pull.twohead=ours`), or exit 0 with HEAD unchanged and the incoming change staged (`--squash`);
  the route answers success.
- Step 3: the local tag is deleted.
- Step 4: exit 0 and the local branch and its reflog are deleted (an unpushed commit is left only
  as a dangling object).

## Evidence

- task-034-auto-sync-scheduler-and-auto-push Execution Notes, `### design (2026-10-15)`, *What git
  actually does*, probes 3 and 8 (scratch repositories, `GIT_TRACE`).
- `server/src/git/transport.ts`: `fetchArgs` (`fetch --prune`) and `pullArgs` (`pull --ff-only`)
  carry no override for `branch.<b>.mergeOptions`, `pull.twohead`, `fetch.pruneTags` or
  `remote.<r>.pruneTags`.
- git documentation of `branch.<name>.mergeOptions`, `pull.twohead`, `fetch.pruneTags`.

## Notes

- Severity medium: data loss (dropped incoming changes, deleted local branches) on a user action,
  but only with non-default git configuration in the project.
- Fix (decided at task-034's design, D34-8 and D34-2/D34-5, the approver): the update gets
  `--no-squash --strategy=ort` and `--config-env=branch.<b>.mergeOptions=<an empty variable>`
  (`-c` is ignored for a branch name containing `=`); the fetch gets `-c fetch.pruneTags=false` and
  `--config-env=remote.<r>.pruneTags=<an empty variable>`; a manual fetch whose configured refspecs
  write outside `refs/remotes/` is refused with a 409 code of its own. Red tests reproduce each
  case first.
- Proposed absorption: task-034-auto-sync-scheduler-and-auto-push (Wave 4; it builds the same
  hardened arguments for the unattended runs and has an adversarial security review, RP-47).

## Triage & Execution Notes
- fix: **absorbed into task-034-auto-sync-scheduler-and-auto-push** (AC "bug-014", `bug:` list of the task; the approver's triage, 2026-10-15, D34-8); `triaged → planned` set by hand (directive `wingfoil-cli` W-26).
