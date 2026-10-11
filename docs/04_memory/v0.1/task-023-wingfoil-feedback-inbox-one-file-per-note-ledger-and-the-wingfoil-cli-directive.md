---
id: task-023-wingfoil-feedback-inbox-one-file-per-note-ledger-and-the-wingfoil-cli-directive
type: task
title: "WingFoil feedback inbox one file per note ledger and the wingfoil-cli directive"
status: done
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
`ready`, ratified 2026-10-07) **strictly, with no local extension** (approver ruling R9), as relayed
in a cross-project request (step M2, 2026-10-09). Public sources: WingFoil dl-163 and WingFoil
`COLLABORATION.md` `## Credit` (`wingfoil/wingfoil` at `ec6a7ba5`); citation revised 2026-10-11
(dl-005). Reference implementation: WingFoil-Templates at `53090c2` (task-009, task-010). Governance
task between Wave 3 and Wave 4: `module: governance`, `ref: GOV` (no backlog item; accepted by
`check_tasks.py`).

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

### design (2026-10-09)

- No tech-spec involved. Authority: WingFoil dl-163 R4 strictly (R9); shape copied from
  WingFoil-Templates `53090c2` (`docs/wingfoil-feedback/`, `wingfoil-cli.md` 1.0,
  `tests/wingfoil-feedback.test.ts`, task-010's Execution Notes).
- **Numbering** (Templates' convention: old ids in order, then the new ones): R-01…R-12 →
  F-001…F-012; the candidates in table order W-03, W-07, W-08, W-09, W-12, W-13 → F-013…F-018; the
  unnamed "memory search reads the working tree" row → F-019. The unnamed "ingestion needs every
  required field settable" row folds into F-003 (R-03), approver decision.
- **Duplicate check of the candidates against R-xx:** W-01 → R-03 and W-04 → WingFoil task-226 (no
  note, as the old table said); W-08 and R-10 both concern the Kanban template but different files
  (`dna.yaml` roles vs ingestion workflows); W-13 (who passes a gate) is not R-09 (action
  permissions: R-09 keeps gate approvals under `memory.yaml`); W-03, W-07, W-09, W-12 and the
  working-tree row match no R-xx. No candidate is a duplicate.
- **Kinds:** defect = wrong behaviour of 0.2.2 or its templates (R-10, R-12, W-03, W-07, W-12);
  gap = a missing read/write capability of the CLI (R-03, R-04, R-11, W-08, W-09, W-13, F-019);
  request = a new feature or a promise (R-01, R-02, R-05…R-09). `wingfoil_version: 0.2.2` everywhere
  (the pinned build every observation was made on).
- **Reproduction:** every Observed section re-run on 2026-10-09 with the pinned `wingfoil` 0.2.2 in a
  scratch git repository under the session's temp directory (`init --template Kanban
  --no-interactive`, plus types copied into its `memory.yaml` where the observation needs them);
  nothing written to this repository's Memory.
- **Directive 1.6:** rules 1–7 word for word from Templates; this repository's own content that 1–7
  do not carry becomes rules 8+ (the `-s` reason; "update the entries that changed" at a pin
  advance). The scope paragraph stays. *Note* column added; *Fixed upstream by (WingFoil element)*
  renamed *WingFoil element*, its values kept.
- **Test:** `test/wingfoil-feedback.test.ts` (Vitest, `yaml` parser like `server/src/reads/
  frontmatter.ts`), checked by planted defects; `test/README.md` version bumped.

### red / green / refactor (2026-10-09)

- Commits: `e7656bd` the 19 notes and the README with its ledger; `9fd6ab8` `wingfoil-cli` 1.6;
  `07c9e3b` the test (red on the stray `wingfoil-requests.md`); `126eb50` the deletion of the former
  file (green); `1c711cd` `test/README.md` 0.19.
- **Mapping of the former inbox:**

  | Former | Note | Directive entry |
  |---|---|---|
  | R-01 | F-001 | — |
  | R-02 | F-002 | — |
  | R-03 (+ the unnamed "ingestion needs every required field settable" row) | F-003 | W-01 |
  | R-04 | F-004 | W-02 |
  | R-05 … R-09 | F-005 … F-009 | — |
  | R-10 | F-010 | W-16 |
  | R-11 | F-011 | W-18 |
  | R-12 | F-012 | W-21 |
  | W-03 | F-013 | W-03 |
  | W-07 | F-014 | W-07 |
  | W-08 | F-015 | W-08 |
  | W-09 | F-016 | W-09 |
  | W-12 | F-017 | W-12 |
  | W-13 | F-018 | W-13 |
  | unnamed "memory search reads the working tree while writes gate on HEAD" | F-019 | — |
  | W-01, W-04 candidates (already covered: R-03; WingFoil task-226) | no note | — |

- Every Observed section re-run with the pinned `wingfoil` 0.2.2 in scratch repositories under the
  session's temp directory (Kanban and Scrum `init`, custom types for F-012…F-014, a clone of the
  WingFoil repository at `1ce84a54` for F-017's read-only `directives list`). One claim of the
  former text was not reproducible and was left out of the notes (the directive keeps its wording):
  the `amendable` key of WingFoil's `memory.yaml` gives no warning on `memory search` in 0.2.2.
- WingFoil elements on the same subject found in the WingFoil repository (local `main` at
  `1ce84a54`) and stated in the note bodies, not in `answered_by` (rule 6): bug-214 (F-012),
  bug-163 / task-164 (F-014), bug-113 (F-017), dl-084 (F-019). The directive's *WingFoil element*
  column keeps its former values only.
- F-019 has no W-id: its first line is "Formerly an unnamed W-xx candidate."; the test accepts the
  three first-line forms.
- The test is a characterization test, checked by planting defects one at a time (each caught, then
  reverted): a status outside dl-163, an extra field, a wrong ledger title, a missing Expected, a
  directive *Note* naming F-099, a missing first line, a stray file, an id not matching its file, a
  kind outside dl-163, a Replies section.
- References to `.notes/wingfoil-requests.md` left unchanged: the product brief and the approved
  plans (approver decision), and `BOOTSTRAP.md` (lines 43, 60, 186; reported to the coordinator).
  R-xx references in the SARD (`04_integrations-interfaces.md`), the backlog (`R-09`) and approved
  plans are left as written; the mapping above resolves them.
- `npm run -s wingfoil -- directives list --format json`: `warnings: []`, empty stderr, `wingfoil-cli`
  listed.
- Gates: typecheck, lint, format:check OK; `test:coverage` 1647 passed / 1 skipped (statements
  96.48 %, branches 90.37 %, functions 97.05 %, lines 98.17 %); `docs:api` OK; `check_tasks.py` OK;
  `test:e2e` 60 passed (load 16.7); `test:timing` not needed (no timed path touched).

### review (2026-10-09)

- Independent review: **PASS** with 1 medium and 6 low findings. Decisions by the user
  (2026-10-09), all applied on the branch:

  | # | Decision | Commit |
  |---|---|---|
  | D54 | `BOOTSTRAP.md` §3: a dated note (task-023, dl-163) states the new rule — versioned inbox `docs/wingfoil-feedback/`, F-ids, R-01…R-12 = F-001…F-012, sync by `wingfoil-cli` rules 3–7; the old paragraph kept in the past tense; the bootstrap steps of §1 (the `.notes/` lines) stay historical | `84c0e68` |
  | D55 | SARD amended, dated: `04_integrations-interfaces.md` 0.6 → 0.7 (REQ-INT-01 R-01 → F-001, REQ-INT-07 R-02 → F-002) and `05_security-roles-governance.md` 0.4 → 0.5 (REQ-SEC-07 R-09 → F-009; its first *Process Notes* section), each with a Process Notes line; backlog regenerated with `build_backlog.py` (`backlog.json`, `by-release/v0.2.json`: the REQ-SEC-07 description); plans, brief, audit and task notes stay historical | `b3bfcc1` |
  | D56 | F-019's first line "Formerly an unnamed W-xx candidate." is accepted as a third form beside the AC's "Formerly R-xx." / "Formerly W-xx candidate." | — |
  | D57 | The WingFoil elements found on the same subjects (bug-214, bug-163 / task-164, bug-113, dl-084) stay sentences in the note bodies until the first sync | — |
  | D58 (medium) | W-12: the false `amendable` clause removed. Reproduced on 0.2.2 (scratch Kanban repository): an unknown key inside a `memory.yaml` type block (`amendable`, `bogus_key`) gives no warning on `memory search` or `memory add`; a top-level unknown key gives `unknown field(s) ignored: amendable` (from the working tree on `search`, from `HEAD:` on `add`). The entry now says so | `051f0b8` |
  | D59 | New entry W-24 (search reads the working tree, writes gate on HEAD, `submit` commits the target's uncommitted edits), with its workaround and *Note* F-019 | `fc0dff0` |

- Low fixes: the test refuses a Replies heading at any level (planted `### Replies` and
  `#### replies`: both caught, reverted) — `7fd10a7`; F-014's Expected limited to what Observed shows
  (WingFoil's configuration), F-019 and F-012 show the real outputs (F-012's `memory search` sentence
  now with its command and output) — `6a1b088`; README Context names the UI features F-005…F-009
  feed (Configuration › Permissions, L6, for F-009; journey 6 for F-008) — `a23f832`.
- These decisions supersede the "left unchanged" bullet of `### red / green / refactor` for
  `BOOTSTRAP.md` and the SARD; the mapping row for F-019 now has the directive entry W-24.
- Gates after the fixes: typecheck, lint, format:check OK; `test:coverage` 1647 passed / 1 skipped
  (96.48 / 90.37 / 97.05 / 98.17 %); `docs:api` OK; `check_tasks.py`, `check_releases.py`,
  `check_backlog.py` OK; `directives list` empty stderr; `test:e2e` skipped (load 26.6 > 20, no UI
  code touched; 60 passed before the fixes).

### integration (2026-10-09)

- Independent re-verification: **PASS**, no new findings (W-12 and W-24 reproduced on 0.2.2, SARD
  amendment and backlog regeneration limited to REQ-SEC-07, Replies caught at any heading level, no
  live `.notes/` or inbox R-id reference left).
- `main` merged into the branch: already up to date (the branch started after task-022's merge).
- Gates on the branch: `tsc -b`, lint, format:check, `check_tasks.py`, `check_releases.py` OK; `npm
  test` 1647 passed / 1 skipped (load ≈ 28); `test:e2e` not re-run (no UI code changed; 60/60 before
  the review fixes).
- After the merge `main` is pushed (approver decision "push before and after"), so WingFoil's
  task-269 `verify` can read `docs/wingfoil-feedback/README.md` on the pushed `main`.
