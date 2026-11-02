---
id: F-018
title: "No per-gate role: approve and reject always need the approver role"
kind: gap
status: needs-info
wingfoil_version: 0.2.2
answered_by: []
---

Formerly W-13 candidate.

## Observed

WingFoil 0.2.2 from npm, 2026-10-09, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`. The git user is a team member whose only role is
`reviewer`; a task is submitted to `pending`. Then

```
$ wingfoil memory reject task-001-login-form --reason "needs work"
error: user not authorized to approve type 'task'
[exit 1]
$ wingfoil memory approve task-001-login-form --reason ok
error: user not authorized to approve type 'task'
[exit 1]
```

Both verbs require the `approver` role, whatever the type and the gate: a reviewer cannot send a
task in review back, and a product owner cannot decide a decision-log, unless each also holds
`approver`. WingFoil's own workflows declare `approval: { by_role: approver }` on their phases (for
example `bug-ingest.yaml`, seen in the WingFoil repository on 2026-10-09), but 0.2.2 does not
read that field for the Memory verbs.

**The answer to WingFoil's `needs-info`** (retro-v0.3; its read record says the reproduction was not
attempted for want of a reviewer-only member and a pending element). WingFoil 0.3.1 from npm
(`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux, 2026-11-02, in a scratch
repository made with `wingfoil init --template Kanban --no-interactive`, with two members:
`rev@example.invalid` (`reviewer` only, the repository's git identity) and `boss@example.invalid`
(`approver` only). The scaffold's `decision-log-ingest.yaml` `approve` phase is changed to
`role: reviewer` and `approval: { by_role: reviewer }`, committed (`workflow list` exit 0):

```
$ wingfoil workflow start decision-log-ingest                         # decision-log-ingest-1-plan
$ wingfoil memory add --type decision-log --title "Use Postgres" --workflow decision-log-ingest-1-plan
$ wingfoil memory submit dl-002-use-postgres                          # draft → pending
$ wingfoil workflow next --format json
  next: decision-log-ingest.approve@decision-log:dl-002-use-postgres, "role":"reviewer", members: rev@example.invalid
$ wingfoil workflow status --format json
  "pendingApprovals":[{"step":"decision-log-ingest.approve@decision-log:dl-002-use-postgres",…,
   "awaiting":{"kind":"approval","byRole":"reviewer","routedTo":[{"name":"rev","email":"rev@example.invalid"}],…}}]
$ wingfoil memory approve dl-002-use-postgres --reason ok --format json        # as rev, the reviewer
{"error":"user not authorized to approve type 'decision-log'"}
[exit 1]
$ wingfoil memory reject dl-002-use-postgres --reason "needs work" --format json
{"error":"user not authorized to approve type 'decision-log'"}
[exit 1]
$ wingfoil workflow finalize decision-log-ingest-1-plan --reason ok --format json
{"error":"phase 'decision-log-ingest.approve' completes from its evidence: state"}
[exit 1]
$ # as boss, the approver, whom the workflow does not route the gate to
$ wingfoil memory approve dl-002-use-postgres --reason ok --format json
{"id":"dl-002-use-postgres","path":"docs/memory/decision-log/dl-002-use-postgres.md","from":"pending","to":"approved"}
[exit 0]
```

So on 0.3.1 the workflow engine reads `approval: { by_role }` and routes the gate to the reviewer,
but `memory approve` and `memory reject` still check the `approver` role only: the routed reviewer
can neither pass nor send back the element, and an approver the gate is not routed to passes it.

## Expected

A gate can name the role that passes or rejects it (per type and gate in `memory.yaml`, or through
the workflow's `approval: { by_role }`), and `memory approve`/`reject` check that role.

Suggested kind in WingFoil: decision-log (check spec-017 and the workflow `approval` field).
