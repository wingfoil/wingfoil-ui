---
id: task-022-version-the-wingfoil-feedback-inbox
type: task
title: "Version the WingFoil feedback inbox"
status: in-progress
release: "v0.1"
module: "governance"   # optional — server | web | contracts (dna.yaml modules)
priority: "high"       # optional — high | medium | low
tags: ["v0.1","governance","feedback-loop"]
ref: "GOV"             # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Version the WingFoil feedback inbox (step S1): move the local, git-ignored
`.notes/wingfoil-requests.md` **unchanged** to `docs/wingfoil-feedback/` on `main`, so that WingFoil
can register this repository as a `repository` service with `feedback_inbox: docs/wingfoil-feedback/`
(WingFoil task-269, whose `verify` reads the inbox on the pushed `main`). `.notes/` may stay
git-ignored for other local notes. The one-file-per-note format is task-023.

It applies **WingFoil dl-163** ("Consumer projects' feedback sources and the feedback loop",
`ready`, ratified 2026-10-07) **strictly, with no local extension** (approver ruling R9), as relayed by
the session coordinating the loop (step M2, 2026-10-09). Background: proposal
`~/Workspaces/WingFoil2-Market/proposals/2026-10-07-wingfoil-feedback-loop/README.md` (where it differs
from dl-163, its table "WingFoil dl-163 supersedes…" wins). Reference implementation: WingFoil-Templates
at `53090c2` (task-009, task-010). Governance task between Wave 3 and Wave 4: `module: governance`,
`ref: GOV` (no backlog item; accepted by `check_tasks.py`).

Also: `docs/03_backlog/X_tools/check_tasks.py` accepts a governance task of a release
(`module: governance` with `ref: GOV`, no backlog item) — done with this task's authoring, so that
the release's stop-check stays green.

**Backlog items:** GOV (governance — no backlog item)

## Acceptance Criteria

- `docs/wingfoil-feedback/wingfoil-requests.md` is byte-identical to the former
  `.notes/wingfoil-requests.md` and committed on `main`; the local copy is removed.
- `check_tasks.py` passes with the governance tasks (and still refuses a `governance` module without
  `ref: GOV`, or `GOV` with another module).
- `main` pushed to `origin` before and after (approver decision, 2026-10-09); the push state is
  reported to the coordinating session.

## Implementation Notes

- No product code changes; references to `.notes/` in the `wingfoil-cli` directive change in
  task-023 (S4b).
## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-09)

- No tech-spec involved; target path `docs/wingfoil-feedback/wingfoil-requests.md` (dl-163 inbox
  folder; the one-file-per-note split is task-023). `.notes/` stays git-ignored (`.gitignore` line 2)
  for other local notes; the new folder is not ignored (`git check-ignore` empty).
- `check_tasks.py` governance rule committed with the task authoring (`1d55674`), so the release's
  stop-check stays green; both refusal cases checked by hand (governance without `GOV`, `GOV` with
  another module).

### red / green / refactor (2026-10-09)

- Copied byte-identical (`cp -p`, sha256 `80c28eff…07c0` before and after) and committed (`5dd192d`).
  No test: a moved document; task-023 adds `test/wingfoil-feedback.test.ts` over the split notes.
- Gates: `tsc -b`, lint, format:check, `check_tasks.py` OK, `npm test` 1640 passed / 1 skipped.
- Push: `main` pushed before the task (`851ef46..0349e08`, 2026-10-09, approver decision "push
  before and after"); the after-push follows the merge.
