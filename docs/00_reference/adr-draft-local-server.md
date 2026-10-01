# ADR draft — Local server driving the WingFoil CLI

**Status:** Draft — to be recorded as `adr-001` during `initial-design` (after `wingfoil init`)
**Date:** 2026-09-30 · **Updated:** 2026-10-01 (checked against wingfoil 0.2.2; aligned with the Vision Package, session 7)

## Context

WingFoil UI needs to read the whole project state and perform governed operations
(submit, approve, reject, start workflows, launch agents). WingFoil exposes:

- a **CLI** — the only write path, which produces the audited `wf(…)` commits and enforces
  state machines, gates and roles;
- an **MCP server** — read-only by construction, designed for agents.

A browser cannot run the CLI or read the repository directly.

## Decision

WingFoil UI is a **local server** (Node.js, same runtime as WingFoil) that:

1. serves the web UI on `localhost`;
2. performs **every governed read and write by invoking the observed project's own `wingfoil`
   CLI** (its pinned `node_modules/wingfoil`, else the one on the PATH — never a copy bundled with
   the UI) with `--format json`, in the project's working directory, through `execFile` with an
   argument array (no shell);
3. reads git directly only for what the CLI does not expose (HEAD, ahead/behind, working-tree
   status, `git log` for the Timeline, the working tree for the Files browser), and moves it only
   by fetch, `pull --ff-only` and push — never to change WingFoil state;
   future file edits from the Files page are plain git commits made by the server, outside
   WingFoil's Memory, and gated by the `files.edit` permission;
4. owns exactly one file of its own per project: `.wingfoil/ui.yaml` (see UX reference);
5. keeps the user's project list in its own local storage, outside any repository.

### Server API shape (indicative)

| UI need | Server endpoint | CLI call | WingFoil |
|---------|-----------------|----------|----------|
| Project config | `GET /p/:id/config` | `dna show`, `paths`, `directives list`, `workflow list` | 0.2.2 |
| Memory | `GET /p/:id/memory` | `memory search` | 0.2.2 |
| Element history | `GET /p/:id/memory/:eid/history` | `memory history <id>` | 0.2.2 |
| Gate action | `POST /p/:id/memory/:eid/{submit,approve,reject}` | `memory submit <id>` · `memory approve\|reject <id> --reason …` | 0.2.2 |
| Workflow | `GET /p/:id/workflow/status`, `/next` | `workflow status`, `workflow next` | 0.3 (spec-017) |
| Start ingestion / main | `POST /p/:id/workflow/start` | `workflow start …` | 0.3 (spec-017) |
| Launch agent | `POST /p/:id/agent/execute` | `agent execute …` | 0.3+ (spec-016) |
| Edit element fields | `PATCH /p/:id/memory/:eid` | `memory amend` / shared frontmatter setter | after task-127 / task-163 |
| Changes | `GET /p/:id/events` (SSE) | file watch + git HEAD | — |
| Timeline | `GET /p/:id/log?branch=&author=&q=` | `git log` (parsed `wf(…)` messages) | — |
| Files | `GET /p/:id/tree`, `GET /p/:id/file?path=` | working tree (confined to the repository), `git status --porcelain` / `git diff --name-only HEAD` for the "differs from HEAD" marker | — |

In 0.2.2 the only workflow read is `workflow list` (definitions, no run state); `submit` takes no
reason. Calls marked 0.3+ do not exist yet: the matching views stay read-only or hidden until the
pinned WingFoil version provides them.

### Snapshot, sync and security (from the Vision Package, session 7)

- **Snapshot:** the CLI reads the working tree (`memory search` returns uncommitted edits) while
  it gates writes on HEAD, and `memory submit` commits the target's uncommitted edits. The server
  therefore shows the working tree, marks elements with local changes, refuses governed actions on
  them, and keys its cache on HEAD **and** the `git status --porcelain` hash.
- **Behind the remote:** governed actions are refused until a fast-forward update succeeds.
- **Write classes:** governed (CLI, `wf(…)`), UI configuration (`ui.yaml`, `chore(ui)`), git
  transport, repository files (after v1.0).
- **Local security:** bind to loopback only; per-session token issued at launch; Origin and Host
  checks on every request (CSRF, DNS rebinding); opaque project ids; no shell; Files confined to the
  repository.
- **To decide here:** binary discovery order and its edge cases, version detection, the supported
  range and the JSON contract matrix per supported WingFoil version.

## Consequences

- **No divergence**: the UI can only do what the CLI allows; roles, gates and
  state machines are enforced by WingFoil, not re-implemented.
- **Coupling to the CLI contract**: the JSON output becomes an API (spec-005; a stability promise and published schemas are to be requested). Pin the
  supported WingFoil version, keep the consumed shapes as JSON schemas in `contracts/`, and run
  contract tests on every version advance.
- **Latency**: one process per call. Batch reads and cache per git HEAD.
- **Identity** comes from the local git config, as for the CLI — no separate login.
- Operations without a CLI verb (e.g. editing an element's fields or body, editing workflows,
  closing a plan `active → done`) are **read-only** in the UI until WingFoil provides them.
- `.wingfoil/ui.yaml` needs no WingFoil change: the CLI loaders read only the files they own.

## Alternatives considered

- **Import WingFoil's core as a library** — faster, but bypasses the CLI surface that owns
  audit and validation, and couples to internal APIs.
- **Use the MCP server** — read-only by design; would still need the CLI for writes.
- **Desktop app (Electron/Tauri)** — possible later packaging of the same local server.
