# WingFoil UI

Local web UI for [WingFoil](https://github.com/wingfoil/wingfoil)-governed projects, served by a
local server that drives the `wingfoil` CLI.

> **Status: v0.1 — Read-only console.** Open any WingFoil project and read it safely: its Memory,
> elements, DNA, directives, team and documentation. v0.1 makes no governed change to a project:
> its only write is cloning a remote repository into a new folder. Gate decisions, the *Today*
> view and the other actions arrive from v0.2 (see [What v0.1 does not do](#what-v01-does-not-do)).

## What it is

`wingfoil-ui` starts a small Node.js server on your machine and opens the console in your browser.
For each project you add, the server runs **that project's own** `wingfoil` CLI (the one pinned in
its `node_modules`, else the one on the `PATH`) and reads its git repository; the browser shows
the result. The console is reachable only from your machine: the server listens on the loopback
addresses only, and every API request needs the session opened with the token printed at start.

What v0.1 shows:

| Area | What you get |
|------|--------------|
| Projects | add a local folder or clone a remote; switch between projects; remove one from the list (its files are not touched); unavailable projects marked with the reason |
| Project header | the project's WingFoil version against the supported range, missing capabilities, your identity from `git config user.email`, the role view for members with several roles, read-only notices |
| Memory | every element type of `.wingfoil/memory.yaml` with counts, state filters, *local changes* markers, live refresh |
| Element panel | state machine, rejection banner, summary, references (missing required fields flagged), directives, history with commits |
| DNA · Directives · Team | the project's DNA; directives with their bound roles and rendered body; team members with roles and pending gates, agents that never approve |
| Documentation | index of the DNA's `paths.docs` (without Memory and plan files), Markdown rendered inside the UI |
| Everywhere | keyboard access, WCAG 2.1 AA target, light and dark themes following the system, English strings from one catalogue (except React Aria's screen-reader-only "Dismiss") |

## Requirements

- **Node.js 22.12 or later** (`engines` of `package.json`; the launcher refuses an older version).
- **git**, with `user.email` set (it identifies you in each project's team): **2.43.4, 2.45.1 or
  later**, or a distribution build that carries the fixes of CVE-2024-32004 and CVE-2024-32465
  (cloning a local repository that someone else prepared could run their code). The console does
  not check the version — a distribution may ship the fixes under an older number — and refuses a
  local repository owned by another user whatever the version (POSIX only, not checked on
  Windows).
- In each project you open: a **WingFoil CLI** — pinned in the project (`npm install --save-dev
  wingfoil`) or on the `PATH` — inside the supported range below.
- A current desktop browser: Chrome, Edge, Firefox or Safari. On `main` the end-to-end suite
  runs on the **Chromium**, **Firefox** and **WebKit** engines; release v0.1.0 was tested on
  Chromium only.

## Install and run

WingFoil UI is not published on npm yet: v0.1 is released as the git tag `v0.1.0`. The npm
pipeline later releases go through, and the registry setup it needs first, are described in
[Publishing to npm](docs/publishing.md). Run it from a checkout:

```bash
git clone https://github.com/wingfoil/wingfoil-ui.git
cd wingfoil-ui
git checkout v0.1.0
npm ci
npm run build                 # server (tsc) and browser app (vite)
node bin/wingfoil-ui.cjs      # prints the URL and opens the browser
```

The terminal prints `WingFoil UI is running at http://127.0.0.1:<port>/#token=<token>` and the
console opens in your default browser. Stop it with Ctrl-C. Options (`--port`, `--no-open`, …):
[CLI reference](docs/cli-reference.md).

### Install from a package

The same checkout packs an installable package (`npm pack` builds it first). Install the tarball
in any folder and start it with `npx`:

```bash
npm pack                                   # in the checkout: wingfoil-ui-<version>.tgz
mkdir ~/wingfoil-ui && cd ~/wingfoil-ui
npm init -y
npm install /path/to/wingfoil-ui-<version>.tgz
npx wingfoil-ui                            # same options as above, e.g. --no-open
```

The package holds the launcher, the built server and browser application, the JSON contracts and
the message catalogue; its runtime dependencies are installed from npm. Install it before running
`npx wingfoil-ui`: no version of `wingfoil-ui` is on npm yet, and `npx` looks on the registry for
a command it does not find installed.

## Documentation

| Document | Content |
|----------|---------|
| [User guide](docs/user-guide.md) | launching, projects, every v0.1 view, themes and keyboard, local security, local state, troubleshooting, known limitations |
| [CLI reference](docs/cli-reference.md) | the `wingfoil-ui` command line: options, environment, output, exit codes |
| [CHANGELOG](CHANGELOG.md) | what each release adds |
| [Publishing to npm](docs/publishing.md) | for maintainers: the publish pipeline, the approver's registry checklist, the release runbook, the local staging smoke, the differences from WingFoil's pipeline |
| [`.wingfoil/README.md`](.wingfoil/README.md) | how this repository is governed with WingFoil (Memory types, workflows, roles, directives) |

## What v0.1 does not do

- No governed write: no submit, approve or reject, no ingestion, no field editing, no fetch, pull
  or push. The only write is cloning a remote into a new, empty folder.
- No *Today* view (v0.2): a project opens on its Memory list.
- No UI settings: the theme follows the system preference; forcing it arrives with the settings
  (v0.2).
- No workflow views, timeline, traceability, files or artifacts views, command palette or
  notifications (later releases, `docs/01_vision/07_sequencer.md`).

## Supported WingFoil versions

Each project runs its own pinned `wingfoil` (or, when it pins none, the one on the `PATH`). This
release supports **0.2.2 to 0.2.x**: from the declared minimum (`min` of `contracts/matrix.json`)
to the release line of the highest contract-tested version (adr-001 D3); a pre-release only when
the matrix lists it. A project outside the range, or whose `wingfoil --version` is not a semantic
version, opens read-only with the range in the reason.

Support matrix (contract-tested versions): `0.2.2`.

Capabilities (`contracts/capabilities.json`): a capability is read-only below its minimum version
and hidden when a project condition it needs does not hold.

| Capability | Minimum WingFoil | Provided by |
|------------|------------------|-------------|
| Type definitions | 0.2.2 | direct read of `.wingfoil/memory.yaml` |
| Element content | 0.2.2 | direct read of the element file |
| Directive body | 0.2.2 | direct read of the directive file |
| Gate decision | 0.2.2 | `memory approve` / `memory reject` |
| Workflow position | 0.3.0 | `workflow status` (WingFoil 0.3) |
| Next workflow step | 0.3.0 | `workflow next` (WingFoil 0.3) |
| Workflow start | 0.3.0 | `workflow start` (WingFoil 0.3) |
| Agent launch | 0.3.0 | `agent execute` (WingFoil 0.3) |
| Field editing | not released | a field-editing verb of a later WingFoil |

## Development

npm workspaces: `contracts/`, `server/`, `web/`. After `npm ci`:

| Script | What it runs |
|--------|--------------|
| `npm run build` | `tsc -b` (contracts, server) and the Vite build of `web/` |
| `npm run typecheck` | `tsc -b` and the test project |
| `npm run lint` | ESLint (incl. the no-shell rule on `server/`) and the message-catalogue check of `web/` |
| `npm run format` · `npm run format:check` | Prettier (code only: Markdown and YAML keep their hand layout) |
| `npm test` | Vitest: unit, component, contract and harness tests |
| `npm run test:coverage` | the same with v8 coverage (threshold 80 %) |
| `npm run test:contract` | the CLI JSON contract tests of `test/contracts/` |
| `npm run test:timing` | the timing suite (performance budgets) — on a quiet machine only |
| `npm run test:e2e` | Playwright end-to-end suite on the real launcher, on Chromium, Firefox and WebKit — the gate at the end of every wave and at release validation; `npm run test:e2e -- <spec files>` runs only those specs on the three engines |
| `npm run test:e2e:chromium` | the same suite on Chromium only — the inner development loop (with the task's own specs on the three engines) |
| `npm run test:smoke` | the launch smoke: packs the repository, installs the tarball into a temporary folder and starts it with `npx wingfoil-ui` |
| `npm run test:publish-smoke` | the staging publish smoke: publishes the packed package to a local registry with no uplink, installs it by name and starts it ([Publishing to npm](docs/publishing.md#local-staging-smoke)) |
| `npm run docs:api` | TypeDoc of `server/` and `contracts/` into `docs-api/` |

Browsers for the end-to-end suite, once per machine:
`npx playwright install chromium firefox webkit` and the WebKit system libraries
`sudo npx playwright install-deps` (Linux; needs administrator rights). Details of every suite:
[`test/README.md`](test/README.md). The governance CLI of this repository is the pinned
devDependency: `npm run -s wingfoil -- <command>`.

| Path | Content |
|------|---------|
| `bin/wingfoil-ui.cjs` | launcher: Node.js check, then the server entry point |
| `server/` | local HTTP server, CLI adapter, git reads, local state, launcher (`server/src/launcher/`) |
| `web/` | browser application (React), message catalogue `web/src/i18n/en.json`, theme tokens |
| `contracts/` | JSON schemas of the CLI output, the HTTP API and the local state; support matrix and capability table |
| `test/` | every test (unit, contract, e2e, timing) and the e2e harness |
| `docs/` | vision, requirements, backlog, Memory (`04_memory/`), phase plans (`05_plans/`), UX reference |
| `.wingfoil/` | WingFoil configuration of this repository ([`.wingfoil/README.md`](.wingfoil/README.md)) |

Agents start from [`CLAUDE.md`](CLAUDE.md); the bootstrap of this repository is in
[`BOOTSTRAP.md`](BOOTSTRAP.md).

License: MIT.
