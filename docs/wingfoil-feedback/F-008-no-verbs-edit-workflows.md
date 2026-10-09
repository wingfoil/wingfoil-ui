---
id: F-008
title: "No CLI verbs to edit workflows (add, rename, reorder phases) with in-flight protection"
kind: request
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-08.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09. `wingfoil workflow --help` lists one command, `list`. Adding,
renaming, moving or removing a phase is a hand edit of the workflow YAML, with nothing that protects
a run already in progress.

No WingFoil element on the subject is known.

## Expected

`workflow phase add|rename|move|remove`; a phase that is completed or in progress cannot be
removed; changes apply to new runs only. Wanted after v1.0: workflow editing from a client.

Suggested kind in WingFoil: decision-log.
