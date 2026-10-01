---
id: ux-consistency
name: "UX consistency with the reference and the prototype"
type: directive
kind: custom
title: "UX consistency with the reference and the prototype"
tags: [custom, web, ux, design]
---

# Directive — UX consistency with the reference and the prototype

**Version:** 1.0 · **Date:** 2026-10-01

Applies to whoever designs, builds or reviews a screen of the `web` module, and to the
product-owner when scoping one.

## The rule

- `docs/00_reference/ux-reference.md` (principles, information architecture, screens, interaction
  rules, computations) and the prototype in `docs/00_reference/prototype/` are the **reference**.
  A screen follows them unless an approved Memory element (adr, decision-log, tech-spec) says
  otherwise — then that element is cited and the reference is updated.
- Use the shared design tokens and components; no one-off colours, spacings or widgets.
- Same concept, same word: WingFoil terms (element types, states, gates, roles, phases) are shown
  as WingFoil names them.
- Every write action shows what the CLI will do and its result (the `wf(…)` commit or the CLI
  error), never a silent success.

## How it is checked

Review compares the screen with its section of the UX reference and the prototype; deviations
without a cited element are rejected.
