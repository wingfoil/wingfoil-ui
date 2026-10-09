---
id: F-015
title: "The Kanban template declares no facilitator role, which WingFoil's lean-inception requires"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-08 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09. In a fresh git repository, `wingfoil init --template Kanban
--no-interactive` declares the roles `developer`, `reviewer`, `qa`, `architect`, `product-owner`,
`tech-lead`, `approver` (`wingfoil dna show team --format json`). WingFoil's own `lean-inception`
workflow (seen in the WingFoil repository on 2026-10-09) gives its phases `role: facilitator`.
Copying that workflow onto a Kanban project leaves a role nobody can hold:

```
$ wingfoil dna add team.members --value "Ada Lovelace" --entry-email ada@example.com --entry-roles facilitator
error: E_VALIDATION team.members.0.roles.0 (…/.wingfoil/dna.yaml): team.members[0].roles references undefined role "facilitator" (not in team.roles)
[exit 1]
```

The role has to be declared first (`dna add team.roles --value facilitator …`). Nothing reports the
mismatch between a workflow's `role:` and the declared roles.

## Expected

The roles a template declares cover the workflows WingFoil offers for it, or a check (for example in
`workflow list`) reports a phase role that is not in `team.roles`.

Suggested kind in WingFoil: decision-log.
