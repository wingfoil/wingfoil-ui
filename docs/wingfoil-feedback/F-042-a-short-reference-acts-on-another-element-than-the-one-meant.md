---
id: F-042
title: "A short reference acts on another element than the one meant: a truncated id, a single letter, or an uncommitted id that prefixes a committed one"
kind: defect
status: open
wingfoil_version: 0.3.2
answered_by: []
---

Reports W-54.

## Observed

WingFoil 0.3.2 from npm (`0.3.2 (6de2e13c004bbf419acfa7dc4d98d5a7468cd693)`), Linux, 2026-11-19, on projects made
with `wingfoil init --template Kanban`:

- With `task-005-…` and `task-050-…` … `task-059-…` committed, `memory submit task-05 --dry-run` names
  `task-005-…`: the number is compared by value. 0.3.1 answered `document not found: task-05`.
- With one bug committed, `memory submit b --dry-run` names `bug-001-…`.
- With `task-003-gamma-three` committed and a new `task-003-gamma` added by hand and not committed, `memory submit
  task-003-gamma` exits 0 and commits `wf(task): submit task-003-gamma-three`. 0.3.1 answered `document not found:
  task-003-gamma — <path> is not committed at HEAD`.
- An exact id wins over a longer one (`minor-v0.3` beside `minor-v0.3.1`); several matches are refused with
  `ambiguous reference: <ref> matches <N> elements`, exit 1. No option asks for an exact id.

## Expected

A reference that names an element in the working tree, committed or not, never resolves to another element; a
truncated number is not read as a value; a write verb can be asked to accept only a full id (for scripts and agents
that always pass one).
