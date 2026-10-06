---
id: bug-002-inherited-git-variables-redirect-git-and-cli-reads-to-another-repository
type: bug
title: "Inherited GIT variables redirect git and CLI reads to another repository"
status: in-progress
severity: "medium"     # REQUIRED — critical | high | medium | low
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

The server starts `git` and the observed project's `wingfoil` CLI with the full environment it was
launched with, so repository-locating variables inherited from the parent shell (`GIT_DIR`,
`GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_CONFIG_PARAMETERS`, …) make every project answer for one
other repository.

## Steps to Reproduce

1. Any listed project (e.g. the kanban fixture, WingFoil 0.2.2) plus a second, unrelated git
   repository `other/`.
2. Start the console from an environment that exports `GIT_DIR=other/.git` (a git hook,
   `git rebase -x`, a `GIT_DIR=~/.dotfiles` setup) — e.g. `GIT_DIR=other/.git npx wingfoil-ui`.
3. Open the project: identity, repository state, local-changes markers and CLI reads.

## Expected Behavior

Every git read and every CLI process answers for the project folder it was started in; the user's
own git configuration choices (`HOME`, `GIT_CONFIG_GLOBAL`, `GIT_CONFIG_NOSYSTEM`) still apply.

## Actual Behavior

`git config --get user.email`, `git rev-parse`, `git status` (and the CLI's own git calls) read
`other/`: every project shows the same identity, state key and markers (REQ-SEC-08,
REQ-STATE-01/02 wrong). From v0.2 a governed write could commit in the wrong repository.

## Evidence

- task-009 review (2026-10-05): `server/src/identity/project-identity.ts` runs git with
  `process.env`; the test harness hides it (`test/harness/fixtures/builder.ts:70` strips `GIT_*`).
- task-010 review (2026-10-06): `server/src/snapshot/snapshots.ts:113` (`env ?? process.env`),
  `server/src/process/runner.ts:131`; `git rev-parse --absolute-git-dir --git-common-dir` with
  `GIT_DIR=other/.git` returns the other repository.

## Notes

- Fix: one shared helper (`gitEnv(env)`) that drops the repository-locating and config-injecting
  `GIT_*` variables (case-insensitive) and keeps `HOME`, `GIT_CONFIG_GLOBAL`,
  `GIT_CONFIG_NOSYSTEM`, applied to every git read and to the `wingfoil` CLI processes.
- Found in the Wave 2 dev-loop reviews of v0.1 (plan `dev-loop-rel-v0.1-plan`, Session 2); outside
  the scope of task-009, hence this bug (user rule). To be absorbed into task-010 (owner of the
  shared git module), decided by the user 2026-10-06.

## Triage & Execution Notes

- triage (2026-10-06): approved by the user as **medium** severity (wrong identity/state for every
  project when the server inherits `GIT_DIR` & co.; from v0.2 a write could hit the wrong repository).
- fix: **absorbed into task-010-snapshot-cache-and-live-updates** (dl-045 pattern; the task owns the
  shared git module and lists this bug in `bug:`, with its own Acceptance Criterion). `triaged →
  planned` set by hand (waiting state, no CLI verb).
- start (2026-10-06): task-010 is already in progress (Wave 2) → `planned → in-progress` by hand
  (dev-loop `bug.sync_state`; no CLI verb for this edge).
