---
id: dl-001-initialise-wingfoil-before-inception
type: decision-log
title: "Initialise WingFoil before inception"
status: ready
context: "bootstrap"   # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

WingFoil UI follows the WingFoil repository's life cycle (`sw-life-cycle`), whose order is
inception → specification → init → delivery. WingFoil ran `init` after specification only because
its own tool did not exist yet: its inception and specification plans were ad-hoc `X_*-plan.md`
files, outside Memory.

For WingFoil UI the tool exists (`wingfoil@0.2.2`, pinned in `package.json`). Running `init` late
would leave inception and specification untracked: no `plan` elements, no `wf(…)` history, no
directives loaded for the roles doing the work.

## Decision

`wingfoil init` and the alignment of the configuration with the WingFoil repository
(`BOOTSTRAP.md` §1–2) run **first**. In `.wingfoil/workflows/custom/sw-life-cycle.yaml` the `init`
phase is the first phase, before `inception`; `wingfoil-init.yaml` describes it as such.

From then on every phase — inception and specification included — runs against its own `plan`
element (`docs/05_plans/{scope}/`), with scope `sw-life-cycle` for the phases before the first
release-line.

## Rationale

- Inception and specification become traceable like every later phase (plan element, state,
  `wf(…)` commits), instead of ad-hoc files.
- Roles and directives (`facilitator`, `product-owner`, `architect`, …) are declared before the
  phases that need them.
- The order is written in the workflow itself, so the future workflow engine (`workflow next`)
  reads the order actually followed.
- Trade-off: the configuration is decided before the product is; DNA modules and stacks are
  placeholders that `initial-design` confirms or replaces.

## Actions

- Before the first `release-cycle`, adapt the delivery workflows still copied as-is from WingFoil
  (`release-planning`, `dev-loop`, `user-docs`, `release-submit`, `release-publishing`, and the
  `initial-design` checks bound to WingFoil elements) — `BOOTSTRAP.md` §2.2. Owner: tech-lead.
- Keep the `wingfoil-cli` directive current at every advance of the pinned WingFoil version.
  Owner: tech-lead.
