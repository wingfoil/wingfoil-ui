---
id: F-019
title: "memory search reads the working tree while writes gate on HEAD, and submit commits uncommitted edits"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly an unnamed W-xx candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`.

Writes read the committed state. With a type added to `.wingfoil/memory.yaml` but not committed:

```
$ wingfoil memory add --type story --title "Checkout"
error: unknown memory type 'story' (not defined in memory.yaml) — the working tree's '.wingfoil/memory.yaml' defines it, but that change is not committed, and an element is created against the committed registry (dl-080); commit '.wingfoil/memory.yaml' first, then retry
[exit 1]
```

Reads and submits use the working tree. After `memory add --type bug --title "Crash on save"`, the
title is edited in the file and not committed:

```
$ wingfoil memory search --type bug --format json
{"query":"","matches":[{…,"id":"bug-001-crash-on-save","title":"Crash on save (edited, not committed)",…}]}
$ wingfoil memory submit bug-001-crash-on-save
{ "id": "bug-001-crash-on-save", "from": "draft", "to": "pending" }
$ git show HEAD | grep '^[-+]title'
-title: "Crash on save"
+title: "Crash on save (edited, not committed)"
```

The search answers from uncommitted content, and the `submit` commit (`wf(bug): submit …`) carries
the uncommitted edit. A client cannot tell committed from local state without running git itself.

WingFoil already has an element on the subject: dl-084 ("A user refused by `memory add` will check
with `memory search --type`, and the two answer from different baselines…", ready).

## Expected

Read verbs say which baseline they answer from (or offer both), and `submit` either refuses or names
the uncommitted content it commits, so a client can show committed and local state apart.

Suggested kind in WingFoil: decision-log (check dl-084, the baseline of read-only verbs).
