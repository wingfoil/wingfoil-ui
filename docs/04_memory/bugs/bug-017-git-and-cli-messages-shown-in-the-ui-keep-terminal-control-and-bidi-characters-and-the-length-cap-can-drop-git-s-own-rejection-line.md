---
id: bug-017-git-and-cli-messages-shown-in-the-ui-keep-terminal-control-and-bidi-characters-and-the-length-cap-can-drop-git-s-own-rejection-line
type: bug
title: "Git and CLI messages shown in the UI keep terminal control and bidi characters and the length cap can drop git's own rejection line"
status: planned
severity: "low"        # REQUIRED — critical | high | medium | low
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

The git and CLI messages the API sends verbatim (`git-refused`, `cli-refused`, `sync.*.lastError`,
and the push failure task-040 shows in a red toast) keep terminal control characters and Unicode
bidi controls that a remote or a hook prints, and the length cap keeps only the head of a long
message, so git's own last lines (the reason a push was rejected) can be cut off.

## Steps to Reproduce

1. A project whose upstream is a local bare repository with a `pre-receive` hook that prints ANSI
   CSI and OSC sequences, BEL, a carriage return and U+202E (RIGHT-TO-LEFT OVERRIDE), then about
   20 KB of text, and exits 1.
2. Commit something so the copy is ahead, then press *Push* in the sidebar (task-040's branch), or
   call the push route of spec-010 §4 directly.
3. Read the message in the answer (and the red "Not pushed" toast).

## Expected Behavior

The message keeps git's text readable as text: control characters other than newline and tab, and
the bidi controls U+202A–U+202E and U+2066–U+2069, are shown as visible escapes, not passed on; a
message over the cap keeps git's own concluding lines (for example `! [remote rejected] … (pre-receive
hook declined)`), not only its first characters.

## Actual Behavior

ESC, BEL, CR and U+202E reach the answer and the toast's text verbatim: U+202E reverses how the text
after it reads, a CR or escape sequence can hide or garble content. With about 20 KB of `remote:`
lines the message ends after 4 000 characters of the hook's output with an ellipsis; git's
`! [remote rejected]` line, printed last, is gone.

## Evidence

- Adversarial security review of task-040, round 1 (2026-10-17), probes P2 on the real bin with a
  kanban fixture copy, Chromium, git 2.43.0: the toast's `textContent` contains ESC, BEL, CR and
  U+202E; with a 20 KB hook output the rejection line is missing.
- `server/src/git/redact.ts` `redactLocalPaths()` is the one function every git and CLI message
  goes through before the API (`transport.ts` `message()`, `snapshots.ts`, `governed.ts`); it
  replaces local folders and URL userinfo and caps at `MAX_MESSAGE` = 4 000 characters from the
  start; it does not touch control characters.
- These bytes never reach the server log (only kinds and exit codes are logged, Wave 2 rule).

## Notes

- Severity low: display spoofing and loss of the reason on very long remote output; no code runs,
  markup renders as text (probed), no secret is shown that the redaction would remove.
- Suggested fix (structural, in the one choke point): neutralise C0/C1 controls except `\n` and
  `\t` and the bidi controls as visible escapes; cap by keeping head and tail, or always keep git's
  own non-`remote:` lines (`! [`, `error:`, `fatal:`, `hint:`).
- Same defect on the clone and add-folder paths (adversarial review of task-040, round 2): a failed
  clone answers 422 `git-refused` with git's stderr as it is (`server/src/projects/project-list.ts`
  `GitCloneError`, `GitReadError`), without the neutralising rule and the cap — a remote's pkt-line
  `ERR` with U+202E reaches the add-project dialog. The fix covers every producer of a verbatim
  `git-refused` / `cli-refused` message (one sanitiser at one choke point), and neutralises by
  Unicode general category (Cc, Cf, Cs, Zl, Zp; newline and tab kept) rather than a list of ranges
  (U+200E/200F, U+061C, U+FEFF, zero-width characters, U+2028/2029 also passed).
- Two more surfaces (adversarial review of task-040, round 3): the CLI's `warnings` (stderr lines of
  the pinned CLI, `server/src/cli/adapter.ts`) reach the Memory and Directives lists with the
  project's absolute path and characters taken from project files (a U+202E in a `memory.yaml`
  key); and remote file names in `detail.files` of a `local-changes-in-the-way` refusal (and the
  copy kept in the sync status) reach the sidebar raw, so a right-to-left override spoofs a file
  name inside the sentence that asks the user to commit or stash it. Both are covered by the fix,
  as is the cost of escaping a very large message (the input is bounded before it is transformed).
- Found during task-040 (Wave 6 of the v0.2 dev-loop); the code is task-033's (v0.2, not released).

## Triage & Execution Notes

<!-- Running log, not the retrospective itself.
     - triage (bug-ingest): severity call, wontfix/duplicate rationale if rejected to `closed`.
     - fix: once fix task(s) exist (release-planning/build-backlog), day-to-day execution notes
       live on those tasks (docs/04_memory/{release}/{id}.md, `bug: {this id}`, their own
       Execution Notes section) — this section only needs a pointer plus anything that doesn't
       belong on a specific fix task (e.g. why 2 tasks were needed instead of 1). -->
- fix: **absorbed into task-040-update-and-push-from-the-sidebar** (AC "bug-017", `bug:` list of the task; the approver's choice at task-040's security review round 1, 2026-10-17, triage 2026-10-18); `triaged → planned` set by hand (directive `wingfoil-cli` W-26).
