---
id: F-029
title: "A project initialised by 0.2.2 fails every workflow command of 0.3.1 until hand-edited: no verb checks or migrates it"
kind: gap
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-32.

## Observed

WingFoil 0.2.2 and 0.3.1 from npm, git 2.43, Linux, 2026-11-02, in two scratch repositories, each
initialised by 0.2.2 and committed:

```
$ wingfoil@0.2.2 init --template Kanban --no-interactive      # exit 0
$ wingfoil@0.2.2 workflow list --format json                   # exit 0
$ wingfoil@0.3.1 workflow list --format json
{"error":"E_WORKFLOW_INCLUDE_UNRESOLVED phases[2].include (workflows/custom/sw-life-cycle.yaml): include 'workflows/custom/kanban-delivery.yaml' names no loaded workflow (a phase include is a workflow name, not a file path)"}
[exit 1]
$ wingfoil@0.3.1 workflow status --format json                 # exit 1, the same error
$ wingfoil@0.3.1 dna show / memory search / directives list    # exit 0
$ wingfoil@0.3.1 init --template Kanban --no-interactive
error: WingFoil already initialized (to change its configuration, edit the files under .wingfoil/ and commit them, …)
[exit 1]
```

`--template Scrum` gives the same with `scrum-delivery.yaml`. The fix is a hand edit, documented in
WingFoil's `CHANGELOG.md` (0.3.0 *Changed*, *Upgrading from 0.2.x*: replace the path with the
workflow name and commit), and WingFoil bug-394 (triaged, v0.4) asks the refusal to name the
workflow and the upgrade note. Beyond the scaffold, a workflow 0.2.2 accepts can hold more that
0.3.1 refuses, and one refusal fails the whole `workflow list`: with `produces: ["a bug report"]`
added to the scaffold's `bug-ingest.yaml` and committed, 0.2.2's `workflow list` exits 0 and 0.3.1's
exits 1 listing no workflow, the include refusal as `error` and
`E_PHASE_PRODUCES_NOT_A_PATH phases[0].produces[0] (workflows/custom/bug-ingest.yaml): produces 'a bug report' is not a path pattern …`
in `details`. This repository also met `E_WORKFLOW_ELEMENT_TYPE_UNKNOWN` (an action on a type
`memory.yaml` does not declare) only on 0.3.x; neither refusal is in the upgrade note. In the other
direction 0.2.2 refuses the `{ type, path }` form of `produces` that 0.3.x reads
(`E_VALIDATION phases.0.produces.0 (…/bug-ingest.yaml): Invalid input: expected string, received object`),
so a project using it cannot be valid for both versions while it moves.

## Expected

A way to move a project from 0.2.x to 0.3.x with WingFoil itself:

- a check that lists every refusal of the newer version at once (e.g. `workflow list` reporting each
  unresolved include, invalid `produces` and unknown type as a diagnostic of its workflow, with the
  other workflows still listed, or a dedicated `wingfoil check` / `--dry-run` upgrade report), each
  naming the fix;
- a verb that rewrites what the old `init` wrote (the scaffold's `include:` path to the workflow
  name) and commits it, as `init` committed the original.

Suggested kind in WingFoil: request (upgrade path; next to bug-394).
