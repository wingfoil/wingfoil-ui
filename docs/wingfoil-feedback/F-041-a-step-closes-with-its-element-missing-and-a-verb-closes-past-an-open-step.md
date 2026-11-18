---
id: F-041
title: "`workflow finalize` closes a step whose action adds an element with none added, and a verb closes an element while a step of its workflow is open"
kind: gap
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-53.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), Linux, 2026-11-18, on a project made with
`wingfoil init --template Scrum`, with this type added to `.wingfoil/memory.yaml`:

```yaml
  sprint:
    path: "docs/memory/sprint/{id}.md"
    id_pattern: "sprint-{n}"
    template: { file: "memory/templates/sprint.md", frontmatter: { required: [title] } }
    states: { sequence: [draft, planned, active, done] }
```

its template `.wingfoil/memory/templates/sprint.md` (frontmatter `id: "{auto}"`, `type: sprint`, `title: ""`, `status:
draft`), and, both included in `.wingfoil/workflows.yaml`, a main workflow `life` with a phase `sprints` (`iterate_over:
sprint`, `where: { status: [planned, active, done] }`, `include: sprint`) followed by a phase `wrap-up`, and this sub
workflow `sprint` (`kind: sub`, `element: sprint`):

```yaml
phases:
  - { name: start, description: "Start", role: product-owner, actions: [memory.submit] }
  - name: next-sprint
    description: "Add the next Sprint"
    role: product-owner
    actions:
      - 'memory.add(type: sprint)'
      - memory.submit
  - { name: close, description: "Close", role: product-owner, actions: [memory.submit] }
```

With `sprint-001` `planned`, `workflow start life --set phase=1`, then `memory submit sprint-001` (`active`): `workflow
next` names `sprint.next-sprint@sprint:sprint-001`. `workflow finalize --step sprint.next-sprint@sprint:sprint-001
--reason "…"` exits 0 with no Sprint added and the next step is `sprint.close@sprint:sprint-001`. If instead `memory
submit sprint-001` runs with the step open, it exits 0 (`active → done`) and `workflow next` still names the step,
`scope: sprint:sprint-001 (done)`; with `optional: true` on the phase, the same submit moves the run on to
`life.wrap-up`.

## Expected

A step whose actions add an element stays open until the element exists, or says that it was skipped; a verb that
closes the element a run iterates either refuses while a step of that iteration is open or names the open step.
