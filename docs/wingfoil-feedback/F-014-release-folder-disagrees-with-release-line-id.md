---
id: F-014
title: "A release's folder is named after the release-line field (v1), not the release-line id (rl-v1)"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-07 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`, with two types declared as WingFoil's own
`memory.yaml` declares them at the `v0.2.2` tag: a release-line (`id_pattern: "rl-{version}"`,
`path: "docs/planning/{id}.md"`) and a release (`id_pattern: "{kind}-{version}"`,
`path: "docs/planning/{release-line}/{id}.md"`). Then

```
$ wingfoil memory add --type rline --title V1 --set version=v1
{ "id": "rl-v1", "path": "docs/planning/rl-v1.md" }
$ wingfoil memory add --type rel --title Minor --set kind=minor --set version=v0.1 --set release-line=v1
{ "id": "minor-v0.1", "path": "docs/planning/v1/minor-v0.1.md" }
```

The release's `release-line` field holds the version (`v1`), so its folder is `planning/v1/`, while
the release line it belongs to is `rl-v1` and WingFoil's own releases sit in `planning/rl-v1/`.

A WingFoil element on the same subject was seen in the WingFoil repository on 2026-10-09: bug-163
("A release's `release-line` field holds `v1` while its folder is `planning/rl-v1/`…", closed,
release v0.3), fixed by task-164 (done), which changed WingFoil's own path to
`planning/rl-{release-line}/{id}.md`.

## Expected

The release's folder and its `release-line` field agree with the release line's id in WingFoil's
configuration.

Suggested kind in WingFoil: bug (possibly already answered by bug-163).
