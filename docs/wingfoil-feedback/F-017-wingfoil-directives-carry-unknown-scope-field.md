---
id: F-017
title: "WingFoil's own directives carry a scope field that 0.2.2 reports as unknown"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-12 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09. In a clone of the WingFoil repository at `1ce84a54`:

```
$ wingfoil directives list --format json
Warning: …/.wingfoil/directives/custom/claim-evidence.md: unknown field(s) ignored: scope
Warning: …/.wingfoil/directives/custom/command-baseline.md: unknown field(s) ignored: version
Warning: …/.wingfoil/directives/custom/doc-versioning.md: unknown field(s) ignored: scope
Warning: …/.wingfoil/directives/custom/documentation.md: unknown field(s) ignored: scope
Warning: …/.wingfoil/directives/custom/git-conventions.md: unknown field(s) ignored: scope, version
…
[exit 0]
```

The same with WingFoil alone: in a scratch repository made with `wingfoil init --template Kanban
--no-interactive`, a directive created with `wingfoil directive create --name scoped` and given
`scope: global` makes `directives list` print
`Warning: …/.wingfoil/directives/custom/scoped.md: unknown field(s) ignored: scope` (exit 0).
An unknown frontmatter field is only a warning on stderr, so a misspelt field is silently dropped.

A WingFoil element on the same subject was seen in the WingFoil repository on 2026-10-09: bug-113
("`directives list` prints `unknown field(s) ignored: scope` for every global directive…", closed,
release v0.3).

## Expected

The fields WingFoil writes in its own configuration are fields its released schema knows; a field
the schema documents (spec-013 documents `scope`) is not reported as unknown.

Suggested kind in WingFoil: bug.
