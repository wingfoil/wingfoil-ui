# MVP Canvas — WingFoil UI v1.0

**Version:** 0.1
**Date:** 2026-10-01
**Status:** Accepted in lean-inception session 5 (2026-10-01)
**Input:** `02_product-vision.md` · `04_personas.md` · `05_journeys.md` · `06_features.md` ·
`07_sequencer.md`

The **MVP** is the release-line v1 (`rl-v1`, v0.1 → v1.0). Its **first usable release** is v0.2.

---

## Problem

WingFoil projects are governed through a CLI and an MCP server. That fits developers and agents,
but for the humans on the loop:

- **Pending work is hidden** — finding gates, rejections and next steps takes several commands.
- **Human decisions are slow** — every approve/reject needs an id, a verb and a reason typed blind.
- **Non-technical roles are excluded** — a product owner cannot follow or decide without a developer.
- **Project state is never shown as a whole** — phase, progress, bugs, gates and traceability live
  in separate files.

## Solution

A **local web console over WingFoil and git**: a server that drives the project's `wingfoil` CLI
and a browser UI that shows each member what requires them and the whole project state, and turns
governed operations into one or two clicks — with WingFoil as the only writer.

## Value proposition

**For** the human members of WingFoil-governed projects
**WingFoil UI** is the human-on-the-loop console
**by** showing what requires each person first and executing every decision through WingFoil itself
— no second source of truth, any methodology.

## Personas and journeys

| Persona | Problem | MVP solution | Journey | Release |
|---------|---------|--------------|---------|---------|
| **Morgan** (approver) · primary | Gates scattered, decisions typed blind | Requires you + gate footer with all outcomes | J1 | v0.2 |
| **Casey** (product owner) · primary | Needs a developer to know anything | Progress card, readable decisions, traceability, deciding in the UI | J2 | v0.3 |
| **Jordan** (developer) | Next step and context spread across commands | Next step, agent launch with context and logs | J3 | v0.4 |
| **Sam** (reviewer) | Review context scattered | Element panel with everything; gate | J4 | v0.2 / v0.4 |
| **Alex** (solo maintainer) | Every role at once | Role views, all-roles summary, several projects | J0, J5 | v0.1 / v0.2 |
| **Riley** (newcomer) | No entry point | Read-only exploration, How to join | J6 | v0.1–v0.3 |

## MVP features

42 features in nine areas (`06_features.md`), delivered as:

| Release | Area | WingFoil | Delivers |
|---------|------|----------|----------|
| v0.1 | S — Read-only console | 0.2.2 | open and read any WingFoil project |
| v0.2 | G — Unblock | 0.2.2 | Today, gates in 2 clicks, sync — **first usable** |
| v0.3 | R — Project state | 0.2.2 | progress, traceability, timeline, files, ingestion, `ui.yaml` |
| v0.4 | A — Workflow and agents | 0.3 | next step, agent launch and logs |
| v1.0 | X — MVP complete | 1.0 | `npx wingfoil-ui` stable, support matrix, polish |

**Out of the MVP:** L1–L9 (editing content, DNA, directives, workflows and files; artifacts; external
notifications; core-enforced permissions; core settings; second language; hosted deployment).

## Success metrics

From the vision's success signals, to become SARD fit criteria:

| Metric | Target | Measured by |
|--------|--------|-------------|
| Time to see what requires me | 0 navigation steps: everything on Today | e2e: Today lists every item requiring the view's roles |
| Clicks to pass or reject a gate | ≤ 2 from Today | e2e click count |
| Methodology independence | A Kanban project and the WingFoil (`custom`) project render with no UI code change | e2e on both fixtures |
| No divergence from WingFoil | 100 % of UI writes are `wf(…)` commits made by the CLI; 0 direct writes to governed files | e2e: `git log` of the fixture after the suite |
| Accessibility | 0 serious/critical axe violations on every MVP screen | axe scan in e2e-smoke |
| Adoption (dogfooding) | WingFoil UI's own gates passed from the UI from v0.2; the WingFoil repository's from v0.3 | `wf(…)` history of both repositories |

## Cost and schedule

- **Team:** one maintainer (all roles) + AI agents executing as developer/reviewer/qa/architect.
- **Budget:** ≈ 30 active days from specification to v1.0 (`07_sequencer.md`), plus waiting time on
  WingFoil 0.3 and 1.0.
- **Running cost:** none — local software, public npm package, GitHub repository (`svc-001`).

## Risks

| Risk | Mitigation |
|------|------------|
| WingFoil 0.3 / 1.0 later than planned | v0.1–v0.3 need only 0.2.2; v0.4/v1.0 wait without blocking them |
| CLI JSON output changes between WingFoil versions | Contract tests per supported version; pinned CLI; directive `wingfoil-cli` |
| A UI that looks like a security boundary | Permissions labelled advisory; gates enforced by the CLI |
| Performance on large Memory (WingFoil has hundreds of elements) | Cache keyed on git HEAD; batch CLI reads (draft ADR) |
| Writing outside WingFoil by accident | Directive `cli-only-writes`; e2e check on the fixture's git log |
