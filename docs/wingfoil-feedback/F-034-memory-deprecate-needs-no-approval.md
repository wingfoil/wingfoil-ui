---
id: F-034
title: "memory deprecate needs no approval: any git identity retires any element in any state"
kind: request
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Not a CLI behaviour: the memory deprecate rule of the wingfoil-cli directive.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-02, in a scratch repository made with `wingfoil init --template Kanban --no-interactive`,
whose only team members are `probe@example.invalid` and `dev@example.invalid`. With the
repository's identity set to a person who is not a member:

```
$ git config user.name Mallory; git config user.email mallory@example.invalid
$ wingfoil memory deprecate task-002-real-one --format json
{"id":"task-002-real-one","path":"docs/memory/task/task-002-real-one.md","from":"approved","to":"deprecated"}
[exit 0]
$ wingfoil memory deprecate adhoc-alignment-plan --format json
{"id":"adhoc-alignment-plan","path":"docs/memory/plan/adhoc/adhoc-alignment-plan.md","from":"active","to":"deprecated"}
[exit 0]
$ git log -2 --format='%an <%ae> | %s'
Mallory <mallory@example.invalid> | wf(plan): deprecate adhoc-alignment-plan [active → deprecated]
Mallory <mallory@example.invalid> | wf(task): deprecate task-002-real-one [approved → deprecated]
```

No `--reason` is needed (a blank one is refused, exit 2), no role is checked and the identity need
not be a team member; an approved element and an active plan (an open workflow instance) are retired
alike, and `memory search` hides deprecated elements by default. `memory approve` on the same
repository refuses a member without the `approver` role (`user not authorized to approve type
'task'`). WingFoil documents deprecate as not an approval gate, with an optional `--reason`
(spec-008 §2, as dl-027 records), so this is a request, not a defect. This repository works around it with a process
rule (deprecate only in its `end-of-life` workflow or with the approver's recorded OK), which the
CLI cannot enforce.

## Expected

An opt-in authority on `memory deprecate`: a type or the DNA can declare who may deprecate (e.g.
`deprecate: { by_role: approver }`, or "an element past its first gate needs the approver"), and
then `memory deprecate` refuses another identity as `memory approve` does, records `Approver:` in
the commit, and requires `--reason`. Without the setting, at least a team member is required.

Suggested kind in WingFoil: decision-log (next to dl-027 and adr-006).
