---
id: code-quality
name: "Code Quality"
type: directive
kind: built-in
title: "Code Quality"
tags: [built-in, code-quality]
ref: [P3.8]
---

# Directive — Code Quality

Applies to every role that writes or changes code.

- The linter reports no errors; warnings are triaged before a change is merged.
- Prefer small, single-responsibility functions and modules; keep complexity low.
- No dead code and no commented-out blocks.
- Match the style, naming and idioms of the surrounding code.
- Give public interfaces explicit types and validate external input at system boundaries.
- Keep each commit to one logical change with a descriptive message.

> Built-in WingFoil directive template. It cannot be removed. To adapt it, create
> `directives/custom/code-quality.md` with `id: code-quality`: a custom directive with the same id takes
> precedence over this one, and `wingfoil directives list` reports the override.
