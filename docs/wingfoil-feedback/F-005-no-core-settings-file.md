---
id: F-005
title: "No core settings file (auto-push, signed commits, no self-approval, check strictness, default agent)"
kind: request
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-05.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09. `wingfoil --help` lists `init`, `mcp`, `directive`,
`directives`, `dna`, `memory`, `paths`, `workflow`: no settings command, and `init --template
Kanban` writes no settings file (`.wingfoil/` holds `dna.yaml`, `memory.yaml`, `roles.yaml`,
`workflows.yaml`, `directives/`, `memory/`, `workflows/`). Behaviours such as pushing after a
commit, signing commits, refusing self-approval, how strict workflow checks are, which agent runs
by default and whether an agent launch needs confirmation are not configurable anywhere.

No WingFoil element on the subject is known.

## Expected

A core settings file read by WingFoil, with keys such as `git.autoPush`, `git.runBranch`,
`git.signCommits`, `approve.reasonRequired`, `approve.noSelf`, `workflow.checks` (`block|warn`),
`agent.default`, `agent.launch` (`confirm|auto`), `notify.channel`. Wanted after v1.0: a client's
configuration page reads and writes it.

Suggested kind in WingFoil: decision-log.
