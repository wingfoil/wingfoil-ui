---
id: dl-012-console-links-for-agents-across-projects
type: decision-log
title: "Console links for agents across projects"
status: draft
context: "ad-hoc"            # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: "WingFoil maintainer (requests R1–R3, 2026-10-26)"        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

The WingFoil maintainer ruled on 2026-10-26 that the agents of the WingFoil projects should cite
Memory elements in their replies as links to a locally running WingFoil UI console
(`/p/<project id>/e/<element id>`), and sent four requests through the coordination channel. Tried on
WingFoil UI 0.2.0 (`6a5ad5c`), three needs stand in the way:

- **R1 — discoverable address.** Without `--port` the operating system chooses the port, and
  nothing on disk says where the console runs: the state directory holds only `state.json`.
- **R2 — short element ids.** `GET /api/p/:pid/elements/:eid` and `/p/<pid>/e/<eid>` match the full
  id only: `/e/task-243` answers *not found*, while people and agents cite the short id.
- **R3 — deep links across restarts.** A link opened in a browser whose session the console no
  longer knows shows "This page is no longer recognised by the console"; after the new console URL
  is opened, the user lands on the start page, not on the requested one. Every restart breaks the
  links already given out.

R2 touches the routes of bug-019 (ids over 100 characters), planned for v0.3. The fourth request,
R4, is a defect and is recorded as bug-024.

## Decision

**R1, R2 and R3 are accepted as inputs to the `release-planning` of `minor-v0.3`, which decides
their release (v0.3 or later), their solution and their tasks, within these constraints:**

- the session token never appears in a file, a link or a log;
- R1 defines the behaviour of two consoles on one state directory, and its file is readable by
  the user only;
- R2 is planned together with bug-019; a short id that matches several elements shows the
  candidates instead of *not found*;
- R3 changes the session model (adr-001, spec-007): it starts with a design spike, and its task
  gets the adversarial reviewer who runs the tools (dl-006).

## Rationale

- The need is shared by every project that cites Memory elements, and the console is the
  product's own view of them.
- Deciding the solution at `release-planning` keeps the scope of v0.3 in one place, with the
  release budget and dl-009's actions.
- R3 touches session security; a promise before a design spike could not be kept.
- Trade-off: the requester waits for the `release-planning` of v0.3, which waits for the
  governance-alignment pre-step (dl-010).

## Actions

- `release-planning` of `minor-v0.3`: release, solution and tasks for R1 … R3, R2 with bug-019
  (product-owner, tech-lead).
- Tell the requester the element ids and, after `release-planning`, the outcome (tech-lead).
