# CLI reference — `wingfoil-ui`

**Version:** 0.1 · **Date:** 2026-10-11 (0.1: release v0.1)

The `wingfoil-ui` command starts the WingFoil UI console: a local server on the loopback addresses
and, unless told otherwise, the browser on its URL. It is the package `bin`
(`bin/wingfoil-ui.cjs`); from a checkout, after `npm ci && npm run build`, run it as
`node bin/wingfoil-ui.cjs [options]` ([README](../README.md#install-and-run)).

Sources: `bin/wingfoil-ui.cjs`, `server/src/main.ts`, `server/src/launcher/` (`options.ts`,
`start.ts`, `listen.ts`, `opener.ts`), messages in `server/src/i18n/en.json`; specification
`spec-007` (launcher command line), `spec-006` §1 (state directory), `spec-004` §1–2 (listening,
session).

## Synopsis

```
wingfoil-ui [--port <n>] [--no-open] [--version] [--help]
```

There are no positional arguments and no short options: any other word (e.g. `serve`, `-p`) is a
usage error.

## Options

| Option | Meaning |
|--------|---------|
| `--port <n>` · `--port=<n>` | listen on port `n`, an integer from 1024 to 65535; default: a free port chosen by the operating system |
| `--no-open` | do not open a browser; print the URL only |
| `--version` | print the package version (the `version` of the root `package.json`) on stdout and exit 0 |
| `--help` | print the usage on stdout and exit 0 |

Parsing rules (`server/src/launcher/options.ts`, `test/server/launcher/options.test.ts`):

- Options may come in any order. `--help` and `--version` win over the other options (`--help`
  first), but only when the whole command line is valid: a usage error anywhere exits 2.
- `--port` takes its value as the next argument or after `=`. A missing or empty value, a value
  that is not made of digits only, or a number outside 1024–65535 is a usage error. When `--port`
  is given more than once, the last one counts.
- `--no-open`, `--version` and `--help` take no value: `--no-open=yes` is a usage error.

`--help` prints:

```
Usage: wingfoil-ui [--port <n>] [--no-open] [--version] [--help]

  --port <n>   listen on port n (1024–65535); default: a free port chosen by the OS
  --no-open    do not open a browser; print the URL only
  --version    print the version and exit
  --help       print this help and exit
```

## Environment

| Variable | Effect |
|----------|--------|
| `WINGFOIL_UI_STATE_DIR` | the local state directory (project list, role views). A relative value is resolved against the current directory. It must lie outside every listed project (exit 4 otherwise) |
| `XDG_CONFIG_HOME` | Linux and other Unix except macOS, when `WINGFOIL_UI_STATE_DIR` is not set: state in `$XDG_CONFIG_HOME/wingfoil-ui` (an absolute value only), else `~/.config/wingfoil-ui` |
| `APPDATA` | Windows, when `WINGFOIL_UI_STATE_DIR` is not set: state in `%APPDATA%\wingfoil-ui` (else `<home>\AppData\Roaming\wingfoil-ui`) |
| `HOME` | the home directory (default state location; `~` in the paths you type in the UI; macOS state in `~/Library/Application Support/wingfoil-ui`) |
| `PATH` | where a project's `wingfoil` is looked for when the project pins none, and where `git` and the browser opener are found |

The `git` and `wingfoil` processes the server starts get the server's environment **without** the
variables that would point git at another repository or inject configuration (`GIT_DIR`,
`GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_CONFIG`, `GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_COUNT`,
`GIT_CONFIG_KEY_<n>`/`GIT_CONFIG_VALUE_<n>` and the other redirecting `GIT_*` variables —
`server/src/git/git.ts`, bug-002). A clone also runs with `GIT_TERMINAL_PROMPT=0`: git never asks
for a password in the terminal.

## Start sequence

1. The `bin` checks the Node.js version before loading anything else: below 22.12 it exits 1
   (no port is opened).
2. The options are parsed (usage error → exit 2).
3. The state directory is resolved and `state.json` is read; no project is read and no CLI is
   started before the URL is printed. A listed project whose working tree contains the state
   directory → exit 4.
4. The server listens on `127.0.0.1:<port>`, then on `[::1]:<port>` with the same port; when IPv6
   is not available it continues on IPv4 only. Without `--port`, if `::1` refuses the port chosen
   for `127.0.0.1`, both are closed and another free port is tried, at most 5 times (exit 3 after
   that). A `--port` in use on either address → exit 3.
5. A new session token (32 random bytes, base64url) is drawn for this start and the URL is
   printed on stdout.
6. Unless `--no-open`, the browser is opened on the URL (below).

## Opening the browser

The URL, `#token=…` fragment included, is passed as one argument to the platform opener, started
without a shell: `open` (macOS), `xdg-open` (Linux and other Unix), `rundll32
url.dll,FileProtocolHandler` (Windows). When the opener is missing, fails to start or exits
non-zero, the console prints `Open this URL in your browser: <url>` and keeps running. The server
never waits for the browser.

## Output

stdout carries only these lines:

| When | Line |
|------|------|
| started | `WingFoil UI is running at http://127.0.0.1:<port>/#token=<token>` |
| the browser could not be opened | `Open this URL in your browser: http://127.0.0.1:<port>/#token=<token>` |
| stopped | `WingFoil UI stopped` |
| `--version` | the version, e.g. `0.1.0` |
| `--help` | the usage above |

The URL line is the only place the token is printed.

stderr carries the refusals below and the server log: JSON lines (pino), level `info`, with the
port, the bound addresses and the start time at start. The `authorization` and `cookie` request
headers are redacted, so neither the token nor the session id reaches the log.

| Message on stderr | Exit |
|-------------------|------|
| `WingFoil UI needs Node.js 22.12 or later (found <major>.<minor>)` | 1 |
| `Unknown option: <option>` / `Missing value for <option>` / `<option> takes no value` / `Invalid port: <value> (expected an integer from 1024 to 65535)`, each followed by the usage line | 2 |
| `Port <n> is already in use` | 3 |
| `No free port found after <tries> tries` | 3 |
| `The WingFoil UI state directory <stateDir> lies inside the project <path>: set WINGFOIL_UI_STATE_DIR to a folder outside every project` | 4 |
| `WingFoil UI stopped on an unexpected error: <message>` | 70 |

## Stopping

`SIGINT` (Ctrl-C), `SIGTERM` or `SIGHUP` (terminal closed) stop the console: it stops accepting
connections, closes the browser event streams, terminates the `wingfoil` and `git` processes it
started, waits at most 5 s for the open requests, prints `WingFoil UI stopped` and exits 0. A
second signal during the stop exits at once with status 130, after killing every child process
still running. The token and every browser session end with the process: a new start draws a new
token.

## Exit status

| Status | Meaning |
|--------|---------|
| 0 | normal stop, `--version`, `--help` |
| 1 | Node.js below 22.12 |
| 2 | usage error |
| 3 | `--port` in use, or no free port after 5 tries |
| 4 | the state directory lies inside a listed project |
| 70 | unexpected failure (e.g. an unreadable `state.json`, a missing `server/dist` build), message on stderr |
| 130 | forced stop (second signal) |

## Examples

```bash
node bin/wingfoil-ui.cjs                       # free port, opens the browser
node bin/wingfoil-ui.cjs --port 4800 --no-open # fixed port, prints the URL only
WINGFOIL_UI_STATE_DIR=/tmp/wfui-try node bin/wingfoil-ui.cjs   # separate project list
```
