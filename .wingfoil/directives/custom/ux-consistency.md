---
id: ux-consistency
name: "UX consistency with the reference"
type: directive
kind: custom
title: "UX consistency with the reference"
tags: [custom, web, ux, design]
---

# Directive — UX consistency with the reference

**Version:** 1.1 · **Date:** 2026-11-18 (1.1: the UX reference alone is the reference, the prototype
historical evidence — dl-022, dl-020 action 1)

Applies to whoever designs, builds or reviews a screen of the `web` module, and to the
product-owner when scoping one.

## The rule

- `docs/00_reference/ux-reference.md` (principles, information architecture, screens, interaction
  rules, computations) is the **reference**; the prototype in `docs/00_reference/prototype/` stays
  as historical evidence (dl-020 action 1).
  A screen follows it unless an approved Memory element (adr, decision-log, tech-spec) says
  otherwise — then that element is cited and the reference is updated.
- Use the shared design tokens and components; no one-off colours, spacings or widgets.
- Same concept, same word: WingFoil terms (element types, states, gates, roles, phases) are shown
  as WingFoil names them.
- Every write action shows what the CLI will do and its result (the `wf(…)` commit or the CLI
  error), never a silent success.

## How it is checked

Review compares the screen with its section of the UX reference; deviations
without a cited element are rejected.
