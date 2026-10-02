---
id: spec-004-server-http-api-and-event-stream
type: tech-spec
title: "Server HTTP API and event stream"
status: draft
scope: "server HTTP API and event stream"              # REQUIRED — the artefact this spec covers, e.g. "server HTTP API", "CLI JSON contract: memory search", ".wingfoil/ui.yaml"
wingfoil_version: ""   # optional — for a CLI contract: the WingFoil version the shape was captured from
supersedes: ""         # optional — id of the tech-spec this one replaces, e.g. "spec-002"
release: "v0.1"            # optional — implementation release this spec is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

`adr-001` D9 puts an HTTP JSON API and one authenticated event stream per page between the
browser UI and the local server; `adr-002` builds them on Fastify with JSON Schema validation.
This spec fixes the routes, the session, the refusals and the events for v0.1–v0.3, and the slots
v0.4 fills (REQ-INT-09, REQ-SEC-01…06, REQ-SEC-08, REQ-STATE-03/04, REQ-INT-04). The indicative
table of `docs/00_reference/adr-draft-local-server.md` is its starting point.

## Specification

### 1. Listening and origin

- Listens on `127.0.0.1` and `::1` only, on the port given by `--port` or a free one (REQ-SEC-01).
- The browser application (static `web/` build) is served at `/`; every API route is under
  `/api/`; any other path returns the application (client-side routing).
- Every request — API, event stream and static files — passes the **Host check** (`127.0.0.1:<port>`,
  `localhost:<port>`, `[::1]:<port>`) and, when an `Origin` header is present, the **Origin check**
  (the console's own origin); failure → **403**, before any other work (REQ-SEC-03).

### 2. Session (REQ-SEC-02)

- At start the server draws a token of 32 random bytes (256 bits, base64url) and prints
  `http://127.0.0.1:<port>/#token=<token>`. The token sits in the **fragment**, which the browser
  never sends: it reaches no server log.
- On load the application reads the fragment, removes it from the address bar
  (`history.replaceState`) and sends `POST /api/session` with `Authorization: Bearer <token>`;
  the server answers with a cookie `wfui_session=<session id>; HttpOnly; SameSite=Strict; Path=/`
  (no `Max-Age`: it ends with the browser session). The session id is random and lives in memory.
- Every other `/api/` request and the event stream need **either** that cookie **or**
  `Authorization: Bearer <token>` (scripts and tests); otherwise **401**. A new start invalidates
  every token and session (X-02.2).
- Neither token nor session id is logged (pino redaction of `authorization` and `cookie`) or
  written to disk.

### 3. Routes

`:pid` is an opaque project id issued by the server (REQ-SEC-04); `:eid` a Memory id. Bodies are
JSON; every request and response body has a schema in `contracts/api/`.

| Method and path | Purpose | Since |
|-----------------|---------|-------|
| `POST /api/session` | exchange the start token for the session cookie | v0.1 |
| `GET /api/server` | UI version, supported WingFoil range, capabilities table | v0.1 |
| `GET /api/projects` | project list with availability (S2, REQ-STATE-07) | v0.1 |
| `POST /api/projects` `{path}` | add a local folder | v0.1 |
| `POST /api/projects/clone` `{url, directory?}` | clone a remote into a new empty folder, then add it (write class c) | v0.1 |
| `DELETE /api/projects/:pid` | remove from the list (no file is touched) | v0.1 |
| `GET /api/p/:pid` | project header: name, WingFoil version and range state, identity, role views, repository status | v0.1 |
| `PUT /api/p/:pid/role-view` `{role}` | remember the role view (local state) | v0.1 |
| `GET /api/p/:pid/config` | DNA, paths, workflows, resolved types (spec-001 §4.1), effective `ui.yaml` with origin of each value | v0.1 |
| `GET /api/p/:pid/elements[?archived=true]` | elements with their descriptor (spec-003) and local-changes marker | v0.1 |
| `GET /api/p/:pid/elements/:eid` | one element: frontmatter, body, descriptor, references | v0.1 |
| `GET /api/p/:pid/elements/:eid/history` | `memory history` entries (spec-002 §2) | v0.1 |
| `GET /api/p/:pid/directives`, `/directives/:did` | directive list; one directive with its body | v0.1 |
| `GET /api/p/:pid/docs` | documentation index (R4) | v0.1 |
| `GET /api/p/:pid/files/tree`, `/files/content?path=` | working tree, confined to the repository (REQ-SEC-06) | v0.1 (docs), v0.3 (Files) |
| `GET /api/p/:pid/today?view=<role>` | Requires you, Waiting on others, all-roles summary | v0.2 |
| `POST /api/p/:pid/elements/:eid/submit` `{expectedStatus}` | `memory submit` | v0.2 |
| `POST /api/p/:pid/elements/:eid/approve` `{expectedStatus, reason}` | `memory approve --reason` | v0.2 |
| `POST /api/p/:pid/elements/:eid/reject` `{expectedStatus, reason}` | `memory reject --reason` | v0.2 |
| `POST /api/p/:pid/git/fetch`, `/git/update`, `/git/push` | write class c (Y2–Y4) | v0.2 |
| `GET /api/settings`, `PUT /api/settings` | UI settings (C4, local state) | v0.2 |
| `GET /api/p/:pid/progress` | progress card figures (spec-005 §4) | v0.3 |
| `GET /api/p/:pid/events/memory?before=&limit=` | Memory events (spec-002 §3) | v0.2 (Updates), v0.3 (Timeline) |
| `GET /api/p/:pid/git/log?branch=&author=&q=&before=` | git tree (R7) | v0.3 |
| `POST /api/p/:pid/ingestions/:workflow` `{title, fields}` | ingestion start: `memory add` + `memory submit` (G5) | v0.3 |
| `POST /api/p/:pid/ui-config/preset` `{preset}` | apply a UI preset (write class b, spec-005) | v0.3 |
| `GET /api/p/:pid/workflow/status`, `/workflow/next`; `POST /api/p/:pid/workflow/start`; `POST /api/p/:pid/agents` | WingFoil 0.3 verbs; shapes fixed by v0.4 `release-planning` | v0.4 |

Write routes run through the per-project write lock (`adr-001` D5). `expectedStatus` is the
status the page showed: when the element's status differs, the write is refused with **409**
"This element changed since you opened it" — the user never decides on a stale view.

### 4. Write preconditions and refusals

Checked by the server, in this order, before any process starts:

| # | Condition | Status | `code` |
|---|-----------|--------|--------|
| 1 | Host / Origin | 403 | `forbidden-origin` |
| 2 | session | 401 | `unauthenticated` |
| 3 | project id unknown | 404 | `not-found` |
| 4 | user not identified in the team (REQ-SEC-08) | 403 | `not-in-team` |
| 5 | WingFoil version outside the range (REQ-INT-02) | 409 | `unsupported-version` |
| 6 | element file has local changes (REQ-STATE-03) | 409 | `local-changes` |
| 7 | copy behind, diverged or detached HEAD (REQ-STATE-04) | 409 | `stale-copy` |
| 8 | `expectedStatus` differs | 409 | `element-changed` |
| 9 | request body fails its schema | 400 | `invalid-request` |

The role required by a gate is **not** checked by the server: the CLI refuses it (REQ-SEC-07).

### 5. Responses

- Success of a write: `{ result: <CLI output>, commit: { sha, subject }, pushed: boolean }`
  (`pushed` when auto-push is on and succeeded, G4).
- Error envelope, every status: `{ error: { code, message, detail? } }`:

| Status | `code` | When |
|--------|--------|------|
| 422 | `cli-refused` | CLI exit 1: `message` = the CLI's message verbatim (REQ-INT-04) |
| 502 | `cli-output` | exit 0 with output failing its schema (spec-001 §2) |
| 504 | `cli-timeout` | killed after 30 s |
| 500 | `internal` | adapter defect (exit 2) or unexpected error; details only in the log |
| 422 | `git-refused` | a git transport command failed: git's message verbatim (REQ-INT-06) |

- Read responses carry `X-Repo-State: <HEAD sha>.<status hash>`; the page compares it with the
  event stream to know whether its data is current.

### 6. Event stream (REQ-INT-09)

`GET /api/events` — Server-Sent Events, one stream per page, authenticated by the session cookie
(EventSource sends it); comment heartbeat every 25 s. Events (`data` is JSON):

| `event` | `data` | When |
|---------|--------|------|
| `repo` | `{pid, state}` | HEAD, working-tree status or effective `user.email` of a project changed (REQ-STATE-02) |
| `projects` | `{}` | the project list or a project's availability changed |
| `settings` | `{}` | UI settings changed (another tab) |
| `write` | `{pid, eid?, commit}` | a write finished (other tabs show the result) |
| `agent` | `{pid, run, line}` | agent output (v0.4, REQ-PERF-08) |

On `repo`, pages refetch the queries of that project (TanStack Query invalidation, `adr-002`); a
reconnecting page refetches everything. Pages never poll.

### 7. Verification

- API tests for every row of §4 (status and `code`, 0 processes started), for §2 (fragment,
  cookie flags, 401 with a previous start's token) and for every route's schema.
- The local-security scenarios (`features/x/local-security.feature`) and REQ-SEC-01…06 fit criteria.
- With one page open and no change for 60 s, 0 CLI processes (REQ-INT-09).

## Consequences

- One error envelope and one precondition order for every write: the UI explains every refusal
  the same way, and API tests cover them as a table.
- `expectedStatus` adds a stale-view guard the SARD did not require; it costs nothing to the CLI.
- The token lives in the fragment and a session cookie: it never appears in server logs, and the
  event stream needs no token in its URL.

## Process Notes

- 2026-10-02 — drafted in initial-design session 5b from `adr-001` D8–D9, the ADR draft's endpoint
  table and the SARD; additions: `expectedStatus` (409 `element-changed`), the fragment +
  `SameSite=Strict` cookie session, 422 for CLI refusals. Submitted after the independent spec
  review (plan step 6).
