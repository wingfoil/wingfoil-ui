---
id: F-022
title: "directives list returns both files of a duplicated directive id, and only a warning names the one in force"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-23 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-12, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`, after copying
`.wingfoil/directives/built-in/testing.md` to `.wingfoil/directives/custom/testing.md` and
committing:

```
$ wingfoil directives list --format json
```

returns two entries with the same `frontmatter.id` (`testing`), one with
`"path": "directives/built-in/testing.md"` and one with `"path": "directives/custom/testing.md"`,
with no field saying which one applies, and:

```
"warnings": [
  "directive 'testing' defined in directives/built-in/testing.md, directives/custom/testing.md; using directives/custom/testing.md"
]
```

A client must parse the warning text to know which file is in force. Also, an entry's
`frontmatter` leaves out `tags` and `ref` when the file has none, so a client cannot rely on them
being present.

## Expected

`directives list` returns one entry per id (the one in force), or marks each entry with a field
such as `"in_force": true|false` / `"overridden_by": "<path>"`; the warning stays as a human hint.
The frontmatter fields a client may read are documented as optional or always present.

Suggested kind in WingFoil: task (part of the CLI JSON contract, F-001).
