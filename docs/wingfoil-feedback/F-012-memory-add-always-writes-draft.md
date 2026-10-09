---
id: F-012
title: "memory add always writes status: draft instead of the type's first state"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-12.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`. A type `story` is added to `memory.yaml` with
`states: { sequence: [ idea, ready, done ] }` and a template whose frontmatter has `type: story`
and `status: idea`; both are committed. Then

```
$ wingfoil memory add --type story --title "Billing"
{ "id": "story-001-billing", "path": "docs/memory/story/story-001-billing.md" }
[exit 0]
$ grep '^status' docs/memory/story/story-001-billing.md
status: draft
$ wingfoil memory submit story-001-billing
error: invalid state 'draft' for type 'story'
[exit 1]
```

The new element is in a state its type does not declare, and no verb moves it on: a type whose
sequence does not start with `draft` cannot be created through the CLI (first found on 2026-10-05,
building a test fixture in the WingFoil UI's dev-loop task-001). `memory search` still lists the
element, with the undeclared state:

```
$ wingfoil memory search --type story --format json
{"query":"","matches":[{"path":"docs/memory/story/story-001-billing.md","id":"story-001-billing","title":"Billing","type":"story","status":"draft","tags":[]}]}
```

A WingFoil element on the same subject was seen in the WingFoil repository on 2026-10-09: bug-214
("memory add writes status draft literally instead of the head of the type's state machine",
closed, release v0.3).

## Expected

`memory add` writes the type's first state (`sequence[0]`). Wanted before v1.0.

Suggested kind in WingFoil: bug against `memory add`.
