---
id: F-039
title: "memory search leaves out a Memory file without frontmatter, without type or status, or with a non-text id, with no warning"
kind: gap
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-47.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), Linux, 2026-11-07, in
a scratch git repository holding this repository's `.wingfoil/` and, under the Memory path
`docs/04_memory/bugs/`, one well-formed bug and three malformed files:

- `notes.md`, with no frontmatter;
- `bug-900-partial.md`, whose frontmatter has `id` and `title` but no `type` or `status`;
- `bug-901-numeric.md`, with `id: 5`, `type: bug`, `status: open` and `title: [a, b]`.

```
$ wingfoil memory search --format json
(stdout: one match, the well-formed bug; stderr: empty)
exit 0
```

The three files are in no list and no warning names them. Adding a fourth file whose frontmatter is
not valid YAML (`id: [unclosed`) leaves it out too, but with a warning on stderr:

```
{"warning":"W_MEMORY_UNREADABLE (docs/04_memory/bugs/bug-902-broken.md): unreadable frontmatter in docs/04_memory/bugs/bug-902-broken.md: unexpected end of the stream within a flow collection (2:1)"}
```

WingFoil 0.2.2 returned the first three files as matches with partial fields, which a client had to
validate per match. 0.3.1 fixed that, but a governed file edited by hand can now vanish from every
list without a word, while the unparsable case warns.

## Expected

One warning per file left out, as `W_MEMORY_UNREADABLE` does: for example `W_MEMORY_INVALID
(<path>): missing required field type` or `id must be a string`, on stderr, exit 0; the same from
every command that reads the Memory (`memory search`, `memory show`, the gate and workflow reads).

Suggested kind in WingFoil: gap (a missing diagnostic of the Memory read).
