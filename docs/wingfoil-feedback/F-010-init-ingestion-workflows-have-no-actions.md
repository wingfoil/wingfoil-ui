---
id: F-010
title: "init templates (Kanban, Scrum) write ingestion workflows with one phase and no actions"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-10.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09. In a fresh git repository, `wingfoil init --template Kanban
--no-interactive` writes `.wingfoil/workflows/custom/bug-ingest.yaml` as

```
# Capture a bug on demand
name: bug-ingest
kind: main
description: "Capture a bug on demand"
phases:
  - name: capture
```

and `decision-log-ingest.yaml` and `adr-ingest.yaml` the same way: one phase `capture`, no
`actions`, no `produces`. `wingfoil workflow list --format json` shows each of them as
`{"name":"capture","optional":false}`. The source is `storage/templates.js`, which writes
`mainWorkflowYaml('bug-ingest', …, 'phases:\n  - name: capture\n')`. Scrum writes the same three
workflows and declares the same seven types as Kanban.

A client (or the v0.3 engine) cannot tell what such an ingestion creates. A client that recognises
an ingestion by a first phase running `memory.add` finds none in a Kanban or Scrum project (found by
the WingFoil UI specification coherence audit, 2026-10-02).

No WingFoil element on the subject is known.

## Expected

Each template ingestion has the shape of WingFoil's own: `capture` running `memory.add(type: X)`
and `memory.submit`, then `triage`/`approve` with `approval: { by_role: approver }`, so a client can
read what each ingestion creates. Wanted before v1.0 (nice to have).

Suggested kind in WingFoil: bug, or a decision-log against the templates.
