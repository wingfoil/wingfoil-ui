---
id: F-016
title: "A roles.yaml binding to a missing directive is only a warning, and only when listing that role"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-09 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`. `ghost-directive`, which has no file, is added
to the `qa` list of `.wingfoil/roles.yaml` and committed. Then

```
$ wingfoil directives list --format json      → exit 0, "warnings": []
$ wingfoil directives list --role qa --format json
                                              → exit 0, "warnings": ["directive 'ghost-directive' bound to role 'qa' has no directive file"]
```

The dangling binding is never an error, and the plain listing does not report it at all: it shows
only when the bound role is named.

## Expected

A binding to a directive that does not exist is reported by every `directives list`, and refused
(or reported as an error) by the commands that check the configuration.

Suggested kind in WingFoil: decision-log.
