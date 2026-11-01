---
id: architecture
name: "Architecture"
type: directive
kind: built-in
title: "Architecture"
tags: [built-in, architecture]
ref: [P3.8]
---

# Directive — Architecture

Applies to architects and the tech lead.

- Record every significant architectural decision as an ADR stating its context, the decision and its consequences.
- Every architectural decision references the requirement or requirements it implements.
- Keep modules cohesive and loosely coupled; a change in one module must not force edits in unrelated ones.
- Write a technical specification for every shared file format, schema, constant set or module API before the work that implements it starts.
- Before approving a specification or an ADR, check that it is internally consistent, consistent with the already-approved specifications, aligned with the acceptance criteria, and traceable to its requirements.

> Built-in WingFoil directive template. It cannot be removed. To adapt it, create
> `directives/custom/architecture.md` with `id: architecture`: a custom directive with the same id takes
> precedence over this one, and `wingfoil directives list` reports the override.
