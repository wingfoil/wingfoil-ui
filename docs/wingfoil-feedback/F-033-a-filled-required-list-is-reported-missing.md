---
id: F-033
title: "A filled required list field is refused as \"missing\" at submit unless the type declares it in lists"
kind: defect
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-33.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-02, in a scratch repository made with `wingfoil init --template Kanban --no-interactive`.
The `task` type's `template.frontmatter.required` is extended with `features`, committed; a task is
added and its frontmatter given `features: [ F-1 ]`, committed:

```
$ grep -n required .wingfoil/memory.yaml          → required: [id, type, title, status, features]   (task)
$ head -8 docs/memory/task/task-005-listy.md
---
id: task-005-listy
type: task
title: "Listy"
features: [ F-1 ]
status: draft
format: 1
---
$ wingfoil memory submit task-005-listy --format json
{"error":"missing required field on submit: features"}
[exit 1]
$ # add `lists: [ features ]` under the task's template.frontmatter, commit
$ wingfoil memory submit task-005-listy --format json
{"id":"task-005-listy","path":"docs/memory/task/task-005-listy.md","from":"draft","to":"pending"}
[exit 0]
```

The field is present and non-empty, yet the refusal calls it missing; nothing in the message points
to `lists`. WingFoil bug-147 (closed, v0.3) made a present but empty required list distinguishable
from an absent field; a present, filled list on a type that does not declare it under `lists` is
still reported as absent. WingFoil 0.2.2 accepts the same case: a 0.2.2 `init --template Kanban`
project with the same `required` change and the same `features: [ F-1 ]` submits (exit 0,
`draft → pending`). This repository met it on its `release` type's `features`.

## Expected

A required field that is present is never reported as missing. Either a filled list satisfies a
required field whether or not `lists` declares it, or the refusal names the real cause, e.g.
`required field features holds a list, but the type does not declare it in template.frontmatter.lists`
— and `workflow list` / a configuration check reports a required field whose template value is a
list but which `lists` omits.

Suggested kind in WingFoil: bug (submit's required-field check; next to bug-147).
