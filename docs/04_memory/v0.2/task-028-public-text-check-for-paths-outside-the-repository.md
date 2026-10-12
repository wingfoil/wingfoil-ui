---
id: task-028-public-text-check-for-paths-outside-the-repository
type: task
title: "Public text check for paths outside the repository"
status: backlog
release: "v0.2"
module: "governance"             # optional — server | web | contracts (dna.yaml modules)
priority: "medium"           # optional — high | medium | low
tags: ["v0.2","governance","public-text"]               # optional — additional labels, e.g. [today, a11y]
ref: "GOV"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

dl-006 action 4 (theme T9) and dl-005 *Actions* ("consider a check for local paths and session
names in committed text"), planned at `release-planning` (RP-3 (b), RP-42): a test that fails when
a tracked text file contains an absolute filesystem path outside the repository. Session names
stay an item of the review checklist: no pattern list naming private material is committed
(dl-005). Governance task (`module: governance`, `ref: GOV`).

**Backlog items:** GOV (governance — dl-006 action 4, dl-005)

## Acceptance Criteria

- **AC-1** A test in the default suite (e.g. `test/docs/public-text.test.ts`) reads every tracked
  text file (`git ls-files`, binary files excluded; untracked local files are never listed) and
  fails, naming file and line,
  on an absolute filesystem path outside the repository (POSIX home and root paths, Windows drive
  paths, `~/`-prefixed paths), except an explicit, commented allow-list of fictitious or generic
  example paths (e.g. the spec-006 `/home/alex/projects/kanban` example, `/tmp`, `/dev/null`).
- **AC-2** Negative test: a scratch file holding a real-looking outside path makes the check fail;
  the repository's tracked tree passes on the task's branch.
- **AC-3** The check names no private path, folder or session (dl-005); `test/README.md` lists it.
- **AC-4** `typecheck`, `lint`, `format:check`, `test:coverage` green.

## Implementation Notes

- dl-005 *Decision* (cite only public sources; name no internal session); dl-006 action 4.
- The allow-list lives next to the test, each entry with the reason it is not a real path.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
