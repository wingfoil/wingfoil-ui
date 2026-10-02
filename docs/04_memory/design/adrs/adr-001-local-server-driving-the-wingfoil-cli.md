---
id: adr-001-local-server-driving-the-wingfoil-cli
type: adr
title: "Local server driving the WingFoil CLI"
status: draft
sard_ref: "REQ-ARC-02"  # REQUIRED — REQ-* code (docs/02_requirements/03_sard/) or feature ID
supersedes: ""         # optional — id of the ADR this one replaces, e.g. "adr-002"
release: "v0.1"        # optional — implementation release this ADR is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

WingFoil UI must show the whole state of a WingFoil project and perform governed operations
(submit, approve, reject, ingestion; with WingFoil 0.3, workflow start and agent launch).
WingFoil exposes two surfaces: the **CLI** — the only write path, which makes the audited
`wf(…)` commits and enforces state machines, gates and roles — and an **MCP server**, read-only
by construction and designed for agents. A browser can neither run the CLI nor read a repository.

Forces (Vision Package and SARD v0.3):
- **No divergence from WingFoil** — WingFoil is the only writer of governed state; the UI keeps no
  second source of truth and no permissions of its own (`03_is-isnot.md`, directive
  `cli-only-writes`, REQ-ARC-03, REQ-SEC-07).
- **Any project, any version in range** — each project runs its own pinned CLI, whose JSON output
  is not yet a stable contract (WingFoil `spec-005`) (REQ-ARC-02, INT-01…03).
- **The CLI reads the working tree but gates writes on HEAD**, and `memory submit` commits the
  target's uncommitted edits — a UI action could commit someone's local edits or act on a stale
  copy (REQ-STATE-01…04).
- **A local web server is an attack surface** for other machines and other web pages
  (REQ-SEC-01…06).
- **Latency:** one CLI process per call; Today must render in ≤ 2 s warm (REQ-PERF-01, PERF-05).

Without this decision each view would invent its own access path (CLI, MCP, file parsing), and
the "no second source of truth" promise could not be verified.

Source: `docs/00_reference/adr-draft-local-server.md` (checked against WingFoil 0.2.2); its
"to decide here" items are decided in D2–D4 below.

## Decision

**D1 — A local Node.js server drives the project's own CLI.** WingFoil UI is a local server
(Node.js ≥ 22.12, the npm package `wingfoil-ui`, run with `npx wingfoil-ui` — REQ-ARC-01) that
serves the browser UI and performs every governed read and write by invoking the observed
project's `wingfoil` CLI with `--format json`, in the project root, through `execFile` with an
argument array (REQ-ARC-04, INT-04, SEC-05). The package declares no dependency on `wingfoil`.
The MCP server and WingFoil's internal modules are not used.

**D1a — Direct reads where the CLI has no read verb** (REQ-ARC-04). WingFoil 0.2.2 exposes no
type definitions, no element content (body and full frontmatter) and no directive bodies:
`memory search` returns `id`, `title`, `type`, `status`, `tags`, `path` only, and `directives list`
frontmatter and roles only (checked 2026-10-02). Until the project's CLI provides a read verb for
them (capability detection), the server reads, **read-only, from a closed allow-list**:
`.wingfoil/memory.yaml` (the keys the UI uses), the element files at the `path` `memory search`
returns, and the directive files at the `path` `directives list` returns. Each shape has a schema
in `contracts/` (D4); an element whose file `status` differs from `memory search` is a read error.
The server never writes these files.

**D2 — CLI discovery** (REQ-ARC-02), resolved when a project is opened or selected and again when
`node_modules/wingfoil/package.json` changes:
1. the project's pinned CLI: `<project root>/node_modules/wingfoil/package.json`, entry `bin.wingfoil`,
   run as `execFile(process.execPath, [<bin script>, …args])` — no shell and no `.bin` shim, the
   same on every OS. Only the project root (the folder holding `.wingfoil/`) is searched; parent
   folders are not;
2. otherwise the first `wingfoil` on the `PATH`, resolved by the server to an absolute path
   (no shell lookup); when that path is an npm shim, its package's `bin` script is run as in 1;
   the header says "(from PATH)" (S-08.2);
3. otherwise the project is not opened (S-10.1), or a listed project is marked *Unavailable*
   (S-10.2), with the install command.
The resolved binary is the one the CLI itself would use through `npm run wingfoil`: the installed
version counts, not the range written in `package.json`.

**D3 — Version detection and supported range** (REQ-INT-02, INT-03). The server runs
`<cli> --version` once per resolution and caches it with the binary path. The output must be a
semantic version; anything else is treated as outside the range ("unrecognised version"). The
supported range of a UI release is **from 0.2.2 to the highest WingFoil version contract-tested by
that release**, inclusive; pre-releases are outside unless the matrix lists them. Outside the
range the project opens read-only with the range in the reason (S-09.1, S-09.2). Inside it, each
capability is enabled, read-only with the reason, or hidden according to the capability table
(minimum version and project conditions per capability).

**D4 — Contract matrix** (REQ-INT-01, ARC-04). Every CLI command the server invokes is listed in the
CLI adapter, and every directly read file shape (D1a) in its reader; each consumed shape has a JSON
schema in `contracts/`, captured from a real
output of the version it records (`wingfoil_version`), plus the capability table. A contract test
runs every listed command against a fixture for **each version of the support matrix** (the
pinned version and every other supported release, installed in a temporary fixture). Output that
fails its schema is a read error shown as such, never guessed at. The matrix is published in the
package README; it advances only through `release-planning` (new WingFoil version → contract tests
re-run, directive `wingfoil-cli` re-checked).

**D5 — Process model.** Reads are batched: one CLI process per consumed command and repository
state, shared by every view and page (REQ-PERF-05). Writes are **serialised per project** — one
governed or git write at a time, queued — because each makes a commit; the cache is invalidated
after each write. Every process has a 30 s timeout, after which it is killed and the request fails
with the reason (REQ-INT-04).

**D6 — Snapshot and cache** (REQ-STATE-01…04, SEC-08). The UI shows the working tree, as the CLI
reads it, and marks elements with *local changes*. Cached reads are keyed on HEAD, a hash of
`git status --porcelain` and the effective `user.email`; changes are detected by file watching
with a periodic check as fallback. The server — not only the UI — refuses governed actions and
`ui.yaml` writes with **409** on an element with local changes or on a copy that is behind,
diverged or on a detached HEAD, and with **403** for users not identified in `dna.team`.

**D7 — Write classes and git interface** (REQ-ARC-03, INT-06). The server writes only through
(a) the CLI (`wf(…)` commits); (b) `.wingfoil/ui.yaml`, schema-validated, one `chore(ui)` commit
touching only that file; (c) git transport — `clone` into a new empty folder, `fetch`,
`pull --ff-only`, `push`; (d) repository files after v1.0 (L4). Git subcommands are a closed
list (REQ-INT-06): it never merges, rebases, resets, stashes or checks out.

**D8 — Local security** (REQ-SEC-01…06). Listen on loopback only (127.0.0.1, ::1); a new random
session token (≥ 128 bits) per start, in the printed URL, removed from the address bar after the
first load, required on every request and on the event stream, never logged or stored; Host and
Origin checked on every request (CSRF, DNS rebinding); opaque project ids, never paths, in URLs;
no shell; documents and files confined to the repository (`realpath`).

**D9 — Server ↔ browser.** An HTTP JSON API under `/p/:id/…` and **one authenticated event
stream per page** for change notifications and agent output; pages never poll (REQ-INT-09). The
indicative endpoint table of the ADR draft is the starting point of the *Server HTTP API*
tech-spec, which fixes the API.

**D10 — Local state.** The project list, role view per project, UI settings and action log live
in the operating system's user configuration directory, never in a repository (REQ-ARC-08).

## Consequences

- **Positive**
  - No divergence: the UI can only do what the CLI allows; roles, gates and state machines stay
    WingFoil's and are not re-implemented. Verifiable from git history alone (`wf(…)` /
    `chore(ui)` commits).
  - Any methodology and any WingFoil version in range, with no UI change per project.
  - Identity comes from the local git configuration, as for the CLI — no login.
  - A later desktop wrapper (Electron/Tauri) can embed the same server.
- **Negative**
  - **Coupling to the CLI's JSON output**, which becomes an API: schemas and contract tests per
    supported version, and work on every WingFoil advance (`release-planning`).
  - **Latency:** one process per call — about 0.4 s each on this repository with WingFoil 0.2.2
    (`memory search`, `--version`: 0.41–0.45 s warm, 0.85 s cold, measured 2026-10-02 on the
    maintainer's machine); mitigated by batching and the
    HEAD/working-tree cache, measured by REQ-PERF-01…05.
  - Operations without a CLI verb (editing fields or bodies, editing workflows, closing a plan
    `active → done`) stay **read-only** until WingFoil provides them (WingFoil task-127, task-163).
  - Running a project's own CLI means trusting its `node_modules` as much as the project's own
    `npm run wingfoil` does.
  - **Direct reads (D1a)** re-implement a small part of WingFoil's parsing (YAML frontmatter, the
    used keys of `memory.yaml`): a drift risk, bounded by the schemas, the `status` cross-check
    and the contract tests, and removed when WingFoil provides read verbs.
- **Neutral**
  - `.wingfoil/ui.yaml` needs no WingFoil change: the CLI loaders read only the files they own
    (W-11).
  - Writes are sequential per project; two projects can write in parallel.

### Alternatives considered

- **Import WingFoil's core as a library** — faster, but bypasses the CLI surface that owns audit
  and validation, couples to internal APIs, and would bundle one WingFoil version for every project.
- **Use the MCP server** — read-only by design; the CLI would still be needed for writes, and
  agents' tooling is not the human UI's contract.
- **Desktop application (Electron/Tauri)** — a packaging option for the same server after v1.0,
  not an architecture alternative.
- **Bundle a `wingfoil` with the UI** — rejected: the project's own pinned version is the one its
  team and agents use; a second version could write differently (REQ-ARC-02).

### Traceability

REQ-ARC-01, ARC-02, ARC-03, ARC-04, ARC-08 · REQ-INT-01, INT-02, INT-03, INT-04, INT-06, INT-09 ·
REQ-STATE-01, STATE-02, STATE-03, STATE-04 · REQ-SEC-01 … SEC-06, SEC-07, SEC-08 · REQ-PERF-01,
PERF-05 · features S1, S3, S8, X4 · scenarios S-08.1, S-08.2, S-09.1, S-09.2, S-10.1, S-10.2.

## Process Notes

- 2026-10-02 — drafted in initial-design session 3 (`initial-design-rl-v1-plan`) from the ADR
  draft; `sard_ref` = REQ-ARC-02 (the core of the decision), the full list above. Submitted only
  after the independent spec review (plan step 6).
- 2026-10-02 — session 5: D1a added (and D4 extended) after the CLI read surface of 0.2.2 was
  found not to cover type definitions, element content and directive bodies; SARD REQ-ARC-04
  v0.4 and directive `cli-only-writes` v1.4 changed accordingly.
