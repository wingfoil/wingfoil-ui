---
id: bug-013-clone-runs-ext-transport-commands-when-git-allow-protocol-allows-them
type: bug
title: "Clone runs ext transport commands when GIT_ALLOW_PROTOCOL allows them"
status: open
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

When the server's environment holds `GIT_ALLOW_PROTOCOL` with `ext`, the clone of an `ext::` URL
runs the URL's command, although the clone passes `-c protocol.allow=never`: the variable
overrides the configuration settings and `gitEnv` keeps it.

## Steps to Reproduce

1. git 2.43.0; start the console with `GIT_ALLOW_PROTOCOL=ext` in its environment.
2. Add a project by cloning the URL `ext::sh -c touch% <a marker file>` (POST to the clone route).
3. The marker file exists.

## Expected Behavior

A clone accepts only the transports the server allows (`https`, `http`, `ssh`, `git`, `file`),
whatever the environment or the user's git configuration says (spec-004, v0.1 clone guards):
`ext::` is refused before any command of the URL runs.

## Actual Behavior

`CLONE_SETTINGS` in `server/src/git/git.ts` sets `protocol.allow=never` plus per-protocol
allowances, but git gives `GIT_ALLOW_PROTOCOL` precedence over `protocol.<name>.allow` and
`protocol.allow`; `gitEnv` strips the `GIT_*` variables that redirect the repository, not this
one. The `ext::` helper runs the command.

## Evidence

- task-033-git-copy-state-repository-status-and-transport-routes Execution Notes,
  `### design (2026-10-15)`, *git facts* (probe in a scratch repository, marker written).
- git documentation of `GIT_ALLOW_PROTOCOL` and `protocol.allow`.

## Notes

- Severity medium: arbitrary command execution, but it needs the variable already set with `ext`
  in the environment that starts the console (the user's own shell or a wrapper), and a clone
  URL entered through the loopback, token-protected UI.
- Fix (decided at task-033's design, D33-2): clone and the new git transport set
  `GIT_ALLOW_PROTOCOL` to exactly `https:http:ssh:git:file`, from the same constant as
  `CLONE_SETTINGS`; a test reproduces the marker with `GIT_ALLOW_PROTOCOL=ext`, then sees it
  refused.
- Proposed absorption: task-033-git-copy-state-repository-status-and-transport-routes (Wave 3; it
  owns the git transport, edits `clone.ts` and has an adversarial security review).

## Triage & Execution Notes
