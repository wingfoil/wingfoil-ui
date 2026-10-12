---
id: F-020
title: "Release and bug waiting states have no verb, and approve-release has no gate"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Reports W-25 and W-26.

## Observed

WingFoil 0.2.2 from npm, 2026-10-12, in a scratch git repository holding only WingFoil's own
`.wingfoil/` at tag `v0.2.2` (`git archive v0.2.2 .wingfoil`), committed, with the `dna.yaml` team
member's email replaced by the scratch repository's git identity (it holds every role, `approver`
included).

A release leaves `draft` with `memory submit`; after that no verb moves it. The required fields
`pillar`, `features` and `requirements` are filled by editing the draft (no verb sets them, F-003)
before the submit:

```
$ wingfoil memory add --type release --title "Demo" --set kind=minor --set version=v0.9 --set release-line=v1
  "id": "minor-v0.9",
$ # edit docs/04_memory/planning/v1/minor-v0.9.md: pillar: "X", features: ["F"], requirements: "R"
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
$ wingfoil memory add --type bug --title "Crash"
  "id": "bug-001-crash",
$ # edit docs/04_memory/bugs/bug-001-crash.md: severity: "low"
$ wingfoil memory submit bug-001-crash
  "from": "draft",
  "to": "open"
$ wingfoil memory approve bug-001-crash --reason triage
  "from": "open",
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
`wf(bug): <id> [triaged → planned]`). WingFoil task-226 (`workflow finalize`, release v0.3) records
a checkpoint or an uncarried approval as a phase-record commit, so it may cover `approve-release`;
this note asks for the waiting-state edits of `release` and `bug`.

## Expected

A verb (or the workflow engine's step) for each waiting transition of `release` and `bug`, writing
the same `wf(<type>): … [<from> → <to>]` commit as the gated verbs; a recordable approval for
`approve-release` if task-226 does not cover it; and refusals on a waiting state that say "no verb
moves this state" instead of naming a wrong target.

Suggested kind in WingFoil: task (next to task-226, in the workflow-engine work).
