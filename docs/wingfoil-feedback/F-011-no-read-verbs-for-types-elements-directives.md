---
id: F-011
title: "No read verbs for type definitions, one element's full content and directive bodies"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-11.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive` and one task added:

```
$ wingfoil memory show task-001-login-form
error: unknown command 'show'
[exit 2]
$ wingfoil directives show testing
error: unknown command 'show'
[exit 2]
```

`memory search --format json` returns `id`, `title`, `type`, `status`, `tags` and `path` only;
`directives list` returns each directive's frontmatter and roles, not its body. Nothing prints a
type's resolved definition from `memory.yaml` (states, gates, waiting states, required fields, id
pattern). A client that needs them reads `memory.yaml`, the element files and the directive files
directly. The MCP server already reads element content (`memory.show`); the CLI does not.

WingFoil already has an element on the subject: `spec-005` (CLI command contract); the MCP server
has `memory.show`.

## Expected

`memory types` (or `memory schema`), `memory show <id>` (frontmatter and body) and
`directives show <id>`, each with `--format json` and a published schema, so a client without MCP
reads the same as one with it. Wanted **before v1.0**: until the verbs exist, the WingFoil UI reads
these files directly, read-only, from an allow-list (its SARD REQ-ARC-04 and adr-001 D1a; found in
its initial design, session 5, 2026-10-02).

Suggested kind in WingFoil: an extension of spec-005, or a new decision-log.
