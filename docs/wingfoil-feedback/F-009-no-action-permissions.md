---
id: F-009
title: "No action permissions: who may change settings, DNA, workflows, directives, team and content"
kind: request
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Formerly R-09.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`. A member whose only role is `reviewer` runs

```
$ wingfoil dna add team.members --value "Tester" --entry-email t@example.com --entry-roles reviewer
{ "key": "team.members", "value": "Tester" }
[exit 0]
```

and the change is committed (`wf(dna): add team.members Tester`). The only refusal by role is on
gates (`memory approve`/`reject` need `approver`); every other action — editing the DNA, workflows,
directives, the team or element content, starting an ingestion, launching an agent, pushing — is
open to anyone who can run the CLI. No command lists who may do what.

No WingFoil element on the subject is known.

## Expected

A `permissions` section in the core settings (F-005) mapping each action key (`cfg.wingfoil`,
`cfg.ui`, `cfg.perms`, `edit.dna`, `edit.workflow`, `edit.directives`, `edit.artifacts`,
`edit.team`, `mem.ingest`, `mem.edit`, `agent.launch`, `git.push`, `files.edit`) to
`{ roles: [...] | ['*'], people: [...] }`; the CLI refuses a forbidden action as it refuses an
approval without the `approver` role. Gate approvals stay governed by `memory.yaml`. A read verb
(for example `permissions list --format json`, or the rules in the `dna`/settings output) lets a
client show the table and dim forbidden actions, and a refusal names who may act. Wanted after
v1.0. Until WingFoil has it, a client defines no permissions of its own: every member may run what
the CLI allows (the WingFoil UI decided so on 2026-10-02, in its specification session 3: nothing
about permissions is stored in its `ui.yaml`, whose presets any member applies; the `cfg.ui` action
key would move them under this rule).

Suggested kind in WingFoil: decision-log.
