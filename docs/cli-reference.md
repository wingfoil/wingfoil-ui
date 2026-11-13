# CLI reference — `wingfoil-ui`

**Version:** 0.7 · **Date:** 2026-11-11 (0.1: release v0.1; 0.2: `npx wingfoil-ui` from an installed package, Ctrl-C under `npx` — task-025; 0.3: release v0.2 user-docs — the command line is unchanged; the state directory's new content, the git environment of the transports, the automatic sync at start and at stop; 0.4: release v0.2.0 — `npx wingfoil-ui` from npm; 0.5: the console address file for scripts and agents — task-058; 0.6: Windows covered by unit tests only — its review round 1; 0.7: deep links across a restart with `--port` only, a page recovers in place — task-063)

The `wingfoil-ui` command starts the WingFoil UI console: a local server on the loopback addresses
and, unless told otherwise, the browser on its URL. It is the package `bin`
(`bin/wingfoil-ui.cjs`); from a checkout, after `npm ci && npm run build`, run it as
`node bin/wingfoil-ui.cjs [options]`; from npm, or from a folder where the package is installed,
as `npx wingfoil-ui [options]` ([README — From npm](../README.md#from-npm),
[README — Install from a package](../README.md#install-from-a-package)).

Sources: `bin/wingfoil-ui.cjs`, `server/src/main.ts`, `server/src/launcher/` (`options.ts`,
`start.ts`, `listen.ts`, `opener.ts`), messages in `server/src/i18n/en.json`; specification
`spec-007` (launcher command line), `spec-006` §1 (state directory), `spec-004` §1–2 (listening,
session), `spec-010` §4 and §6 (git transports, automatic sync).

In v0.2 the command line, its output lines and its exit statuses are the same as in v0.1; what the
started console does in addition (governed actions, git sync) is in the
[user guide](user-guide.md).

## Synopsis

```
wingfoil-ui [--port <n>] [--no-open] [--version] [--help]
```

There are no positional arguments and no short options: any other word (e.g. `serve`, `-p`) is a
usage error.

## Options

| Option | Meaning |
|--------|---------|
| `--port <n>` · `--port=<n>` | listen on port `n`, an integer from 1024 to 65535; default: a free port chosen by the operating system. Links to the console's pages survive a restart only with a fixed port: a page left open recovers in place once the new URL is opened in any tab of the same browser (adr-003 D6, D7) |
| `--no-open` | do not open a browser; print the URL only |
| `--version` | print the package version (the `version` of the root `package.json`, e.g. `0.2.0`) on stdout and exit 0 |
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
| `WINGFOIL_UI_STATE_DIR` | the local state directory (project list, role views, UI settings, action log, and the address file of each running console — [below](#address-file-for-scripts-and-agents)). A relative value is resolved against the current directory. It must lie outside every listed project (exit 4 otherwise) |
| `XDG_CONFIG_HOME` | Linux and other Unix except macOS, when `WINGFOIL_UI_STATE_DIR` is not set: state in `$XDG_CONFIG_HOME/wingfoil-ui` (an absolute value only), else `~/.config/wingfoil-ui` |
| `APPDATA` | Windows, when `WINGFOIL_UI_STATE_DIR` is not set: state in `%APPDATA%\wingfoil-ui` (else `<home>\AppData\Roaming\wingfoil-ui`) |
| `HOME` | the home directory (default state location; `~` in the paths you type in the UI; macOS state in `~/Library/Application Support/wingfoil-ui`) |
| `PATH` | where a project's `wingfoil` is looked for when the project pins none, and where `git` and the browser opener are found |

The `git` and `wingfoil` processes the server starts get the server's environment **without** the
variables that would point git at another repository or inject configuration (`GIT_DIR`,
`GIT_WORK_TREE`, `GIT_INDEX_FILE`, `GIT_CONFIG`, `GIT_CONFIG_PARAMETERS`, `GIT_CONFIG_COUNT`,
`GIT_CONFIG_KEY_<n>`/`GIT_CONFIG_VALUE_<n>` and the other redirecting `GIT_*` variables —
`server/src/git/git.ts`, bug-002). A clone, a fetch, an update and a push also run with
`GIT_TERMINAL_PROMPT=0` (git never asks for a password in the terminal), with `GIT_ALLOW_PROTOCOL`
set to `https`, `http`, `ssh`, `git` and `file` whatever the environment says (bug-013), and with
the absolute entries of `PATH` only. A fetch, an update and a push run ssh as
`ssh -o BatchMode=yes` when neither the environment (`GIT_SSH_COMMAND`, `GIT_SSH`) nor
`core.sshCommand` names an ssh command; the automatic fetch and update also run with an empty
`GIT_ASKPASS` and `SSH_ASKPASS_REQUIRE=never`, so no password dialog opens
(`server/src/git/transport.ts`, `server/src/projects/clone.ts`).

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
5. A new session token (32 random bytes, base64url) is drawn for each start; once the server
   listens, the console writes its [address file](#address-file-for-scripts-and-agents), then the
   URL with the token is printed on stdout.
6. Unless `--no-open`, the browser is opened on the URL (below).
7. The automatic sync starts: when *Auto-fetch* is on (the default), its first round runs one
   *Fetch interval* (60 s by default) after the start, for the projects opened since then
   ([user guide](user-guide.md#automatic-sync-with-the-remote)).

## Address file for scripts and agents

Each running console keeps a file `consoles/<port>.json` in the state directory (see
*Environment*), so that a script or an agent finds it without the token and without asking the
user (adr-003). The folder has mode `0700` and the file `0600` (on Windows, the access list of
`%APPDATA%`); the shape is `contracts/state/console-address.schema.json`:

```json
{
  "format": 1,
  "url": "http://127.0.0.1:4870/",
  "port": 4870,
  "portFixed": true,
  "pid": 41237,
  "host": "<os hostname>",
  "started": "2026-11-03T09:12:44.512Z",
  "version": "0.3.0"
}
```

- `portFixed` is `true` when the console was started with `--port`: links built on it keep the
  same address after a restart on the same port (adr-003 D7). Without `--port` the operating
  system picks a new port at every start, and links given out before a restart point to nothing.
- The file never holds the token, a session, a project path or id, an environment value or a
  credential.
- It is written before the URL line (a script that sees the line finds the file), its
  modification time is refreshed every 10 s while the console runs, and it is removed when the
  console stops. A console killed without a chance to clean up (`kill -9`) leaves it: the next
  start on the same state directory removes it.
- Two consoles on one state directory write two files. A state directory shared by two machines
  is not supported for discovery. A state directory owned by another user or writable by group or
  others, or a `consoles/` that is a symbolic link or another user's, gets no address file (a
  warning in the log); the console works without it. On Windows the address file's behaviour is
  covered by unit tests only: no Windows machine runs the test suites.

**How an agent cites an element as a link:**

1. List `consoles/*.json` in the state directory (resolved as under *Environment*).
2. Keep the files that pass the schema, whose `host` is this machine's, whose `pid` is a running
   process and whose modification time is less than 30 s old (older means the console stopped
   refreshing it); prefer `portFixed: true`, then the most recent `started`.
3. Find the project's id in `state.json` of the same directory
   (`contracts/state/state.schema.json`), by its repository root — read-only.
4. Cite `<url>p/<project id>/e/<element id>`; with no live console, cite the id without a link.

An agent never writes in the state directory, never calls the API (it has no token and must not
ask for one) and does not treat the file as proof that the page opens: the browser's own session
decides that.

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
| `--version` | the version, e.g. `0.2.0` |
| `--help` | the usage above |

These two URL lines are the only places the token is printed.

stderr carries the refusals below and the server log: JSON lines (pino), level `info`, with the
port, the bound addresses and the start duration (`startMs`) at start, then, among others, one
`git transport` line per fetch, update or push and the reasons an automatic sync skipped a
project. The `authorization` and `cookie` request headers are redacted, so neither the token nor
the session id reaches the log.

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
connections, starts no further automatic sync and, when an automatic update is running, lets it
finish first (the log says `stopping: the automatic update finishes first — send the signal again to
stop at once`), closes the browser event streams, terminates the `wingfoil` and `git` processes it
started, waits at most 5 s for the open requests, prints `WingFoil UI stopped` and exits 0. A second
signal during the stop exits at once with status 130, after killing every child process still
running. The address file is removed first, right after the console stops accepting connections,
and again at any exit (a forced stop, exit 70). The token and every browser session end with the process: a new start draws a new token.

Started with `npx wingfoil-ui`, Ctrl-C signals npm and the console together: the console stops as
above (exit 0, `WingFoil UI stopped`), but `npx` itself reports the signal, so the shell shows
status 130. A `SIGINT` sent to the console's own process alone ends `npx` with the console's
status, 0 (`test/smoke/launch.smoke.test.ts`).

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
WINGFOIL_UI_STATE_DIR=/tmp/wfui-try node bin/wingfoil-ui.cjs   # separate project list and settings
npx wingfoil-ui --no-open                      # the installed package, from its folder
```
