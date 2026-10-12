---
id: dl-007-hand-transitions-without-a-cli-verb-are-recorded-and-reported
type: decision-log
title: "Hand transitions without a CLI verb are recorded and reported"
status: ready
context: "retrospective" # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

With `wingfoil@0.2.2` several state transitions of this project have no verb and are done by editing
`status:` and committing `wf(<type>): <id> [<from> → <to>]` (with variants). Directive
`wingfoil-cli` records some of them: plan `active → done` (W-04) and task `backlog → in-progress`,
`approved → done` (W-20). The retrospective of `minor-v0.1` (dl-006, theme T4 of
`retrospective-rel-v0.1-plan`) found others with no W-entry:

- release `planning → in-development → releasing → released` (`df09286`, `677efa7`, `0f54194`),
  resting on a comment in `memory.yaml`; `df09286` cites W-04, which is about plans;
- approve-release, recorded as the approver's OK in chat (`release-submit-rel-v0.1-plan` RS-6);
- bug `triaged → planned`, `planned → in-progress` and the close notes before
  `resolved → closed` (Execution Notes of bug-001 … bug-007).

Also, W-22 and W-23 describe CLI behaviours the UI adapter must handle, but no feedback note in
`docs/wingfoil-feedback/` reports them, although the directive says a WingFoil gap becomes a note.

## Decision

**Every hand transition has a `wingfoil-cli` W-entry, and every CLI gap has a feedback note.**

- Add W-entries for the release-state transitions and approve-release, and for the bug
  transitions done by hand, each naming the commit form and the role that decides it.
- New release hand-transition commits cite the new entry, not W-04; `.wingfoil/README.md` lists
  the new entries beside W-04 and W-20.
- Add a feedback note F-020 for the release and bug hand transitions and approve-release, linked to
  the new entries; it does not duplicate WingFoil task-226, which already covers W-04.
- Add feedback notes for W-22 and W-23.

## Rationale

- A hand transition without a W-entry is a silent convention: a new agent or the UI cannot tell an
  allowed hand edit from an illegal one (directive `cli-only-writes`).
- One note for the release and bug transitions gives WingFoil a single request for the gaps not yet
  reported.
- Trade-off: the transitions stay manual until WingFoil adds verbs; this record only makes them
  explicit.

## Actions

- Add the W-entries to `.wingfoil/directives/custom/wingfoil-cli.md` and list them in
  `.wingfoil/README.md` beside W-04 and W-20 (tech-lead, before `release-planning` of
  `minor-v0.2`, following the sequence of plan decision RT-6).
- Add F-020 and the notes for W-22 and W-23 to `docs/wingfoil-feedback/` and its ledger
  (tech-lead, same change).
