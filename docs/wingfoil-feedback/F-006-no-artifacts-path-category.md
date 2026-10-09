---
id: F-006
title: "No paths.artifacts category in the DNA, with placeholders and URL entries linked to services"
kind: request
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-06.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`:

```
$ wingfoil paths --format json
{"sources":[],"tests":[],"docs":[],"config":[".wingfoil"],"governance":[]}
$ wingfoil paths artifacts
error: no paths mapped for category 'artifacts'
[exit 1]
```

The DNA has no category for the artifacts a phase produces (builds, reports, published pages), no
placeholder for the release or version in a path, and no way to point an entry at a URL. A client
that wants to list a release's artifacts has to keep those paths in its own configuration.

No WingFoil element on the subject is known.

## Expected

A `paths.artifacts` category whose entries are `{ glob, phase }`, with the placeholders `{release}`
and `{version}`; an entry starting with `http(s)://` is a URL, linked to the `service` element with
the same host. Wanted after v1.0, for a client's artifacts view.

Suggested kind in WingFoil: decision-log.
