---
id: task-023-wingfoil-feedback-inbox-one-file-per-note-ledger-and-the-wingfoil-cli-directive
type: task
title: "WingFoil feedback inbox one file per note ledger and the wingfoil-cli directive"
status: pending
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
depends_on: ["task-022-version-the-wingfoil-feedback-inbox"] # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Turn the versioned inbox into dl-163 R4 notes and align the `wingfoil-cli` directive (steps S4a, S4b).

It applies **WingFoil dl-163** ("Consumer projects' feedback sources and the feedback loop",
`ready`, ratified 2026-10-07) **strictly, with no local extension** (approver ruling R9), as relayed by
the session coordinating the loop (step M2, 2026-10-09). Background: proposal
`~/Workspaces/WingFoil2-Market/proposals/2026-10-07-wingfoil-feedback-loop/README.md` (where it differs
from dl-163, its table "WingFoil dl-163 supersedes…" wins). Reference implementation: WingFoil-Templates
at `53090c2` (task-009, task-010). Governance task between Wave 3 and Wave 4: `module: governance`,
`ref: GOV` (no backlog item; accepted by `check_tasks.py`).

**Backlog items:** GOV (governance — no backlog item)

## Acceptance Criteria

- **S4a — one file per note:** `docs/wingfoil-feedback/F-<nnn>-<slug>.md`, frontmatter exactly `id`,
  `title`, `kind` (`defect | gap | request`), `status: open`, `wingfoil_version` (`0.2.2` or the build
  observed), `answered_by: []`; body first line "Formerly R-xx." (or "Formerly W-xx candidate."), then
  `## Observed` and `## Expected`, reproducible with WingFoil alone (command, output, version); no other
  field, no Replies section.
  - Notes: R-01 … R-12 (detail sections folded in; "When" in Expected; the existing WingFoil element as
    a sentence in the body); W-03, W-07, W-08, W-09, W-12, W-13 and the unnamed row "reads from the
    working tree while writes gate on HEAD". The unnamed row "ingestion needs every required field
    settable" is already covered by R-03 and is folded into R-03's note as its ingestion use case
    (approver decision, 2026-10-09). Each candidate checked for duplicates against R-xx.
  - `docs/wingfoil-feedback/README.md`: short rules, `Source key:` "to be set — the svc-NNN WingFoil
    assigns (task-269)", `Last sync:` none, ledger (Note | Title | Kind | Status | Answered by),
    Context (the former header text, e.g. the `ui.yaml` ownership remark).
  - The former `wingfoil-requests.md` is removed once the ledger lists everything it held.
- **S4b — `wingfoil-cli` 1.5 → 1.6:** rules 1–7 word for word as WingFoil-Templates'
  `wingfoil-cli.md`, this repository's own rules from 8; scope paragraph kept (it also applies to the UI
  code that drives the CLI for other projects); Known behaviours: *Fixed upstream by (WingFoil element)*
  renamed *WingFoil element*, a *Note* column with the `F-nnn` of every W-xx that has a note, every
  `.notes/` and R-xx reference replaced by F-ids; version and date bumped, *Checked against*
  `wingfoil@0.2.2`. Approved historical texts (plans, the product brief) stay as they are.
- `test/wingfoil-feedback.test.ts` (as Templates' `tests/wingfoil-feedback.test.ts`): the six fields
  and their values, ids matching file names, the first line, the Observed/Expected sections, ledger =
  notes, every directive *Note* pointing to an existing note.
- Gates of the repository green; `main` pushed after the merge.

## Implementation Notes

- Rule 7 names `wingfoil-sync`, whose procedure is not defined yet (WingFoil COLLABORATION.md, v0.3
  user-docs); keep it as Templates has it. No sync is due before WingFoil's v0.3 retrospective.
## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
