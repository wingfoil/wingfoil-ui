---
id: F-003
title: "No verb updates a Memory element's fields, so required fields cannot be set from the CLI"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-03.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`:

```
$ wingfoil memory add --type task --title "Login form" --set summary=x
error: --set summary: memory type 'task' has no token {summary} in its id_pattern or path
[exit 1]
```

`memory add --set` fills only the tokens of the type's `id_pattern` or `path`; every other field is
refused. `wingfoil memory --help` lists `add`, `approve`, `deprecate`, `history`, `reject`,
`search`, `submit`: no verb changes a field or the body of an existing element. Editing a title, a
summary or the references of an element is a hand edit of the file.

The same limit blocks **ingestion from a client**: an ingestion creates an element with
`memory add`, and every field the type requires but its id does not contain has to be filled by
editing the draft before `submit`. Bug, ADR, tech-spec and service ingestions cannot be completed
through the CLI alone.

WingFoil already has elements on the subject: `dl-108-amending-an-approved-element` (ready),
task-127 (`memory amend`) and task-163 (shared frontmatter setter).

## Expected

A verb that sets frontmatter fields and replaces the body from a file, committing
`docs(<type>): edit <id>`, refused on the types and states whose content is frozen (dl-108 covers
approved elements through `memory amend`); and `memory add` able to set at creation every field the
type requires, so an ingestion runs through the CLI alone. Wanted **before v1.0**: it lets a client
edit an element's title, summary and references without hand-editing files.

Suggested kind in WingFoil: a comment on task-127 / task-163, with the ingestion use case.
