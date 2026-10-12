---
id: F-021
title: "With --format json, usage errors (exit 2) are JSON or plain text depending on the error"
kind: defect
status: open
wingfoil_version: 0.2.2
answered_by: []
---

Reports W-22.

## Observed

WingFoil 0.2.2 from npm, 2026-10-12, in a scratch repository made with
`wingfoil init --template Kanban --no-interactive`, after `memory add --type bug --title "Crash"`.
stdout is empty in every case; stderr shown:

```
$ wingfoil memory approve bug-001-crash --format json
{"error":"missing required argument: --reason"}
[exit 2]
$ wingfoil memory add --type bug --format json
{"error":"missing required argument: --title"}
[exit 2]
$ wingfoil memory search --bogus --format json
error: unknown option '--bogus'
[exit 2]
$ wingfoil memory approve bug-001-crash
error: missing required argument: --reason
[exit 2]
```

Positionals after `--` are taken literally, which is correct but worth stating:

```
$ wingfoil memory history --format json -- --version
{"error":"document not found: --version"}
[exit 1]
```

A client that asks for `--format json` cannot parse every failure the same way: a missing argument
answers JSON, an unknown option answers plain text, with the same exit status.

## Expected

With `--format json`, every error on stderr is the same JSON shape (`{"error": …}`), whatever the
exit status, including the usage errors of the argument parser.

Suggested kind in WingFoil: bug (CLI output contract; see also F-001).
