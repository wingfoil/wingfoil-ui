---
id: bug-010-clone-runs-the-user-s-own-git-commands-and-needs-no-minimum-git-version
type: bug
title: "Clone runs the user's own git commands and needs no minimum git version"
status: triaged
severity: "medium"     # REQUIRED — critical | high | medium | low
release-origin: "v0.1" # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: "S2"           # optional — related feature ID from docs/01_vision/06_features.md
module: "server"       # optional — server | web | contracts
wingfoil_version: "0.2.2" # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: ""            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

A clone started from the console runs no code of the cloned repository, but it still runs the
commands of the user's own git configuration (filter drivers such as git-lfs, `core.sshCommand`,
and on git 2.5x config-defined hooks that ignore `core.hooksPath`), and the console requires no
minimum git version although older git releases have known clone vulnerabilities for local
repositories.

## Steps to Reproduce

1. In the user's global git configuration set a filter driver (e.g. `filter.lfs.smudge`) or
   `core.sshCommand` to a command that writes a marker file.
2. From the console, clone a repository whose `.gitattributes` uses that filter (or an `ssh://`
   remote).
3. The marker file is written: the user's configured command ran during the clone.
4. `git --version` on the development machine: 2.43.0; the console checks no minimum version
   before a `file://` clone.

## Expected Behavior

- The documentation of the clone (user guide *Add a project*, spec-006 §3) says exactly what
  runs: nothing of the cloned repository; the user's own configured tools (filters, ssh command,
  config-defined hooks) may run. Optionally the clone disables the filter drivers it does not
  need.
- The console documents a minimum git version, or refuses a `file://` remote whose repository is
  owned by another user (CVE-2024-32004, CVE-2024-32465: cloning a local repository owned by
  another user can run code; fixed upstream in git 2.43.4 / 2.45.1).

## Actual Behavior

- `docs/user-guide.md` line 92: "Nothing of the cloned repository runs during the clone: no
  hooks, no CLI" — true for the repository's code, silent about the user's own configured
  commands.
- No minimum git version is checked or documented; the distribution package of git 2.43.0 may
  carry the security backports, not verified.

## Evidence

- Adversarial security review of task-026 (RP-47, 2026-10-13), items P1 and P2, reported as
  pre-existing (not introduced by task-026): GIT_TRACE and strace runs on git 2.43.0 showed the
  cloned repository's hooks blocked by `core.hooksPath`; filter drivers and `core.sshCommand` of
  the user configuration are outside that guard.

## Notes

- Severity medium: the commands are the user's own configuration (not attacker-supplied by the
  remote), but the documented promise is broader than the behaviour; the version gap matters only
  for `file://` remotes owned by another local user.
- Options: (a) document both points (user guide, spec-006 §3, a minimum git version in the
  README); (b) (a) plus `-c filter.lfs.process= -c filter.lfs.smudge=` / `GIT_LFS_SKIP_SMUDGE=1`
  on the clone; (c) (a) plus refusing a `file://` remote not owned by the current user.
- A related item of the same review (P3, template hooks of `init.templateDir` copied into the
  new `.git/hooks`, not run at clone time) needs no change: it is the user's own configuration.
- The approver asked (2026-10-13) to absorb it into task-033-git-copy-state-repository-status-and-transport-routes, which owns
  the git transport and its adversarial review.

## Triage & Execution Notes
