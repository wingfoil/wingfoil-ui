---
id: F-020
title: "Release and bug waiting states have no verb, and approve-release has no gate"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-25 and W-26 candidates.

## Observed

WingFoil 0.2.2 from npm, 2026-10-12, in a scratch repository holding WingFoil's own `.wingfoil/`
at tag `v0.2.2` (`git archive v0.2.2 .wingfoil`), with a test identity given every role in
`dna.yaml`.

A release leaves `draft` with `memory submit`; after that no verb moves it:

```
$ wingfoil memory add --type release --title "Demo" --set kind=minor --set version=v0.9 --set release-line=v1
$ wingfoil memory submit minor-v0.9
  "from": "draft",
  "to": "planning"
$ wingfoil memory approve minor-v0.9 --reason "start development"
error: illegal transition planning -> (none) for type 'release'
[exit 1]
```

`planning`, `in-development` and `releasing` are `waiting` states in `memory.yaml`; the workflows
move them with `release.set_state(in-development)` (`release-planning` `commit-backlog`),
`element.set_state(releasing)` (`release-submit` `enter-releasing`) and
`element.set_state(released)` (`release-publishing` `mark-released`). The `approve-release` phase
of `release-submit` declares `approval: { by_role: approver }`, but the release in `releasing` has
no gate, so the approval cannot be recorded by a verb.

A bug's `triaged → planned` and `planned → in-progress` edges are also waiting, and the refusals
name a target the graph does not have from that state:

```
$ wingfoil memory approve bug-001-crash --reason triage      # open -> triaged
  "to": "triaged"
$ wingfoil memory approve bug-001-crash --reason "plan the fix"
error: illegal transition triaged -> resolved for type 'bug'
[exit 1]
$ wingfoil memory submit bug-001-crash
error: illegal transition triaged -> open for type 'bug'
[exit 1]
```

Without a workflow engine (0.2.2 has `workflow list` only), every one of these transitions is a hand
edit of `status:` committed by convention (`wf(release): <id> [<from> → <to>]`,
`wf(bug): <id> [triaged → planned]`); `resolved → closed` is `memory approve --reason`, and the note
of why the bug can close goes in a separate commit. WingFoil task-226 (`workflow finalize`) covers
the plan's `active → done` only.

## Expected

A verb (or the workflow engine's step) for each waiting transition of `release` and `bug`, writing
the same `wf(<type>): … [<from> → <to>]` commit as the gated verbs; a recordable approval for
`approve-release`; and refusals on a waiting state that say "no verb moves this state" instead of
naming a wrong target.

Suggested kind in WingFoil: task (extend the workflow-engine work of spec-017, next to task-226).
