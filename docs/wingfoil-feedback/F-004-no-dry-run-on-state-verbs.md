---
id: F-004
title: "No --dry-run on state verbs to show the checks that would run"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-04.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive` and one task added:

```
$ wingfoil memory submit task-001-login-form --dry-run
error: unknown option '--dry-run'
[exit 2]
```

There is no way to know whether a transition would pass its checks other than running it: a
failing `submit` is the only report of a missing required field.

WingFoil already has an element on the subject: task-210 (`--dry-run` on every mutating verb).

## Expected

`--dry-run` on the state verbs lists the transition and the checks it would run, each with pass or
fail, and commits nothing. Wanted before v1.0 (nice to have): a client can show why a submit would
fail before trying it. Covered by task-210 as far as known.

Suggested kind in WingFoil: none new; follow task-210.
