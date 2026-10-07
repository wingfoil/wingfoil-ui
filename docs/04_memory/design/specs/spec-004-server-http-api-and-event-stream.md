---
id: spec-004-server-http-api-and-event-stream
type: tech-spec
title: "Server HTTP API and event stream"
status: approved
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
  (one of the three accepted origins `http://127.0.0.1:<port>`, `http://localhost:<port>`,
  `http://[::1]:<port>`); failure → **403**, before any other work (REQ-SEC-03).
- On `/api/` requests and the event stream, a `Sec-Fetch-Site` header other than `same-origin`
  or `none` → **403** `forbidden-origin`, checked with the Origin check: a page served by another
  local port is *same-site* for the browser (cookies ignore ports) and its no-cors GET carries no
  `Origin`, so without this check it could make the console run a read. Requests without the
  header (scripts, tests, older browsers) are judged by the Host/Origin checks alone. A request
  carrying more than one `Host` header is refused the same way.

### 2. Session (REQ-SEC-02)

- At start the server draws a token of 32 random bytes (256 bits, base64url) and prints
  `http://127.0.0.1:<port>/#token=<token>`. The token sits in the **fragment**, which the browser
  never sends: it reaches no server log.
- On load the application reads the fragment, removes it from the address bar
  (`history.replaceState`) and sends `POST /api/session` with `Authorization: Bearer <token>`;
  the server answers with a cookie `wfui_session_<port>=<session id>; HttpOnly; SameSite=Strict;
  Path=/` (cookies are not scoped by port: the port in the name keeps two consoles apart)
  (no `Max-Age`: it ends with the browser session). The session id is random and lives in memory.
- The static application files (`/`, scripts, styles) are served **without** a session: they hold
  no project data, and the first load cannot carry the fragment token (REQ-SEC-02, SARD v0.5).
- Every other `/api/` request and the event stream need **either** that cookie **or**
  `Authorization: Bearer <token>` (scripts and tests); otherwise **401**. A new start invalidates
  every token and session (X-02.2).
- A 401 on the session exchange, on an API request or on the event stream's probe means the
  console no longer recognises the page (stopped and started again, or another console): the shell shows a full-page notice to open the URL printed in
  the terminal, and the page does not retry.
- Neither token nor session id is logged (pino redaction of `authorization` and `cookie`) or
  written to disk.

### 3. Routes

`:pid` is an opaque project id issued by the server (REQ-SEC-04); `:eid` a Memory id. Bodies are
JSON; every request and response body has a schema in `contracts/api/`.

| Method and path | Purpose | Since |
|-----------------|---------|-------|
| `POST /api/session` | exchange the start token for the session cookie | v0.1 |
| `GET /api/server` | UI version, supported WingFoil range, capabilities table, `warnings: [{ key, args }]` for the shell (spec-006 §4) | v0.1 |
| `GET /api/projects` | project list with availability (S2, REQ-STATE-07) | v0.1 |
| `POST /api/projects` `{path}` | add a local folder → 201 with the item | v0.1 |
| `POST /api/projects/clone` `{url, directory?}` | clone a remote into a new empty folder, then add it (write class c) → 201 with the item | v0.1 |
| `DELETE /api/projects/:pid` | remove from the list (no file is touched) → 204, no body | v0.1 |
| `GET /api/p/:pid` | project header: name, WingFoil version and range state, identity, role views, repository status | v0.1 |
| `PUT /api/p/:pid/role-view` `{role}` | remember the role view (local state) | v0.1 |
| `GET /api/p/:pid/config` | DNA, paths, workflows, resolved types (spec-001 §4.1); effective `ui.yaml` with origin of each value since v0.3 (REQ-ARC-07) | v0.1 |
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

**v0.1 bodies (addendum, dev-loop tasks 008 and 012).** The request and response bodies of the
v0.1 routes are defined by the schemas in `contracts/api/` (errors: `error.schema.json`):

| Route | Schema |
|-------|--------|
| `GET /api/server` | `server.schema.json` |
| `GET /api/projects` | `projects.list.response.schema.json` (items `projects.item.schema.json`) |
| `POST /api/projects` | request `projects.add.request.schema.json`; 201 `projects.item.schema.json` |
| `POST /api/projects/clone` | request `projects.clone.request.schema.json`; 201 `projects.item.schema.json` |
| `GET /api/p/:pid` | `project.schema.json` (identity part: `identity.schema.json`) |
| `PUT /api/p/:pid/role-view` | request `role-view.request.schema.json`; 204 |
| `GET /api/p/:pid/config` | `config.schema.json` |
| `GET /api/p/:pid/elements` | `elements.schema.json` (descriptor: `descriptor.schema.json`) |
| `GET /api/p/:pid/elements/:eid` | `element.schema.json` |
| `GET /api/p/:pid/elements/:eid/history` | `history.schema.json` |
| `GET /api/p/:pid/directives`, `/directives/:did` | `directives.schema.json`, `directive.schema.json` |
| `GET /api/p/:pid/docs` | `docs.schema.json` |
| `GET /api/p/:pid/files/tree`, `/files/content` | `file-tree.schema.json`, `file-content.schema.json` |

**Identity and role view (addendum, dev-loop task-009).** The identity part of `GET /api/p/:pid`
is `{ identity, roleViews, roleView }`, defined by `contracts/api/identity.schema.json`:
`identity` is one of `{ kind: "member", email, name, roles }`, `{ kind: "not-in-team", email }`,
`{ kind: "no-identity" }` or `{ kind: "ambiguous", email, members }` (two or more member names);
`roleViews` lists the role views the user can choose; `roleView` is the remembered one, or
`null` for the default — spec-006 stores the default as `roleView: ""`, the API exposes it as
`null`. `PUT /api/p/:pid/role-view` `{role}` (`contracts/api/role-view.request.schema.json`)
answers **204** with no body.

**Element states (addendum, dev-loop task-018).** `GET /api/p/:pid/elements/:eid` also carries
`states`: the resolved state machine of the element's type (spec-001 §4.1), so the element panel
draws its chips from one request. `states` is absent whenever `descriptor` is absent (memory
configuration unreadable, type undeclared).

### 4. Write preconditions and refusals

Checked by the server in this order (Fastify validates the body before the handler):

| # | Condition | Status | `code` | Evaluated from |
|---|-----------|--------|--------|----------------|
| 1 | Host / Origin | 403 | `forbidden-origin` | the request |
| 2 | session | 401 | `unauthenticated` | the request |
| 3 | project id unknown | 404 | `not-found` | the project list |
| 4 | request body fails its schema | 400 | `invalid-request` | the request |
| 5 | user not identified in the team (REQ-SEC-08) | 403 | `not-in-team` | the watched identity (REQ-STATE-02) |
| 5a | role not held by the member (`PUT /api/p/:pid/role-view` only) | 400 | `invalid-request` | the watched identity |
| 6 | WingFoil version outside the range (REQ-INT-02) | 409 | `unsupported-version` | the cached detection (`adr-001` D3) |
| 7 | element file has local changes (REQ-STATE-03) | 409 | `local-changes` | **fresh** `git status --porcelain`, under the write lock |
| 8 | copy behind, diverged or detached HEAD (REQ-STATE-04) | 409 | `stale-copy` | **fresh** `git rev-parse` / `rev-list --count`, under the write lock |
| 9 | `expectedStatus` differs | 409 | `element-changed` | **fresh** read of the element file, under the write lock |

Rows 1–6 start **no process**. Rows 7–9 run read-only git commands and a file read, never a
cached answer: `memory submit` commits the target's uncommitted edits (checked on WingFoil 0.2.2),
so a stale "no local changes" would let a UI action commit someone's work. No `wingfoil` process
starts before row 9 passes.

The role required by a gate is **not** checked by the server: the CLI refuses it (REQ-SEC-07).

Which rows apply to which writes: the governed writes on an element (`submit`, `approve`,
`reject`) run rows 1–9 as listed; row 5a applies to the role-view `PUT` only. The role-view
`PUT` is a **local-state write** (spec-006): rows 1–5 and 5a apply, rows 6–9 do **not** — in
particular row 6 (`unsupported-version`) does not, so a role view can be chosen on a read-only
project. "Not identified" in row 5 covers the identity kinds `not-in-team`, `no-identity` and
`ambiguous`; nothing is stored on a refusal.

### 5. Responses

- Success of a write: `{ result: <CLI output>, commits: [{ sha, subject }], pushed: boolean }`
  (`pushed` when auto-push is on and succeeded, G4); an ingestion lists its `add` and `submit`
  commits.
- Partial failure of an ingestion (`add` succeeded, `submit` refused): **422** `cli-refused` with
  `detail: { created: { id, path }, commits: [{ sha, subject }] }` — the toast names the draft
  created (REQ-INT-04).
- Error envelope, every status: `{ error: { code, message, detail? } }`:

| Status | `code` | When |
|--------|--------|------|
| 422 | `cli-refused` | CLI exit 1: `message` = the CLI's message verbatim (REQ-INT-04) |
| 502 | `cli-output` | exit 0 with output failing its schema (spec-001 §2) |
| 504 | `cli-timeout` | a `wingfoil` process killed after 30 s (git transport has no fixed timeout and is cancellable, `adr-001` D5) |
| 500 | `internal` | adapter defect (exit 2) or unexpected error; details only in the log |
| 422 | `git-refused` | a git transport command failed: git's message verbatim (REQ-INT-06) |
| 502 | `read-error` | a direct read of spec-001 §4 failed: `message` "Cannot read `<file>`" and the reason, `detail: { file, kind }` with `kind` one of `outside`, `missing`, `shape`, `mismatch` and `file` relative to the project (never absolute). Scoped to the element or directive read: a list never fails as a whole; an unreadable `memory.yaml` degrades only the type-dependent features. Logged as `{ kind, file }` only (`outside` at warn level) |
| 422 | project-list codes | refusals of `POST /api/projects` and `/projects/clone`: spec-006 §3 (`folder-not-found`, `not-wingfoil`, `already-listed`, `directory-not-empty`, `cli-not-found`, `state-dir-inside-project`, `directory-inside-project`, `inside-state-dir`, `git-refused` — also for a folder with `.wingfoil/` that is not a git repository) |
| 404 | `not-found` | also a refused working-tree path of `/files/tree` and `/files/content` (REQ-SEC-06): `detail.kind` one of `outside` (the "outside the repository" marker), `missing`, `not-allowed`, `too-large`; 0 bytes of the target |

- Read responses carry `X-Repo-State: <HEAD sha>.<status hash>`; the page compares it with the
  event stream to know whether its data is current. The status hash is the hash of
  `git status --porcelain` combined with a fingerprint of the working-tree content of each
  changed and untracked entry, computed by the server without an extra git command
  (REQ-STATE-02), so a second edit of an already-modified file changes the state; the header
  format is unchanged.

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
reconnecting page refetches everything. Pages never poll. When the stream cannot reach the
console for more than 10 s (it stays connecting, or a request fails at network level), the shell
shows a non-modal banner telling the user to open the URL printed in the terminal; the banner
goes away by itself when the stream reconnects. A network failure is not rendered as
`internal`.

### 7. Verification

- API tests for every row of §4 (status and `code`; 0 processes for rows 1–6, 0 `wingfoil`
  processes for rows 7–9), for §2 (fragment, cookie name and flags, static files without a
  session, 401 with a previous start's token) and for every route's schema.
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
- 2026-10-02 — spec review (step 6): F4 static files exempt, cookie name with the port, three
  accepted origins (REQ-SEC-02 amended in SARD v0.5, `adr-001` D8); F5 order 1-2-3-body-4…, rows 7–9
  evaluated fresh under the write lock; F16 `commits[]` and the ingestion partial failure.
- 2026-10-03 — release-planning v0.1 session 2: `ui.yaml` in `GET /config` from v0.3 (REQ-ARC-07
  moved to v0.3, SARD `01` v0.6); the rest of the route stays v0.1.
- 2026-10-03 — release-planning v0.1 session 2 (spec review of spec-006, F9): `GET /api/server`
  carries the shell warnings; the project-list refusal codes are defined in spec-006 §3.
- 2026-10-05 — amended in dev-loop task-003 (independent review F1, F2), decided by the user:
  §1 `Sec-Fetch-Site` check on `/api/` and the event stream (403 `forbidden-origin`), and a
  duplicate `Host` header refused. No route, code or envelope changes.
- 2026-10-05 — amended in dev-loop task-005 (independent review), decided by the user: §5
  `502 read-error` for a failed direct read (spec-001 §4), with its scope and logging rule.
- 2026-10-06 — amended in dev-loop task-009 (Wave 2, plan dev-loop-rel-v0.1-plan): §3 addendum
  (identity shape of `contracts/api/identity.schema.json`, role view `{identity, roleViews,
  roleView}`, role-view `PUT` → 204 no body); §4 row 5a (role not held by the member → 400
  `invalid-request`, after the not-in-team check) and which rows apply to which writes (the
  role-view `PUT` is a local-state write: rows 1–5 and 5a, not row 6); decided by the user.
- 2026-10-06 — amended in dev-loop task-010 (Wave 2, plan dev-loop-rel-v0.1-plan): §5 the status
  hash of `X-Repo-State` includes a fingerprint of the working-tree content of changed and
  untracked entries (REQ-STATE-02); header format unchanged; decided by the user.
- 2026-10-06 — amended in dev-loop tasks 008 and 012 (Wave 2, plan dev-loop-rel-v0.1-plan): §3
  project-list responses (201 with the item, 204 for `DELETE`) and the v0.1 bodies by schema of
  `contracts/api/`; §5 the project-list codes listed (new `directory-inside-project`,
  `inside-state-dir`; `git-refused` for a non-git folder) and a refused working-tree path → 404
  `not-found` with `detail.kind` ∈ {`outside`, `missing`, `not-allowed`, `too-large`}; decided
  by the user.
- 2026-10-06 — amended in dev-loop task-013 (Wave 3, plan dev-loop-rel-v0.1-plan): §2 a 401 on the session
  exchange, an API request or the event stream's probe shows a full-page notice to open the printed
  URL, no retry (W3-7); decided by the user.
- 2026-10-06 — amended in dev-loop task-013 (Wave 3, plan dev-loop-rel-v0.1-plan, independent review): §6 unreachable console → non-modal
  banner after 10 s, cleared on reconnect, network failures not shown as `internal`; §2 wording of
  the 401 notice (W3-12); decided by the user.
- 2026-10-07 — amended in dev-loop task-018 (Wave 3, plan dev-loop-rel-v0.1-plan): §3 addendum `states` in the
  element response (W3-14); decided by the user.
