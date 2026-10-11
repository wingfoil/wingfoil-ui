---
id: dl-008-workflows-inherited-from-wingfoil-are-tailored-at-wingfoil-sync
type: decision-log
title: "Workflows inherited from WingFoil are tailored at wingfoil-sync"
status: in-discussion
context: "retrospective" # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

dl-001 planned to adapt the workflows copied from WingFoil before the first `release-cycle`. The
retrospective of `minor-v0.1` (dl-006, theme T5 of `retrospective-rel-v0.1-plan`) found the
adaptation incomplete:

- `release-publishing.yaml` cites artefacts that do not exist here (`.github/workflows/publish.yml`,
  WingFoil adr-011, spec-015, dl-087, dl-024); its `publish` step was skipped by dl-004;
- `release-publishing.yaml`: the tag is `{release.version}` (`v0.1`) while this project tags
  `v0.1.0` (`user-docs-rel-v0.1-plan` RV-7); the release commit sits in `tag` but was made in
  `submit` (`release-submit-rel-v0.1-plan` RS-3);
- `release-submit.yaml`: the bug check `bugs where tags=[…]` does not match this project's bugs,
  which carry `release` / `release-origin` and no `tags` (`release-submit-rel-v0.1-plan` review
  round 1);
- `retrospective.yaml` `capture` produces `retro-{release.version}.md`, against the decision-log
  id pattern `dl-{n}-{slug}` (dl-006 Context).

`release-planning.yaml` (rewritten to v1.4), `e2e-smoke.yaml` and `user-docs.yaml` (UD-5) were
already tailored or deviated by plan decisions.

## Decision

**The inherited workflows are tailored to this project within `wingfoil-sync`, after the
retrospective of `minor-v0.1` (plan decisions RT-9, RV-10, RT-6).**

- `release-publishing.yaml`: remove or replace the WingFoil-only references; the tag name follows
  RV-7 (`v0.1.0` for release `v0.1`); the exact placeholder and where the release commit belongs
  are settled in the tailoring change, starting from RS-3.
- `release-submit.yaml`: the bug check matches the fields this project's bugs carry.
- `retrospective.yaml`: `produces` names a decision-log with the `dl-{n}-{slug}` id.
- Each changed workflow gets a version bump (directive `doc-versioning`).

## Rationale

- Running a phase against a workflow that names absent artefacts forced deviations recorded in
  the user-docs, release-submit and retrospective plans (RV-7, RS-3, RT-3); tailoring removes
  them for v0.2. UD-5 stays an accepted deviation: `user-docs.yaml` is out of scope.
- The `.wingfoil/` alignment with the WingFoil-Templates base pack that follows this
  retrospective (RV-10, RT-6) already reviews these files: tailoring in the same change keeps one
  diff to review.
- Trade-off: the tailored files drift further from WingFoil's; the existing "derived from
  wingfoil/wingfoil@…" header line keeps the origin traceable.

## Actions

- Tailor the three workflow files within the `wingfoil-sync` / alignment step, before
  `release-planning` of `minor-v0.2` (tech-lead).
