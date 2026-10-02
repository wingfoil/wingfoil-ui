---
id: dl-002-permissions-left-to-wingfoil
type: decision-log
title: "Permissions left to WingFoil"
status: ready
context: "initial-design"            # optional — short label for the context, e.g. "retrospective", "planning", "ad-hoc"
release: ""            # optional — implementation release this DL is assigned to (stamped at release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

Inception accepted, as Q11 of `docs/01_vision/02_product-vision.md`, an **advisory permissions
table** in the UI (feature C3, stored in `.wingfoil/ui.yaml`) until WingFoil enforces action
permissions itself. Specification session 3 (2026-10-02) found that such a table would be a second
source of truth on who may do what — one that the CLI, the MCP server and the agents do not know,
and that any member could bypass from the terminal.

WingFoil 0.2.2 already enforces the only authority that matters for governed state: gates
(`memory approve` / `reject`) need the `approver` role (directive `wingfoil-cli`, W-13).

## Decision

**Permissions are WingFoil's.** WingFoil UI defines no action permissions of its own and stores
none — no `permissions` key in `ui.yaml`, no table in the UI's local state.

- Every team member may run, from the UI, what the CLI allows them to run.
- Gates are offered only to members holding the role WingFoil requires (0.2.2: `approver`);
  the others see them as informational, with the members who can act (REQ-SEC-07).
- Feature C3 is dropped from the MVP; showing WingFoil's own action permissions waits for WingFoil
  to implement them (L6, after the MVP).
- The UI's write refusals that remain are **not permissions** but safety rules enforced by the
  server: unidentified users (403, REQ-SEC-08), local changes or a stale copy (409,
  REQ-STATE-03/04).

Recorded in: `02_product-vision.md` v0.3+ (Q11 superseded), `03_is-isnot.md` v0.5+, `06_features.md`
v0.5+ (C3 dropped, L6), `07_sequencer.md` v0.4+, `08_mvp-canvas.md` v0.3+, directive
`cli-only-writes` v1.2+, SARD REQ-ARC-07 (schema rejects `permissions`) and REQ-SEC-07.

## Rationale

- **One owner for the rules:** permissions enforced by the UI only would be advisory, divergent from
  the CLI and invisible to agents — the "no second source of truth" promise of the product.
- **Honest security model:** the UI must not look like a security boundary between members
  (`03_is-isnot.md`); the CLI and git remain the boundary.
- **Less to build and migrate:** no C3 screens, no `ui.yaml` key to migrate when WingFoil adds its
  own permissions.
- Trade-off: until WingFoil implements action permissions, a team cannot restrict non-gate actions
  (e.g. submit) per role from the UI.

## Actions

- Ask WingFoil for action permissions readable by the CLI (tracked in the maintainer's WingFoil
  notes) — owner: maintainer.
- When WingFoil provides them, plan L6 in a later release-line — owner: product-owner.
