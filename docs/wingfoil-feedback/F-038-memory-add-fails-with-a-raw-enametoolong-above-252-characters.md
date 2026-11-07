---
id: F-038
title: "memory add fails with a raw ENAMETOOLONG quoting an absolute path when the id would exceed 252 characters"
kind: gap
status: open
wingfoil_version: 0.3.1
answered_by: []
---

Reports W-46.

## Observed

WingFoil 0.3.1 from npm (`0.3.1 (870bd4406f3b9bba5ecde7a5f8198b80c2a98583)`), git 2.43, Linux,
2026-11-05, in a scratch repository made with `wingfoil init --template Kanban --no-interactive`.
A task is added with a title of 60 short ASCII words:

```
$ wingfoil memory add --type task --title "word word … word" --format json
{"error":"ENAMETOOLONG: name too long, open '<absolute path>/task-001-word-…-word.md'"}
exit 1
```

No element is written, no commit is made, and the number is not consumed (the next add is
`task-001`). Neither the title nor the id is capped: the longest id `memory add` writes is 252
characters, because `<id>.md` is then 255 bytes, the usual file-name limit. The slug keeps ASCII
letters only (`Caffè über naïve` → `caff-ber-na-ve`), so the limit in bytes and in characters
coincide for the ids WingFoil makes.

So a long title fails late, with an operating-system error that names neither the limit nor the
field, and that quotes the project's absolute path — text a client (a UI, a script) must sanitise
before showing or logging it.

## Expected

`memory add` checks the resulting file name before writing anything and refuses with a validation
error that names the limit and the field, with no path, for example `{"error":"title too long: the
id would be 260 characters, at most 252"}` (exit 1); or it truncates the slug to fit, deterministically,
and says so. The limit is documented with the id rules (`id_pattern`, the slug).

Suggested kind in WingFoil: bug (a validation gap of `memory add`).
