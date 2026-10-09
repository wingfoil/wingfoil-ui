---
id: F-002
title: "JSON output of the workflow engine (status, next, show) with gates, required role and iterated elements"
kind: request
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-02.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09. `wingfoil workflow --help` lists one command, `list` ("read
the workflows the project declares (there is no workflow engine yet)");
`wingfoil workflow start bug-ingest` exits 2 with `error: unknown command 'start'`. `workflow list
--format json` returns each workflow's phases (`name`, `optional`, `include`) only: no open run, no
current phase, no pending gate, no next step. A client that wants to show what is in progress and
what comes next has nothing to read.

WingFoil already has an element on the subject: `spec-017-workflow-commands-and-state-deduction`
(approved, the v0.3 engine), with tasks 204, 216, 217, 225, 226 and 239.

## Expected

The engine's `status`, `next` and `show` commands have a `--format json` output that includes: the
open main workflows, the current phase path, the state of each element a phase iterates over, the
pending gates with the `role` each requires, and the next executable step with its role,
directives and context. Wanted **before v1.0** (v0.3 scope): it feeds a client's "today" view, its
next step and its progress.

Suggested kind in WingFoil: review spec-017 against these fields.
