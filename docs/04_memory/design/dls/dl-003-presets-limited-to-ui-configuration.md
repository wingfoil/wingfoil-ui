---
id: dl-003-presets-limited-to-ui-configuration
type: decision-log
title: "Presets limited to UI configuration"
status: in-discussion
context: "initial-design"            # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

Feature C1 (`docs/01_vision/06_features.md`, Q7) offers **presets** — Kanban, Scrum and WingFoil's
`sw-life-cycle` — to a project without `.wingfoil/ui.yaml`, so that it renders with explicit
conventions on day one. "Preset" is a generic word: WingFoil's own `init --template` already
provides project templates, and WingFoil may define presets of its own in the future (for
methodologies, workflows or configuration).

The scope of the UI's presets must be fixed so that they never overlap with WingFoil's.

## Decision

**A WingFoil UI preset is only a content of `.wingfoil/ui.yaml`** — the values and configuration
the UI itself uses (`taxonomy`, `progress`, `artifacts`) — and nothing else.

- A preset never creates or changes WingFoil configuration (`memory.yaml`, `workflows.yaml`,
  directives, roles, DNA) or Memory elements: those stay WingFoil's (`init --template`, CLI verbs).
- It is offered only when `ui.yaml` does not exist, refused when it maps a type the project does
  not declare, validated against the `ui.yaml` schema, and written as one `chore(ui)` commit
  touching only `.wingfoil/ui.yaml` (write class (b), REQ-ARC-03, REQ-ARC-07).
- The UI's presets are **not WingFoil presets**. If WingFoil introduces presets of its own, they are
  WingFoil configuration, applied through WingFoil; the UI may then show or derive from them, and
  its own presets are re-examined so that the two do not overlap.

Recorded in: `06_features.md` (C1, Q7), SARD REQ-ARC-07, BDD conventions (preset variant) and
`features/c/ui-yaml.feature`; the scope limit and the distinction from future WingFoil presets
are recorded here.

## Rationale

- Keeps the UI's one owned file the only thing the UI writes outside the CLI (`cli-only-writes`).
- Avoids a naming and responsibility clash with WingFoil if it adds presets: the UI never becomes a
  second place where a project's methodology is configured.
- Trade-off: a UI preset cannot bootstrap a project's WingFoil configuration; that remains
  `wingfoil init --template`.

## Actions

- The `ui.yaml` tech-spec (`initial-design` session 5) names the presets "UI presets" and limits
  them to `ui.yaml` keys — owner: architect.
