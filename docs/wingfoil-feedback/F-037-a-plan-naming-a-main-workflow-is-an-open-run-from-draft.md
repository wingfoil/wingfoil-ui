---
id: F-037
title: "A plan naming a loaded main workflow is an open run from its draft, becomes the active instance and takes over workflow next"
kind: gap
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-45.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-05, in a scratch repository made with `wingfoil init --template Scrum --no-interactive`
(its `sw-life-cycle` is `kind: main`, `scrum-delivery` `kind: sub`). A run is started, then a plan
naming the same main workflow is added — not started, only added:

```
$ wingfoil workflow start sw-life-cycle --format json        → sw-life-cycle-1-plan, next sw-life-cycle.inception
$ wingfoil memory add --type plan --title "Second life cycle" --set workflow=sw-life-cycle --set phase=second --set scope=second --format json
{"id":"sw-life-cycle-second-plan","path":"docs/memory/plan/second/sw-life-cycle-second-plan.md"}
$ wingfoil workflow status --format json
  active: sw-life-cycle-second-plan   open: sw-life-cycle-second-plan (planStatus draft), sw-life-cycle-1-plan (active)
$ wingfoil workflow next --format json                       → instance sw-life-cycle-second-plan, next sw-life-cycle.inception
$ wingfoil workflow list --format json                       → "diagnostics": []
```

The same after `memory submit sw-life-cycle-second-plan` (`draft → active`): two open runs, the new
one `active`, `workflow next` without a ref answers it, no diagnostic. Control, on a fresh project
with the same run started: a plan naming the sub workflow (`--set workflow=scrum-delivery`), added
and submitted to `active`, leaves `workflow status` with one open run (`sw-life-cycle-1-plan`
`active`), `workflow next` on it, and no diagnostic.

So a plan in `draft` — a document someone is still writing, which may never be submitted — is
already an open workflow instance, the newest one, and silently moves `workflow next` (and every
tool reading the active instance) away from the run in progress. A project that keeps a plan per
phase and names the main workflow in it, as a phase plan reasonably would, loses its running
context without any warning.

## Expected

A plan becomes an open instance of a main workflow only through `workflow start` (or, at least, not
while it is in its type's first state): a plan added by `memory add` that names a loaded main
workflow is not listed under `open` and is not `active` until started. If adding one is legitimate,
`workflow list` (or `memory add` itself) reports that the newest open instance changed — a
diagnostic such as `W_INSTANCE_FROM_DRAFT_PLAN` naming the plan and the instance it displaced.

Suggested kind in WingFoil: decision-log (an amendment of spec-017 §3.1–§3.3, with F-032 / W-38 for
plans naming no loaded workflow).
