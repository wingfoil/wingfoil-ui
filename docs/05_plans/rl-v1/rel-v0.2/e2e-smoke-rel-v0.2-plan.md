---
id: e2e-smoke-rel-v0.2-plan
type: plan
title: "E2E smoke rel-v0.2"
status: draft
version: ""            # optional — plan version
workflow: "e2e-smoke"
phase: "rel-v0.2"
scope: "rl-v1/rel-v0.2"
element: ""            # optional — the Memory element this phase iterates (e.g. a release id)
release: ""            # optional — target release, e.g. "v0.1"
tmpl_version: 260703   # Orignal template version
---

## Context

<!-- Why this phase runs now, its preconditions, and what it produces. Keep coherent with the
     workflow definition's phases / roles / actions / produces / checks.
     Every plan's preconditions include that the CLI in use is the pinned one:
     `npm run -s wingfoil -- --version` prints the version package.json pins for `wingfoil`. -->

## Phases / Steps

<!-- The ordered steps to execute against the workflow phase — actions, roles, gates, models. -->

## Handoff

<!-- What requires the approver vs. the agent; the checkpoint(s) and the completion criteria. -->
