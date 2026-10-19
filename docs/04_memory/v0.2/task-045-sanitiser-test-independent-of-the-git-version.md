---
id: task-045-sanitiser-test-independent-of-the-git-version
type: task
title: "Sanitiser test independent of the git version"
status: backlog
release: "v0.2"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.2","governance","ci"] # optional — additional labels, e.g. [today, a11y]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-022-project-list-sanitiser-test-depends-on-git-quoting-the-gitdir-path-and-git-2.55-prints-null"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-040-update-and-push-from-the-sidebar", "task-044-test-harness-git-identity-independent-of-the-os-account"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.2 (pre-step of `release-submit-rel-v0.2-plan`): the second
`workflow_dispatch` dry run (run `39328350689`, `main` `f73294e`) failed on one test only — the bug-017
case "add: git quoting a gitdir with control and bidi characters" in
`test/server/http/projects.test.ts`, which relies on git quoting the `gitdir:` path in its refusal;
git 2.55 prints `fatal: not a git repository: (null)` (bug-022, absorbed here). Test-only governance
task (`module: governance`, `ref: GOV`); compact dev-loop (design and implementation in one pass, one
independent review), as decided by the approver.

**Backlog items:** GOV (governance — bug-022, release-validation dry run of minor-v0.2)

## Acceptance Criteria

- **AC-1 (bug-022)** The project-list sanitiser test still proves, through a real git refusal of an
  add (or clone) route, that control and bidi characters of git's text reach the body only as visible
  escapes — with a refusal whose text quotes data the test chose on every supported git version (2.43
  here, 2.55 on the runner), without branching on the git version and without weakening the
  no-raw-character assertion. The choice of refusal is recorded with a probe of git's text.
- **AC-2** Red first where possible (the new case fails on a sanitiser that passes raw characters:
  guard removal shown and recorded); the other bug-017 tests that depend on git's wording are checked
  for the same fragility (`grep` for assertions on git's messages in `test/server/http/` and
  `test/launcher/`), and any found is fixed the same way or recorded as safe with its reason.
- **AC-3** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %; through the slot, under the
  strict-identity and `followRemoteHEAD`-emulating wrapper of `test/README.md` *Git identity*) green;
  `check_tasks.py v0.2` OK; `test/README.md` version line if it changes; bug-022 follows this task's
  state. The CI evidence is the next `workflow_dispatch` dry run (coordinator, on the approver's OK).

## Implementation Notes

- The sanitiser is `redactLocalPaths` (server, task-040, bug-017); the e2e and server tests of bug-017
  live in `test/server/http/projects.test.ts` (*bug-017 — git-refused of the project list through the
  sanitiser*) and around the transport routes.
- Candidate refusals that quote test-chosen text: a clone of a URL with a bidi override in its path
  (the next test already does that over HTTP), a branch or remote name git quotes, a `gitdir:` that
  git 2.55 still reports; probe both behaviours, e.g. with a git-2.55-like message assumption avoided.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
