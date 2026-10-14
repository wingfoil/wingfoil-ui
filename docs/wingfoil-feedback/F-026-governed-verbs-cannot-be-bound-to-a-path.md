---
id: F-026
title: "Governed verbs pick the file of an id themselves: a duplicated id is not refused and no expected path can be given"
kind: gap
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Reports W-31.

## Observed

WingFoil 0.2.2 from npm, 2026-10-14. `memory submit|approve|reject <id>` looks the id up in the
working tree (`findMemoryDocumentById`, `dist/memory/query.js`, called by `dist/core/memory-transition.js`) and acts on the first file
that declares it. When two files declare the same id — e.g. an untracked copy of an element next to
it, which `memory search` also lists — nothing refuses the ambiguity: which file is rewritten and
committed depends on the lookup order.

A client that checks one file before calling the verb (no local changes, the status it showed the
user) cannot make the CLI act on that file: the verb takes no path, and between the client's check
and the CLI's own lookup another file with the same id can appear. The client can only detect the
mismatch afterwards, from the `path` of the answer — when the commit is already made.

## Expected

Either of:

- the governed verbs refuse an id declared by more than one file (exit 1, naming the files relative
  to the repository), before writing anything;
- or they accept the expected path (e.g. `--path <file>`) and refuse when the id's file is another.

Only the CLI can close this race: its lookup and its write happen in one process.

Suggested kind in WingFoil: gap (write guard; see also F-023, F-025).
