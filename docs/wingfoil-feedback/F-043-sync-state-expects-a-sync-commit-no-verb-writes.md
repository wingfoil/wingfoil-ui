---
id: F-043
title: "`<T>.sync_state` expects a `sync` commit that no verb writes, and `workflow finalize` does not check it"
kind: gap
status: open
wingfoil_version: 0.3.2
answered_by: []
---

Reports W-55.

## Observed

WingFoil 0.3.2 from npm (`0.3.2 (6de2e13c004bbf419acfa7dc4d98d5a7468cd693)`), Linux, 2026-11-21, on a throwaway
worktree of this repository with `'bug.sync_state(for_each: task.bug)'` added to the `start` and `review` phases of
`backlog-item`:

- `workflow next` names the bug the task lists in `bug:` and prints `[manual: expects wf(bug): sync <bug id>
  [planned → in-progress]]` at `start`, `[in-progress → in-review]` at `review`.
- No CLI verb writes a `wf(bug): sync …` commit: the move is `memory submit <bug>`, whose commit reads `wf(bug): submit
  <bug id>`. After `memory submit` of the task and of the bug the step leaves the frontier; `workflow finalize` does
  not compare the subject.
- The expected state is the source's state of the same name, or the target's last state when the source's is its
  type's last: at a task's `done` (its last state) the action expects the bug's `closed`, past the bug's gates
  (`workflow-next.js`, `expectedCommit`).

## Expected

A `sync_state` action that a verb can perform and whose expected commit names that verb (or a `memory sync` verb that
moves each target along its machine, through its gates, never past them).
