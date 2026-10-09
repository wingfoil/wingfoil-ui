---
id: F-018
title: "No per-gate role: approve and reject always need the approver role"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-13 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`. The git user is a team member whose only role is
`reviewer`; a task is submitted to `pending`. Then

```
$ wingfoil memory reject task-001-login-form --reason "needs work"
error: user not authorized to approve type 'task'
[exit 1]
$ wingfoil memory approve task-001-login-form --reason ok
error: user not authorized to approve type 'task'
[exit 1]
```

Both verbs require the `approver` role, whatever the type and the gate: a reviewer cannot send a
task in review back, and a product owner cannot decide a decision-log, unless each also holds
`approver`. WingFoil's own workflows declare `approval: { by_role: approver }` on their phases (for
example `bug-ingest.yaml`, seen in the WingFoil repository on 2026-10-09), but 0.2.2 does not
read that field for the Memory verbs.

## Expected

A gate can name the role that passes or rejects it (per type and gate in `memory.yaml`, or through
the workflow's `approval: { by_role }`), and `memory approve`/`reject` check that role.

Suggested kind in WingFoil: decision-log (check spec-017 and the workflow `approval` field).
