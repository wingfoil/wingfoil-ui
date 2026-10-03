---
id: spec-007-launcher-command-line
type: tech-spec
title: "Launcher command line"
status: pending
scope: "wingfoil-ui command line: options, Node.js check, output, exit codes, browser opening"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: ""   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

`npx wingfoil-ui` is the only way to start the console (REQ-ARC-01, S1, US-S-01). The scenarios
S-01.1…S-01.3 and spec-004 §1–2 fix pieces of it — the Node.js refusal message, the printed URL
with the token in the fragment, the loopback binding, `--port` — but not the whole command line:
options, what goes to stdout and stderr, exit codes, how the browser is opened without a shell
(REQ-SEC-05) and how the 3 s start budget (REQ-PERF-06) is met. Identified by `release-planning`
v0.1 (`identify-specs`).

## Specification

### 1. Synopsis

```
wingfoil-ui [--port <n>] [--no-open] [--version] [--help]
```

| Option | Meaning |
|--------|---------|
| `--port <n>` | listen on port `n` (1024–65535); default: a free port chosen by the OS |
| `--no-open` | do not open a browser; print the URL only |
| `--version` | print the package version (e.g. `0.1.0`) on stdout and exit 0 |
| `--help` | print the synopsis on stdout and exit 0 |

Unknown options or a malformed `--port` → usage message on stderr, exit 2. Environment: the only
variable specific to WingFoil UI is `WINGFOIL_UI_STATE_DIR` (spec-006 §1); standard platform
variables (`HOME`, `XDG_CONFIG_HOME`, `APPDATA`, `PATH`) are read as usual.

### 2. Node.js check

The `bin` entry is a minimal module that runs on any Node.js ≥ 14 and checks
`process.versions.node` before loading anything else. Below 22.12 it prints on stderr
`WingFoil UI needs Node.js 22.12 or later (found <major>.<minor>)` and exits 1 without opening a
port (S-01.2, REQ-ARC-01). The stub reads that text (`launcher.nodeTooOld`) from the server
catalogue (spec-008 §5) as plain JSON and substitutes `{major}` and `{minor}` itself — no
FormatJS is loaded before the check.

### 3. Start sequence

1. Parse options; check Node.js.
2. Resolve the state directory and read `state.json` (spec-006) — no project is read, no CLI is
   started before listening (REQ-PERF-06: URL printed ≤ 3.0 s). A listed project whose working
   tree contains the state directory (spec-006 §1) → stderr message naming both paths, exit 4.
3. Listen on `127.0.0.1:<port>`, then on `[::1]:<port>` with the same port; if IPv6 is not
   available the server continues on IPv4 only (REQ-SEC-01). Without `--port`, when `::1` refuses
   the port chosen for `127.0.0.1`, both listeners are closed and a new free port is tried (at
   most 5 tries, then exit 3). A given `--port` already in use on either address → stderr
   `Port <n> is already in use`, exit 3.
4. Draw the session token (spec-004 §2) and print on stdout one line:
   `WingFoil UI is running at http://127.0.0.1:<port>/#token=<token>` (S-01.1).
5. Unless `--no-open`, open the browser (§4).

### 4. Opening the browser

The URL (with its fragment) is passed as one argument to the platform opener, spawned with an
argument array and `shell: false` (REQ-SEC-05): `open <url>` (macOS), `xdg-open <url>` (Linux and
other Unix), `rundll32 url.dll,FileProtocolHandler <url>` (Windows). If the opener is missing,
exits non-zero or fails to spawn, the server prints `Open this URL in your browser: <url>` on
stdout and keeps running (S-01.3). The server never waits for the browser.

### 5. Output and logs

- stdout: only the lines of §3, §4 and §6 and the answers to `--version`/`--help`.
- stderr: refusals of §1–§3 and the server log (pino, level `info`; `--port` and start time at
  start), with `authorization` and `cookie` redacted (spec-004 §2). The token appears in no log
  line; the stdout line of §3 is the only place it is printed.
- Every launcher message comes from the server message catalogue (spec-008 §5).

### 6. Stop

`SIGINT` (Ctrl-C) or `SIGTERM`: stop accepting connections, close event streams, terminate the
CLI and git child processes the server started, print `WingFoil UI stopped` on stdout, exit 0.
A second signal exits at once with status 130. Every token and session dies with the process
(X-02.2).

| Exit status | Meaning |
|-------------|---------|
| 0 | normal stop, `--version`, `--help` |
| 1 | Node.js below 22.12 |
| 2 | usage error |
| 3 | `--port` in use, or no free port after 5 tries |
| 4 | the state directory lies inside a listed project (spec-006 §1) |
| 130 | forced stop (second signal) |
| other | unexpected failure (message on stderr) |

### 7. Verification

- e2e-smoke `launch`: S-01.1…S-01.3; REQ-PERF-06 (≤ 3.0 s, 10 of 10 runs); REQ-ARC-01 on Node.js
  20.x (exit 1, no port).
- Unit: option parsing table (exit 2 cases); opener command per platform, `shell: false`,
  fallback on spawn error; stop sequence leaves no child process.
- Manual check on Windows before the first release: the opened address keeps its `#token=…`
  fragment through `rundll32 url.dll,FileProtocolHandler`; if not, the opener becomes
  `explorer.exe <url>` (argument array, no shell; the URL is never placed inside an interpreted
  command string).
- Lint rule of REQ-SEC-05 (no `exec`, `execSync`, `shell: true`).

## Consequences

- Scripts and tests can drive the console with `--no-open --port <n>` and read the token from
  the stdout line.
- The `bin` stub must stay syntax-compatible with old Node.js versions; everything else may use
  Node.js 22 features.

## Process Notes

- 2026-10-03 — identified by `release-planning` v0.1 (`identify-specs`, plan session 2) at the
  user's request: the launcher was spread over S-01.x and spec-004 §1–2.
- 2026-10-03 — independent spec review (plan session 2): F2 exit 4; F3 environment wording; F4
  stdout includes the stop line; F5 the Node.js check reads the catalogue without FormatJS; F6
  port retry on `::1`; F21 Windows fragment check.
- 2026-10-03 — re-verification (plan session 2): N5 Windows fallback `explorer.exe`, no PowerShell
  command string.
