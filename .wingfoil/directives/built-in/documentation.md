---
id: documentation
name: "Documentation"
type: directive
kind: built-in
title: "Documentation"
tags: [built-in, documentation]
ref: [P3.8]
---

# Directive — Documentation

Applies to every role.

- Document every user-facing command and feature before it ships.
- Update the affected documentation in the same change that alters behaviour.
- Every public or exported API element carries a doc comment.
- Record decisions in project memory (ADRs for architectural decisions, decision-logs for product and process decisions), not scattered through the codebase.
- Keep cross-references between documents intact.
- Document why, not only what.

> Built-in WingFoil directive template. It cannot be removed. To adapt it, create
> `directives/custom/documentation.md` with `id: documentation`: a custom directive with the same id takes
> precedence over this one, and `wingfoil directives list` reports the override.
