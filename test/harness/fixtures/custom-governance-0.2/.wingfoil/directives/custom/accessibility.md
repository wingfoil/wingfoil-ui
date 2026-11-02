---
id: accessibility
name: "Accessibility of the web UI"
type: directive
kind: custom
title: "Accessibility of the web UI"
tags: [custom, web, accessibility, quality]
---

# Directive — Accessibility of the web UI

**Version:** 1.0 · **Date:** 2026-10-01

Applies to whoever builds, reviews or tests a screen of the `web` module.

## The rule

- Target **WCAG 2.1 AA** for every screen in a release's scope.
- **Keyboard:** every action — above all the gate actions (submit, approve, reject with reason) —
  is reachable and operable by keyboard, with a visible focus indicator and a logical focus order;
  dialogs trap and restore focus.
- **Semantics:** native elements first; ARIA only to fill gaps. Every control has an accessible
  name; status changes (action result, error, refresh) are announced through a live region.
- **Colour:** contrast AA in both light and dark themes; state is never conveyed by colour alone
  (element states carry a label or icon).
- **Motion and timing:** respect `prefers-reduced-motion`; no time limits on actions.

## How it is checked

- An axe-core scan per screen with zero serious/critical violations (dev-loop and e2e-smoke).
- The keyboard path of each gate action walked once per release (manual or Playwright).
