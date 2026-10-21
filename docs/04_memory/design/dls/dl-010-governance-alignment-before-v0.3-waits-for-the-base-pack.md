---
id: dl-010-governance-alignment-before-v0.3-waits-for-the-base-pack
type: decision-log
title: "Governance alignment before v0.3 waits for the base pack"
status: in-discussion
context: "retrospective" # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

The retrospective of `minor-v0.2` (plan `retrospective-rel-v0.2-plan`, decision RT2-6; dl-009)
found frictions that belong to the governance configuration, not to the product:

- the pinned WingFoil is 0.2.2 while WingFoil 0.3.0 is the `latest` on npm (plan
  `retrospective-rel-v0.2-plan` *State at start*); WingFoil-Templates is preparing a `base` pack
  (`e2e-smoke-rel-v0.2-plan` *For the retrospective*);
- W-27 cost a full redo of the 17 task ids at `release-planning` of v0.2 and recurred at task-043:
  the placeholders of its workaround must be named like the type's files, which the entry does not
  say (`minor-v0.2` Execution Notes *Planning*; `e2e-smoke-rel-v0.2-plan` *For the
  retrospective*); WingFoil reports the counter fixed after 0.2.2 (W-27 *Note* column);
- the feedback inbox `docs/wingfoil-feedback/` has 26 notes, all `open`, and was never synced (GA-5
  skipped the sync); a note on WingFoil's publish pipeline cannot be filed because the first-line
  rule of `test/wingfoil-feedback.test.ts` admits only notes migrated by task-023 or reporting a
  `wingfoil-cli` W-entry;
- the header of `.wingfoil/workflows/custom/release-publishing.yaml` (1.2) still says the npm
  pipeline is planned for `minor-v0.2`.

v0.2 started with a `governance-alignment` pre-step (`governance-alignment-rel-v0.2-plan`, ~1 h)
that carried out dl-007 and dl-008 before planning.

## Decision

**`minor-v0.3` starts with a `governance-alignment` pre-step, before its `release-planning`, and
the pre-step waits until WingFoil-Templates has published its `base` pack.**

The pre-step:

- advances the `wingfoil` pin to 0.3 only if the contract tests pass on it; otherwise the pin stays
  at 0.2.2;
- adopts the `base` pack for `.wingfoil/`, re-applying the tailoring of dl-008 on top of it;
- re-checks directive `wingfoil-cli` against WingFoil 0.3: W-27 is limited to 0.2.2 if 0.3 fixes
  the counter, otherwise its workaround says that placeholders are named like the type's files
  (e.g. `task-<n>-placeholder.md`);
- widens the first-line rule of `test/wingfoil-feedback.test.ts` to notes that report no CLI
  behaviour, files the publish-pipeline note as the next F-note, and runs the first feedback sync;
- corrects the header of `release-publishing.yaml`.

## Rationale

- Adopting the `base` pack and the new pin in one reviewed change, before planning, keeps the v0.3
  backlog planned against the configuration it will run under, as the v0.2 pre-step did for dl-007
  and dl-008.
- Waiting for the published `base` pack avoids aligning twice; the approver set this precondition.
- Gating the pin on the contract tests keeps the support matrix (`contracts/matrix.json`) true: 0.3
  is added only when its contract tests pass, and `wingfoil_min` may stay 0.2.2
  (`e2e-smoke-rel-v0.2-plan` *For the retrospective*); a red contract leaves the pin at 0.2.2.
- Deviation: the `$comment` of `contracts/matrix.json` says the matrix advances only through
  `release-planning`; this record moves that step to the pre-step that immediately precedes it.
- Trade-off: if the `base` pack is late, `release-planning` of v0.3 waits; any other course is a
  new decision of the approver.

## Actions

- Open the `governance-alignment` pre-step of `minor-v0.3` when the `base` pack is published, with
  the approver's OK (tech-lead).
- Carry out the five points of the Decision in that pre-step, reviewed by an independent reviewer
  before `release-planning` starts (tech-lead, reviewer).
- Remove the unfiled draft of the publish-pipeline note once it is filed (tech-lead).
