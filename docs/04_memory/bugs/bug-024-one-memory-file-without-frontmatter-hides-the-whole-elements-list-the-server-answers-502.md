---
id: bug-024-one-memory-file-without-frontmatter-hides-the-whole-elements-list-the-server-answers-502
type: bug
title: "One Memory file without frontmatter hides the whole elements list: the server answers 502"
status: draft
severity: "medium"           # REQUIRED — critical | high | medium | low
release-origin: "v0.2"     # optional — release where the bug was FOUND, e.g. "v0.1"
release: ""            # optional — fix/implementation release, stamped by release-planning/build-backlog
feature: ""            # optional — related feature ID from docs/01_vision/06_features.md
module: "server"             # optional — server | web | contracts
wingfoil_version: "0.2.2"   # optional — `wingfoil --version` of the OBSERVED project (the UI drives its CLI)
browser: "any (server side)"            # optional — for `web`: browser name + version, e.g. "Firefox 131"
contributor: "WingFoil maintainer (request R4, 2026-10-26)"        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Summary

A single Markdown file without frontmatter under a Memory path hides every element of the
project: `memory search` returns it as a match with no `id`, `title`, `type` or `status`, the
console refuses the whole output, and the elements list answers 502 `cli-output` ("Unexpected
output of memory search").

## Steps to Reproduce

1. A project governed by `wingfoil@0.2.2` with at least one valid element.
2. Add `docs/04_memory/bugs/notes.md` (any Memory path) with Markdown text and no frontmatter.
3. Open the console on it and open the Memory list, or call `GET /api/p/<pid>/elements` with a
   session.

## Expected Behavior

The valid elements are listed; the malformed match is left out (or flagged), and a notice names
its file by its project-relative path, through the sanitiser of tool-sourced text.

## Actual Behavior

The elements list answers 502 `{"error":{"code":"cli-output"}}` and the project shows no element.
Other views that read the same CLI output were not checked.

## Evidence

- Reproduced on 2026-10-26 in a scratch repository with this repository's `.wingfoil/`, one valid
  bug and one file without frontmatter: `wingfoil memory search --format json` (0.2.2) answers
  `{"query":"","matches":[{…the bug…},{"path":"docs/04_memory/bugs/notes.md","tags":[]}]}`.
- `contracts/cli/memory-search.schema.json` requires `path`, `id`, `title`, `type`, `status` and
  `tags` on every match; `server/src/cli/adapter.ts` checks the whole output against the schema
  and throws `CliOutputError` on any problem, which answers 502 `cli-output`.
- Reported by the WingFoil maintainer through the coordination channel (2026-10-26), observed on
  WingFoil UI 0.2.0 (`6a5ad5c`).

## Notes

- Workaround: move the file out of the Memory path, or give it a frontmatter.
- Possible fix: check each match of `memory search` on its own, keep the valid ones and report
  the others as warnings (the channel the CLI's `warnings` already use); other commands stay
  strict. Check every view that reads the list (Memory list, Today, counters, the bell).
- WingFoil returning a file that is not an element as a match may be a WingFoil defect: a
  candidate feedback note for the inbox (`docs/wingfoil-feedback/`).

## Triage & Execution Notes

