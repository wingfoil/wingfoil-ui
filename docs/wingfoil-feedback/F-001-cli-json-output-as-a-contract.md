---
id: F-001
title: "Stable, documented JSON output for every command a client calls"
kind: request
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-01.

## Observed

WingFoil 0.2.2 from npm, checked again on 2026-10-09 in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`. `wingfoil memory search --format json` prints

```
{"query":"","matches":[{"path":"docs/memory/task/task-001-login-form.md","id":"task-001-login-form","title":"Login form","type":"task","status":"draft","tags":[]}]}
```

with no schema id and no format version. No command prints the schema of an output, and the npm
package ships none: its `dist/` holds schemas only for the files WingFoil reads (`directives`,
`dna`, `workflow`). Nothing states which output fields are stable or when they may change. A client
that runs the CLI and parses its JSON, as a server behind a UI does, uses that output as an API
without a contract.

WingFoil already has an element on the subject: `spec-005-cli-command-contract` (approved), with
task-013 (done), task-130 and task-156.

## Expected

Every command's `--format json` output has a published schema; breaking changes happen only in
minor releases and are listed in the changelog. Wanted **before v1.0**: a client that consumes the
output needs the schema and the stability promise.

Suggested kind in WingFoil: an extension of spec-005.
