---
id: F-013
title: "A plan's scope path token is not recorded in the element, because the plan template has no scope field"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-03 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`. A type `plan` is declared as in WingFoil's own
`memory.yaml` (`path: "docs/05_plans/{scope}/{id}.md"`, `id_pattern: "{workflow}-{phase}-plan"`,
required `title`, `workflow`, `phase`), with a template that, like WingFoil's
`memory/templates/plan.md`, declares `workflow` and `phase` but no `scope`. Then

```
$ wingfoil memory add --type plan --title Dev --set workflow=dev-loop --set phase=rel-v0.1
error: E_MISSING_PATH_VALUE: path pattern "docs/05_plans/{scope}/{id}.md" is missing value(s) for: scope
[exit 1]
$ wingfoil memory add --type plan --title Dev --set workflow=dev-loop --set phase=rel-v0.1 --set scope=rl-v1
{ "id": "dev-loop-rel-v0.1-plan", "path": "docs/05_plans/rl-v1/dev-loop-rel-v0.1-plan.md" }
[exit 0]
```

The new file's frontmatter has `workflow: "dev-loop"` and `phase: "rel-v0.1"` but no `scope`: the
value that chose the folder is written to the frontmatter only when the template declares the field,
so the element does not record it. WingFoil's own plan template has no `scope:` field, at the
`v0.2.2` tag and on `main` at `1ce84a54`.

## Expected

A path token given with `--set` is recorded in the element (WingFoil's plan template declares
`scope:`, or `memory add` writes every path token it used), so the folder can be derived from the
element alone.

Suggested kind in WingFoil: bug.
