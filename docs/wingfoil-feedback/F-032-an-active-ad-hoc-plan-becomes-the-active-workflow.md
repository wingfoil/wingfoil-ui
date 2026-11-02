---
id: F-032
title: "An active plan naming no loaded workflow (an ad-hoc plan) becomes the active workflow instance and masks the real one"
kind: gap
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-38.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-02, in a scratch repository made with `wingfoil init --template Kanban --no-interactive`
(0.3.1's scaffold declares `plan`: `draft → active → done`, `active` waiting). A plan that records
work outside any declared workflow — an ad-hoc plan — is added and submitted to `active`:

```
$ wingfoil workflow status --format json        → "active":null,"open":[],"message":"no open workflows"
$ wingfoil memory add --type plan --title "Governance alignment" --set workflow=adhoc --set phase=alignment --set scope=adhoc
$ wingfoil memory submit adhoc-alignment-plan    # draft → active
$ wingfoil workflow status --format json
  "active":"adhoc-alignment-plan","open":[{"instance":{"id":"adhoc-alignment-plan","workflow":"adhoc",…}}],
  "diagnostics":[{"code":"W_INSTANCE_WORKFLOW_UNKNOWN","severity":"warning",…,"message":"open plan adhoc-alignment-plan names workflow 'adhoc', which the registry does not load"}]
$ wingfoil workflow next --format json           → "next":null,"message":"no next step: workflow 'adhoc' is not loaded"   [exit 0]
```

With a real run open, a newer ad-hoc plan takes `active` from it:

```
$ wingfoil workflow start bug-ingest                         # bug-ingest-1-plan, active
$ wingfoil workflow next --format json                       → instance bug-ingest-1-plan
$ wingfoil memory add --type plan --title "Second ad hoc" --set workflow=adhoc --set phase=cleanup --set scope=adhoc
$ wingfoil memory submit adhoc-cleanup-plan
$ wingfoil workflow status --format json   → active: adhoc-cleanup-plan; open: adhoc-cleanup-plan, bug-ingest-1-plan, adhoc-alignment-plan
$ wingfoil workflow next --format json     → instance adhoc-cleanup-plan, "no next step: workflow 'adhoc' is not loaded"
```

`workflow list` also carries one `W_INSTANCE_WORKFLOW_UNKNOWN` warning per such plan. A project
that keeps a plan per piece of ad-hoc work (a migration, an alignment) must pass the instance ref to
every `workflow next`, `status` and `finalize` while one is open, and a tool reading the active
instance shows the wrong one.

This is what WingFoil's spec-017 specifies (read at `main` `7efff2a0`): §2's diagnostics table
defines `W_INSTANCE_WORKFLOW_UNKNOWN` for an open plan naming a workflow the registry does not
load, and says "the instance is listed with an empty frontier"; §4.9 reports such an instance `complete: false`, and
§3.3 makes the most recently started open instance the active one, with no exception for it. (§3.2
says a plan naming a workflow that "is not startable" is ignored; a workflow that is not loaded at
all is, by §2, listed instead.) The gap is that a `plan` cannot say it records no workflow run: the
type is both the record of an open workflow (§3.1) and the only Memory type for a phase or ad-hoc
plan, so ad-hoc work recorded as a plan takes over the active context, and a consumer has no
declared way to keep one.

## Expected

A plan whose `workflow` names no loaded workflow is not an open workflow instance: it is not listed
under `open`, never becomes `active`, and `workflow next` without a ref answers the newest instance
of a loaded workflow. If such a plan should be reported, as a diagnostic only — or `memory add`
refuses a `plan` naming an unknown workflow unless the type declares ad-hoc plans (e.g. an
`adhoc: true` plan kind or a reserved `workflow` value).

Suggested kind in WingFoil: decision-log (an amendment of spec-017 §3.2–§3.3).
