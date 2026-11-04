---
id: F-036
title: "A project's traceability chain is prose only: no client can read which references a type requires"
kind: request
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Not a CLI behaviour: traceability configuration.

## Observed

The `base` pack's `traceability` directive (`base@2.0.1`, `.wingfoil/directives/built-in/traceability.md`
in a project that adopts it) asks that "the project, or a pack it adopts, names its own chain (for
example decision → plan → task)", and leaves the links to the project. A project names it in prose:
this repository's custom directive `traceability-chain` names, in prose, the chain from feature
through user story, acceptance scenario and requirement to task and test. Nothing in `.wingfoil/` (`memory.yaml`, `dna.yaml`,
the directives' frontmatter) declares which reference categories an element type requires, nor which
values are references: WingFoil 0.3.1's `memory search --format json` returns `path`, `id`, `title`,
`type`, `status`, `tags` only (W-18), and no command reports a chain.

A client that shows traceability — WingFoil UI's traceability view and its missing-references
filter (release v0.3, spec-012, ux-reference §4.8) — must therefore read the chain from a file of its
own (`.wingfoil/ui.yaml`, `taxonomy.patterns` and `taxonomy.requires`, spec-005), which repeats what
the project already wrote in its directive, and can drift from it.

## Expected

A machine-readable chain in the project's configuration, read by WingFoil and by clients alike: for
example, per Memory type, the reference categories it requires (`requires: [requirement]` on
`task`) and how a value is recognised as a reference of a category (an element id, or an id pattern
for references outside the Memory such as `US-…`, `REQ-…`), with a read verb (or the type definition
read of F-011) that returns it. The `traceability` directive could then point to it instead of prose,
and a client could drop its own copy. Asked by WingFoil UI's release-planning of v0.3 (its decision
D9: traceability rows show ids only until such a chain exists).
