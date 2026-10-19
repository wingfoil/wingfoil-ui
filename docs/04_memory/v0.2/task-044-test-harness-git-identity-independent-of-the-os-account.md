---
id: task-044-test-harness-git-identity-independent-of-the-os-account
type: task
title: "Test harness git identity independent of the OS account"
status: in-progress
release: "v0.2"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.2","governance","ci"] # optional — additional labels, e.g. [today, a11y]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: ["bug-020-test-harness-takes-the-git-author-name-from-the-os-account-and-commits-fail-on-a-runner-without-a-full-name"]  # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-026-load-independent-tests-and-one-temp-folder-convention", "task-029-npm-publishing-pipeline-and-registry-setup-checklist"]  # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Release-validation task of minor-v0.2 (pre-step of `release-submit-rel-v0.2-plan`): the first CI run
of this repository — the `workflow_dispatch` dry run of `.github/workflows/publish.yml` on `main`
`08a84db` (RV2-5) — failed in *Tests with coverage*: 61 tests in 7 files could not commit because the
test harness's git configuration has no `user.name` and the runner's OS account has no full name
(bug-020, absorbed here). The suite must not depend on the machine's user account. Test-only
governance task (`module: governance`, `ref: GOV`); no product change.

**Backlog items:** GOV (governance — bug-020, release-validation dry run of minor-v0.2)

## Acceptance Criteria

- **AC-1 (bug-020)** Every commit a test makes gets its author from the harness configuration:
  `harnessEnv` (`test/harness/fixtures/builder.ts`) writes a `user.name` into its `.gitconfig` (no
  `user.email`: tests of unidentified users rely on none being set). A test (red first) fails when
  the harness configuration has no `user.name`, and shows that a commit in a fresh clone made with the
  harness environment succeeds with `user.useConfigOnly=true` style strictness (git refusing to guess
  the name from the OS account) — the closest local reproduction of the runner.
- **AC-2** Every other place where a test or test-support helper runs `git commit` (or a CLI verb that
  commits) outside the fixture environment is found and either moved onto the harness environment or
  given an explicit identity: unit, launcher, harness, smoke and e2e support (`test/e2e/support/`
  included). The search and its result are recorded in the Execution Notes.
- **AC-3** The whole suite passes with git unable to take a name from the OS account. Locally this is
  shown by running the affected files (or `test:coverage`) with an identity-strict setting the harness
  cannot bypass (decided at design: e.g. a wrapper or the `GIT_*`-stripping kept, plus a check), and
  in CI by the next `workflow_dispatch` dry run (run by the coordinator on the approver's OK after
  the merge).
- **AC-4** `typecheck`, `lint`, `format:check`, `test:coverage` (≥ 80 %), `test:e2e:chromium` (the e2e
  support changes), `docs:api` green, every heavy gate through the machine-free slot;
  `check_tasks.py v0.2` OK; `test/README.md` (the harness environment and the identity rule) and its
  version line updated; bug-020 follows this task's state (bug.sync_state).

## Implementation Notes

- `harnessEnv` strips every `GIT_*` and `XDG_*` variable and points `GIT_CONFIG_GLOBAL` at its own
  file with `GIT_CONFIG_NOSYSTEM=1`; git then falls back to the account's GECOS name for `user.name`.
- Tests that set `GIT_AUTHOR_NAME` themselves (`test/harness/commit-provenance.test.ts`,
  `test/harness/repo-state.test.ts`) keep working; e2e identities set only `user.email` (ES2-3).
- `.github/workflows/publish.yml` is not changed: the fix belongs in the tests
  (`test/package/publish-workflow.test.ts` freezes the workflow).

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
