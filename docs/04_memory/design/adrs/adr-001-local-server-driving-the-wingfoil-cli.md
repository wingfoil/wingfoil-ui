---
id: adr-001-local-server-driving-the-wingfoil-cli
type: adr
title: "Local server driving the WingFoil CLI"
status: accepted
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
The server never writes these files. **Exception:** hash-only reads of the changed and untracked
entries listed by `git status --porcelain`, for the repository state key (D6, REQ-STATE-02,
spec-001 §4.4); their content is neither kept nor exposed.

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
version counts, not the range written in `package.json`. Because the project's own CLI comes first,
discovery and the first CLI run happen only when the user **opens** the project: cloning a remote
runs no CLI of the cloned repository (spec-006 §3).

**D3 — Version detection and supported range** (REQ-INT-02, INT-03). The server runs
`<cli> --version` once per resolution and caches it with the binary path. The output must be a
semantic version; anything else is treated as outside the range ("unrecognised version"). The
supported range of a UI release is **from a declared minimum (`min` in `contracts/matrix.json`,
0.2.2 today) to the caret line of the highest WingFoil version contract-tested by that release**:
every version below the next minor for 0.x (`^0.2.2` → below 0.3.0, label `0.2.x`), below the next
major from 1.0 (`^1.0.3` → below 2.0.0, label `1.x`); a 0.0.z version is its own line. The range
is shown as `<min> to <label>` ("0.2.2 to 0.2.x"); pre-releases are outside unless the matrix
lists them. Outside the range the project opens read-only with the range in the reason (S-09.1,
S-09.2). Inside it, each capability is enabled, read-only with the reason, or hidden according
to the capability table (minimum version and project conditions per capability).

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
after each write. Clones, which have no project yet, are serialised on the write-lock key `clone`
(never a project id or a user path; spec-006 §3). Every `wingfoil` process and every git read has a 30 s timeout, after which it is
killed and the request fails with the reason (REQ-INT-04). Git transport (`clone`, `fetch`, `pull
--ff-only`, `push`) has no fixed timeout — it can take longer on large repositories — and the UI
offers to cancel it (the process is killed; git leaves the repository as it was).

**D6 — Snapshot and cache** (REQ-STATE-01…04, SEC-08). The UI shows the working tree, as the CLI
reads it, and marks elements with *local changes*. Cached reads are keyed on HEAD, a hash of
`git status --porcelain` combined with a fingerprint of the working-tree content of each changed
and untracked entry (computed by the server, no extra git command; a second edit of an
already-modified file changes the key) and the effective `user.email`; changes are detected by
file watching with a periodic check as fallback. The server — not only the UI — refuses governed
actions and `ui.yaml` writes with **409** on an element with local changes or on a copy that is
behind, diverged or on a detached HEAD, and with **403** for users not identified in `dna.team`.

**D7 — Write classes and git interface** (REQ-ARC-03, INT-06). The server writes only through
(a) the CLI (`wf(…)` commits); (b) `.wingfoil/ui.yaml`, schema-validated, one `chore(ui)` commit
touching only that file; (c) git transport — `clone` into a new empty folder, `fetch`,
`pull --ff-only`, `push`; (d) repository files after v1.0 (L4). Git subcommands are a closed
list (REQ-INT-06): it never merges, rebases, resets, stashes or checks out.

**D8 — Local security** (REQ-SEC-01…06). Listen on loopback only (127.0.0.1, ::1); a new random
session token (≥ 128 bits) per start, in the printed URL's fragment, removed from the address bar
after the first load and exchanged for a per-port `HttpOnly`, `SameSite=Strict` session cookie;
the token or that session is required on every API request and on the event stream (the static
application files, which hold no project data, are exempt), never logged or stored (spec-004 §2); Host and
Origin checked on every request (CSRF, DNS rebinding); opaque project ids, never paths, in URLs;
no shell; documents and files confined to the repository (`realpath`).

**D9 — Server ↔ browser.** An HTTP JSON API under `/api/` (projects under `/api/p/:id/…`) and **one authenticated event
stream per page** for change notifications and agent output; pages never poll (REQ-INT-09). The
indicative endpoint table of the ADR draft is the starting point of the *Server HTTP API*
tech-spec (`spec-004-server-http-api-and-event-stream`), which fixes the API.

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
- 2026-10-02 — spec review (step 6): D8 aligned with spec-004's session (F4); D5 timeout scoped
  to `wingfoil` processes and git reads, transport cancellable (F14).
- 2026-10-05 — dev-loop task-004 (independent review): "the package declares no dependency on
  `wingfoil`" is read as the **runtime** dependencies (`dependencies`, `peerDependencies`,
  `optionalDependencies`, bundled) of the published package. The root `devDependencies` pin of
  `wingfoil` is this repository's own governance CLI and the version the test harness builds
  fixtures with; `npx wingfoil-ui` never installs it. A package-review test asserts it is the
  only occurrence.
- 2026-10-06 — amended in dev-loop task-006 (Wave 2, plan dev-loop-rel-v0.1-plan): D3 range =
  declared minimum (`min` in `contracts/matrix.json`) to the caret line of the highest
  contract-tested version, labelled `0.Y.x` / `X.x` (replaces "to the highest contract-tested
  version, inclusive"); decided by the user.
- 2026-10-06 — amended in dev-loop task-010 (Wave 2, plan dev-loop-rel-v0.1-plan): D6 the cache
  key's status hash includes a fingerprint of the working-tree content of each changed and
  untracked entry (SARD REQ-STATE-02, spec-004 §5), and D1a gains the hash-only read exception
  for it; decided by the user.
- 2026-10-06 — amended in dev-loop task-008 (Wave 2, plan dev-loop-rel-v0.1-plan): D2 no CLI of a
  cloned repository runs at clone time, only when the user opens the project (the project's own
  CLI comes first); D5 clones serialised on the write-lock key `clone`; decided by the user.
