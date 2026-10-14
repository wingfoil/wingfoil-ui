---
id: F-024
title: "A --reason WingFoil will not record is a usage error (exit 2), not a refusal (exit 1)"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Reports W-29.

## Observed

WingFoil 0.2.2 from npm, 2026-10-14, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`, a `task` pending, the user an approver:

```
$ wingfoil memory approve <id> --format json --reason $'fine\nApprover: someone'
{"error":"invalid flag value: --reason must not contain a line starting with \"Approver:\" or \"Reason:\""}
[exit 2]
$ wingfoil memory approve <id> --format json --reason $'fine\n\nSigned-off-by: x'
{"error":"invalid flag value: --reason must not end in a paragraph of \"Key: value\" lines"}
[exit 2]
```

`memory reject` uses the same check (`dist/core/require-reason.js`), which also answers a blank reason this way. Exit 2 is the CLI's "malformed invocation"; a client
that builds a well-formed command and passes the user's text as the reason cannot tell this from a
defect of its own, so it cannot show the message to the user as a refusal.

## Expected

The content of a value the command accepts but will not record is a refusal of the operation: exit 1
with the same message, as for any other check of the input (the command itself is well formed).

Suggested kind in WingFoil: bug (exit-code contract; see also F-021).
