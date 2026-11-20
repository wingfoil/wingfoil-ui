---
id: testing
name: "Testing"
type: directive
kind: built-in
title: "Testing"
tags: [built-in, testing]
ref: [P3.8]
---

# Directive — Testing

Applies to developers and QA.

- Test first: write a failing test before the implementation (red, green, refactor).
- Classify each acceptance criterion before testing it: red-first when the behaviour is new, characterization when the behaviour already exists and the test is expected to pass on its first run. Never fabricate a failing test or add dead code to force one.
- Every behaviour has at least one happy-path test and one edge- or error-path test.
- Keep coverage at or above the threshold the project declares; coverage must not regress.
- Tests are deterministic and isolated: no reliance on external services, wall-clock time or randomness.

> Built-in WingFoil directive template. It cannot be removed. To adapt it, create
> `directives/custom/testing.md` with `id: testing`: a custom directive with the same id takes
> precedence over this one, and `wingfoil directives list` reports the override.
