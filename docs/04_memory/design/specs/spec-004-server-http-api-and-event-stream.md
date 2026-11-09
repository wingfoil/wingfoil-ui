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
| `GET /api/p/:pid` | project header: name, WingFoil version and range state (`wingfoil.text`: the printed `--version` text through the sanitiser of tool messages, task-046), identity, role views, repository status | v0.1 |
| `PUT /api/p/:pid/role-view` `{role}` | remember the role view (local state) | v0.1 |
| `GET /api/p/:pid/config` | DNA, paths, workflows (as the CLI's version line answers `workflow list`, spec-001 §3: the 0.2.x or the 0.3.x shape; every string of a 0.3.x `diagnostics` entry and its `message` sanitised like the CLI warnings, at most 200 diagnostics with `diagnosticsOmitted` counting the rest — read by no view yet), resolved types (spec-001 §4.1); effective `ui.yaml` with origin of each value since v0.3 (REQ-ARC-07; the `ui` section of spec-012 §2) | v0.1 |
| `GET /api/p/:pid/elements[?archived=true]` | elements with their descriptor (spec-003) and local-changes marker; from v0.3 each element's `missingCategories` and the list's `missingReferences` (M2, spec-012 §5) | v0.1 |
| `GET /api/p/:pid/elements/:eid` | one element: frontmatter, body, descriptor, references; `:eid` a full id, or a short id resolved as spec-011 §3 (v0.3) | v0.1 |
| `GET /api/p/:pid/elements/:eid/history` | `memory history` entries (spec-002 §2); their texts sanitised from v0.3 (§5); `:eid` the full id only (spec-011 §3) | v0.1 |
| `GET /api/p/:pid/directives`, `/directives/:did` | directive list: one entry per directive id, the one in force — when two files declare an id (a custom directive overriding a built-in one), the file the CLI's warning names (`using <path>`, to the end of the line), else — the warning cut — WingFoil's precedence (`compareDirectivePrecedence`): the smallest path (code units) among the files under `directives/custom/`, else among all, not the first listed (the CLI sorts names per folder); the other file is not listed, its warning is (task-047, bug-025); the CLI's order otherwise; one directive (the one in force) with its body | v0.1 |
| `GET /api/p/:pid/docs` | documentation index (R4) | v0.1 |
| `GET /api/p/:pid/files/tree`, `/files/content?path=` | working tree, confined to the repository (REQ-SEC-06) | v0.1 (docs), v0.4 (Files, R8 — moved from v0.3, RP3-7) |
| `GET /api/p/:pid/today?view=<role>` | Requires you, Waiting on others, all-roles summary | v0.2 |
| `POST /api/p/:pid/elements/:eid/submit` `{expectedStatus}` | `memory submit`; `:eid` the full id only (spec-011 §3) | v0.2 |
| `POST /api/p/:pid/elements/:eid/approve` `{expectedStatus, reason}` | `memory approve --reason`; `:eid` the full id only (spec-011 §3) | v0.2 |
| `POST /api/p/:pid/elements/:eid/reject` `{expectedStatus, reason}` | `memory reject --reason`; `:eid` the full id only (spec-011 §3) | v0.2 |
| `POST /api/p/:pid/git/fetch`, `/git/update`, `/git/push` | write class c (Y2–Y4) | v0.2 |
| `GET /api/settings`, `PUT /api/settings` | UI settings (C4, local state) | v0.2 |
| `GET /api/p/:pid/progress` | progress card figures (spec-005 §4): body spec-012 §3 | v0.3 |
| `GET /api/p/:pid/traceability?scope=` | traceability (R5): `scope` ∈ `current` (default), `project`; body spec-012 §4 | v0.3 |
| `GET /api/p/:pid/events/memory?before=&limit=` | Memory events (spec-002 §3) | v0.2 (Updates), v0.3 (Recent activity, `limit=5`, spec-012 §6), v0.4 (Timeline, R6 — moved from v0.3, RP3-7) |
| `GET /api/p/:pid/git/log?branch=&author=&q=&before=` | git tree (R7) | v0.4 (moved from v0.3, RP3-7) |
| `POST /api/p/:pid/ingestions/:workflow` `{title, fields}` | ingestion start: `memory add` + `memory submit` (G5) | v0.4 (moved from v0.3, RP3-7) |
| `POST /api/p/:pid/ui-config/preset` `{preset}` | apply a UI preset (write class b): `preset` ∈ `kanban`, `scrum`, `sw-life-cycle` (any other value fails the body schema, 400 `invalid-request`); 200 `write.response.schema.json` (§5) with `result` `{ file: ".wingfoil/ui.yaml", preset }`; preconditions, writing and failures as spec-005 §5 | v0.3 |
| `GET /api/p/:pid/workflow/status`, `/workflow/next`; `POST /api/p/:pid/workflow/start`; `POST /api/p/:pid/agents` | WingFoil 0.3 verbs; shapes fixed by v0.4 `release-planning` | v0.4 |

Write routes run through the repository's write lock (its git common directory, `adr-001` D5). `expectedStatus` is the
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
| `GET /api/p/:pid/elements/:eid` | `element.schema.json`, with `element.shortId` (spec-011 §1, v0.3); 404 `not-found` and 409 `ambiguous-id` `element.refusal.schema.json` (spec-011 §3) |
| `GET /api/p/:pid/elements/:eid/history` | `history.schema.json` — the `memory history` entries on their contract fields only (a CLI's added fields, e.g. 0.3.x's `wingfoil`, are not passed on; task-048) |
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
draws its chips from one request. `states` is absent when `descriptor` is absent (memory
configuration unreadable) and for a type `memory.yaml` does not declare (descriptor kind
`undeclared`).

**v0.2 bodies (addendum, release-planning v0.2, RP-11).** The v0.2 routes' bodies, in
`contracts/api/` (created by the v0.2 tasks):

| Route | Schema |
|-------|--------|
| `GET /api/p/:pid` — `repository` part | `repository.schema.json` (spec-010 §3), referenced by `project.schema.json` |
| `GET /api/p/:pid` — top-level `conditions: string[]` (spec-001 §6, spec-010 §7) | `project.schema.json` |
| `GET /api/p/:pid/today?view=` | `today.schema.json` (spec-003 §5) |
| `POST …/elements/:eid/submit` | request `element.submit.request.schema.json` `{expectedStatus}`; 200 `write.response.schema.json` (§5) |
| `POST …/elements/:eid/approve`, `/reject` | request `element.decision.request.schema.json` `{expectedStatus, reason}` — `reason` holds at least one non-whitespace character (G-07.2), no NUL character and at most 10 000 characters; `expectedStatus` 1–200 characters (both requests); 200 `write.response.schema.json` |
| `POST …/git/fetch`, `/git/update`, `/git/push` | no body; 200 `git.response.schema.json` `{repository}` (spec-010 §4) |
| `GET /api/settings`, `PUT /api/settings` | `settings.schema.json` (spec-006 §2): `PUT` takes the whole object (every key; an invalid or out-of-range value → 400 `invalid-request`) and answers 200 with the stored settings |
| `GET /api/p/:pid/events/memory?before=&limit=` | `memory-events.schema.json`: `{ events: [<spec-002 §1 event>], more: boolean }`, newest first; `limit` default 10 (Updates, spec-003 §5) |

`?view=` must be a role view the member can choose (`roleViews`), else 400 `invalid-request`;
absent → the remembered role view (`roleView`, or the default).

`GET /api/p/:pid/events/memory`: `limit` is an integer from 1 to 100 (default 10); `before` is
the `sha` of an event the client holds (the oldest of its last page) and gives the events after
it in the newest-first order, exclusive; a `limit` out of range or not an integer, or a `before`
that is not the sha of an event of the current log (e.g. history rewritten), → 400
`invalid-request` (the client starts again from the top). An unknown `:pid` answers 404 before
any 400. A `memory.yaml` that cannot be read → 502 `read-error`; a failed or refused Memory event
read → 500 `internal` (details in the log only).

**v0.3 bodies (addendum, release-planning v0.3 step 5c, spec-012).** In `contracts/api/`:

| Route | Schema |
|-------|--------|
| `GET /api/p/:pid/progress` | `progress.schema.json` (spec-012 §3); no query parameter (any → 400 `invalid-request`) |
| `GET /api/p/:pid/traceability?scope=` | `traceability.schema.json` (spec-012 §4); another `scope` value or parameter → 400 `invalid-request`, after the 404 of an unknown `:pid` |
| `GET /api/p/:pid/elements` | `elements.schema.json` gains `missingCategories` per element and `missingReferences {shown, unreadable, capped}` (spec-012 §5) |
| `GET /api/p/:pid/config` | `config.schema.json` gains `ui` (`ui-config.schema.json`, spec-012 §2: the effective values with their origin and the `ui.yaml` status and warning) |

Their errors are spec-012 §10's; `X-Repo-State` and the event stream are unchanged (spec-012 §8).

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
| 7 | element file has local changes (REQ-STATE-03) | 409 | `local-changes` | **fresh** `git status --porcelain`, plus the whole entry of the file being the same at HEAD, in the index (one stage-0 entry) and in the working tree (a regular file, the executable bit of its mode, the blob `git hash-object` gives — nothing written), under the write lock |
| 8 | copy behind, diverged or detached HEAD (REQ-STATE-04) | 409 | `stale-copy` | **fresh** copy state (spec-010 §1: the `status --porcelain=v2 --branch` read), under the write lock |
| 9 | `expectedStatus` differs | 409 | `element-changed` | **fresh** read of the element file, under the write lock |

Rows 1–6 start **no process** once the console has read the project in its current repository
state (the page has: rows 5–6 read the cache of its reads; a request on a state no read has seen
runs the reads a `GET` would, never a write verb). An unknown `:eid` — looked up in that state's
`memory search`, never a path built from it — is 404 `not-found`, after row 6. Under the lock, when
the fresh state differs from the one the lookup used, the element is listed again on the fresh
state; an id listed at more than one path is refused (409 `local-changes` when one of them has
local changes, else 409 `element-changed`). The write lock is
one per repository (its git common directory), so two listed projects of one repository queue
together. Rows 7–9 run read-only git commands and a file read, never a
cached answer: `memory submit` commits the target's uncommitted edits (checked on WingFoil 0.2.2),
so a stale "no local changes" would let a UI action commit someone's work. The status alone is not
enough: an edit hidden from it (`assume-unchanged`, `core.ignoreStat`, an fsmonitor) is still
committed by `git add` + `git commit --only`, hence the entry comparison. No `wingfoil` write verb
starts before row 9 passes (a state that moved since the lookup is read again first: the reads a
`GET` would run).

The role required by a gate is **not** checked by the server: the CLI refuses it (REQ-SEC-07).

**Route parameters (v0.3, spec-011 §4, bug-019).** Every route parameter (`:pid`, `:eid`, `:did`)
takes up to 255 UTF-16 code units of its percent-decoded value (the router's `maxParamLength`). A
longer one answers 404 `not-found` on every method, after rows 1–2 (Host/Origin, `Sec-Fetch-Site`
and session keep their order) and before any other row: no process starts. Every other error the
framework raises before routing stays 400 `invalid-request`.

Which rows apply to which writes: the governed writes on an element (`submit`, `approve`,
`reject`) run rows 1–9 as listed; row 5a applies to the role-view `PUT` only. The role-view
`PUT` is a **local-state write** (spec-006): rows 1–5 and 5a apply, rows 6–9 do **not** — in
particular row 6 (`unsupported-version`) does not, so a role view can be chosen on a read-only
project. "Not identified" in row 5 covers the identity kinds `not-in-team`, `no-identity` and
`ambiguous`; nothing is stored on a refusal.

The preset write (`POST /api/p/:pid/ui-config/preset`, v0.3) runs rows 1–6 and 8; row 7 is
replaced by "`.wingfoil/ui.yaml` exists nowhere" (409 `ui-config-exists`) and row 9 does not apply
(no element) — spec-005 §5, which also fixes its order under the write lock.

**v0.2 (RP-11, RP-14).** The git routes run rows 1–4 (fetch) or 1–5 (update, push), never 6–9,
then the refusals of spec-010 §5 (spec-010 §8): fetch is allowed to an unidentified user. Their
body is none or `{}` (row 4: anything else → 400); row 5 reads the snapshot view, as for the
governed writes, and again under the lock when the fresh state moved.
`PUT /api/settings` is a local-state write with no project: rows 1, 2 and 4 apply. Row 5's 403
with 0 processes is thus required for governed writes, update and push — the scope of
REQ-SEC-08's fit criterion (SARD `05` v0.6), which excludes fetch and the per-user settings.

### 5. Responses

The CLI's warnings a read answer carries — its `stderr` lines (spec-001 §2) in a `/config`
section's `warnings` and in the `warnings` of `/elements`, and the `warnings` field of `directives
list` (spec-001 §3) in the `warnings` of `/directives` — are sanitised like every tool message, at
most 200, then one line `<n> more warnings omitted` (task-046, review round 2 d1). From v0.3 the
`warnings` of `/elements` also name each `memory search` match dropped by the per-match validation,
by its project-relative path (spec-001 §2, RP3-14 D10, bug-024): the list is served with the valid
matches, never as 502 `cli-output` for a bad match; Today and the other reads of the same output use
the valid matches. With `?archived=true` the `warnings` also carry those of the archived searches
(a dropped archived match among them), each text once.

Commit texts (v0.3, RP3-14 D13, bug-027): the `subject`, `reason`, `author` and `approver` of the
history entries (`/elements/:eid/history`), the `author`, `approver` and `reason` of the Memory events
(`/events/memory`) and the descriptor's `rejection` (`by`, `reason`; spec-003 §8) are passed through
the sanitiser of tool messages where the route serialises them — after the descriptor has matched
the authors' emails against the team (spec-002 §1), which reads them as committed.

Repository texts (v0.3, release-planning v0.3 step 5c K1, spec-012 §9; implemented with bug-027's
task, the same class): every display string a read body takes from the repository passes through
the sanitiser's character escape (`neutralise`, without the folder redaction) where the route
serialises it — element **titles** (`/elements`, `/elements/:eid`, the Today rows, the candidates
of spec-011 §3, spec-012's `ElementRef` and rows), the **pattern reference** values of
`/progress` and `/traceability`, and the **`ui.yaml` strings** `/config` echoes in `ui`
(`patterns[].match` — a regular-expression source, its backslashes kept as written —, type
names, `phases`, `holds` types and states, `artifacts` paths). Element
ids, types and states stay as `memory search` returns them: they are the keys a page sends back.
So does every other key whatever its source — an event's `type`, `id`, `from` and `to`, read from
the commit subject and patch (spec-002 §3), the roles, the paths a page sends back. Document
content — a frontmatter value, an element or directive body, a working-tree file — is served as
written: the page renders it as a document, and the escape would change it (a doubled backslash in
Markdown); the one frontmatter field outside it is `rejection_reason`, which `memory reject` writes
from its reason (spec-001 §3): commit text, sanitised as the descriptor's `rejection.reason`. The rules live in one module, `server/src/http/serialise.ts` (task-056): `repositoryText`
(the escape) and the commit-text sanitiser, used by every route that serialises such a field. The
repository display text outside the fields named here (the DNA's names and descriptions, the
directives' names and titles — the directive page's heading included —, the workflow texts, a file
tree's names, the documentation index's paths, the states of a history entry, the project list's
name and `remote`) is not escaped yet: bug-035.

- Success of a write (`write.response.schema.json`): `{ result: <CLI output>, commits: [{ sha,
  subject }], push: { status, code?, message? } }` — `status` is `pushed`, `off` or `failed`
  (spec-010 §6); on `failed`, `message` is git's verbatim error when git refused the push, and
  `code` is a spec-010 §5 code (refused before git ran), `push-timeout` (auto-push killed
  after 60 s) or `internal` (an unexpected error around the push), rendered from the catalogue. A failed push is still a **success** of the write:
  the commit is made and stays local (Y-08.1, G-13). Was `pushed: boolean` until 2026-10-12. An
  ingestion lists its `add` and `submit` commits. `commits` are the first-parent commits made
  since the write's fresh HEAD whose subject is the CLI's for that write (`wf(<type>): <verb>
  <id>`, plus ` [<from> → <to>]` from the CLI's answer for approve and reject, W-15) that changes
  the element's path only and holds the file just written — exactly one, else 502 `cli-output`,
  nothing logged, no `write` event. A commit made meanwhile by another program is neither listed
  nor logged. When the CLI fails after its commit (any CLI error: exit ≠ 0, timeout, unreadable
  output), that commit is still logged and announced, not auto-pushed, and the write answers 500
  `write-incomplete` with `detail.commit`; when the CLI answers for another path than the one
  checked, 500 `write-incomplete` with that path.
- A `reason` that is empty or whitespace only fails the body schema: **400** `invalid-request`,
  no process (G-07.2).
- Partial failure of an ingestion (`add` succeeded, `submit` refused): **422** `cli-refused` with
  `detail: { created: { id, path }, commits: [{ sha, subject }] }` — the toast names the draft
  created (REQ-INT-04).
- Error envelope, every status: `{ error: { code, message, detail? } }`:

| Status | `code` | When |
|--------|--------|------|
| 422 | `cli-refused` | CLI exit 1: `message` = the CLI's message verbatim (REQ-INT-04) except for the local folders it quotes — the project's → `<project>`, the repository's → `<repository>`, the CLI's package folder → `<wingfoil>`, the home folder → `~` — and URL userinfo (bug-012); from v0.3, the `detail` texts of a WingFoil 0.3.x refusal's `details` (spec-001 §2) in `detail.reasons[]`, redacted and sanitised the same way, at most 200 then one line `<n> more reasons omitted`, the details' `file` not passed on, `detail` present only when there is a reason (`cli.refusal.schema.json`); also the exit 2 of `approve`/`reject` whose message names `--reason` (a reason WingFoil will not record, W-29) |
| 502 | `cli-output` | exit 0 with output failing its schema (spec-001 §2) |
| 504 | `cli-timeout` | a `wingfoil` process killed after 30 s (git transport the user started has no fixed timeout; an automatic fetch and an auto-push are killed after 60 s — spec-010 §4, `adr-001` D5) |
| 500 | `internal` | adapter defect (exit 2) or unexpected error; details only in the log — a failed git read of the repository (e.g. a configuration value git refuses) on any route, read or write, is logged as `{ kind: 'git-read', ended, exitCode }`, never with git's message (task-046 review rounds 3 m1, 4 minor-1: the read routes and the global error handler) |
| 500 | `write-incomplete` | a governed write that did not finish: its CLI failed leaving the element file changed (modified or staged) without the write's commit, failed after its commit (`detail.commit`: the commit is logged and announced, not pushed), or answered for another path than the one checked (`detail.file` that path, `detail.commit` when its commit is found). `detail.file` relative to the project; a fixed `message`, never the CLI's text (it quotes local absolute paths and the reason), which is not logged either; nothing is restored |
| 422 | `git-refused` | a git transport command failed: git's message verbatim (REQ-INT-06), local folders and URL userinfo redacted as for `cli-refused` and a local remote's path as `<remote>`, at most 4 000 characters |
| 409 | `no-remote`, `no-fetch-target`, `detached-head`, `no-upstream`, `diverged`, `local-changes-in-the-way`, `remote-not-owned`, `remote-unreadable`, `refspec-outside-remotes` | refusals of the git routes before any transport process (spec-010 §5); the update and push codes and `push-timeout` also appear as `push.code` of a write |
| 409 | `ambiguous-id` | the element read (v0.3, spec-011 §3): `:eid` is the short id of several elements of one step — `detail: { candidates: [{ id, shortId, title, type, status }], more }`, at most 20 candidates ordered by full id, `more` counting the rest, titles escaped as repository texts (*Repository texts* above) |
| 409 | `ui-config-exists` | the preset write (v0.3): `.wingfoil/ui.yaml` exists in the working tree, the index or at HEAD, or appeared before the exclusive create (spec-005 §5) |
| 422 | `ui-config-invalid` | the preset write (v0.3): the rendered preset fails the `ui.yaml` schema or a semantic check against the project; `detail.failure` = the first failure (spec-005 §1, §5); nothing written |
| 502 | `read-error` | a direct read of spec-001 §4 failed: `message` "Cannot read `<file>`" and the reason, `detail: { file, kind }` with `kind` one of `outside`, `missing`, `shape`, `mismatch` and `file` relative to the project (never absolute). Scoped to the element or directive read: a list never fails as a whole; an unreadable `memory.yaml` degrades only the type-dependent features. Logged as `{ kind, file }` only (`outside` at warn level) |
| 422 | project-list codes | refusals of `POST /api/projects` and `/projects/clone`: spec-006 §3 (`folder-not-found`, `not-wingfoil`, `already-listed`, `directory-not-empty`, `cli-not-found`, `state-dir-inside-project`, `directory-inside-project`, `inside-state-dir`, `git-refused` — also for a folder with `.wingfoil/` that is not a git repository —, `remote-not-owned`, `remote-unreadable`) |
| 404 | `not-found` | also a refused working-tree path of `/files/tree` and `/files/content` (REQ-SEC-06): `detail.kind` one of `outside` (the "outside the repository" marker), `missing`, `not-allowed`, `too-large`; 0 bytes of the target |

- Read responses carry `X-Repo-State: <HEAD sha>.<status hash>`; the page compares it with the
  event stream to know whether its data is current. The status hash is the hash of
  `git status --porcelain` combined with a fingerprint of the working-tree content of each
  changed and untracked entry, computed by the server without an extra git command
  (REQ-STATE-02), so a second edit of an already-modified file changes the state; from v0.3 it
  also combines the mark of `.wingfoil/ui.yaml` whatever its git status (spec-001 §4.4), so an
  edit of an ignored `ui.yaml` changes the state too; the header format is unchanged.

### 6. Event stream (REQ-INT-09)

`GET /api/events` — Server-Sent Events, one stream per page, authenticated by the session cookie
(EventSource sends it); comment heartbeat every 25 s. Events (`data` is JSON):

| `event` | `data` | When |
|---------|--------|------|
| `repo` | `{pid, state}` | HEAD, working-tree status, branch, upstream, ahead/behind, the remote list or the effective author email of a project changed (REQ-STATE-02, REQ-STATE-05: `GIT_AUTHOR_EMAIL`, else `author.email`, else `user.email`; spec-010 §2); also, with the same `state`, only when `sync.fetch.lastError` or `sync.update.lastError` is set, changed or cleared (spec-010 §2–§3) — never for a new `lastSuccessAt` alone |
| `projects` | `{}` | the project list or a project's availability changed |
| `settings` | `{}` | UI settings changed (another tab) |
| `write` | `{pid, eid?, commit}` | a write finished (other tabs show the result); without `eid` for the preset write (v0.3, spec-005 §5) |
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
  element response (W3-14); decided by the user. Same day, erratum after the independent review:
  `states` is also absent for an undeclared type, whose descriptor is present.
- 2026-10-07 — amended in dev-loop tasks 017 and 020 (Wave 3, plan dev-loop-rel-v0.1-plan): no route change; the Memory
  list reads `GET /elements?archived=true` only once a type is selected, keeping a cold landing
  within TT-PERF-05 (W3-24); the documentation view asks `GET /files/content` once per distinct
  repository link target outside the index to mark it (W3-30); decided by the user.
- 2026-10-12 — amended in `release-planning` v0.2 (plan session 2, RP-11, RP-14): §3 v0.2 bodies
  addendum (schema names, `?view=` rule, `PUT /api/settings` whole object, Updates `limit` 10);
  §4 row 8 evaluated from the copy state of spec-010 §1, and which rows apply to the git routes
  (fetch allowed to unidentified users) and to `PUT /api/settings`; §5 `pushed: boolean` replaced
  by `push: {status, message?}` (a failed push is a successful write), a blank reason → 400
  `invalid-request`, the spec-010 §5 refusal codes; §6 the `repo` event also on copy-state and
  sync-status changes. Decided by the approver at checkpoint 2.
- 2026-10-12 — open points of the same session decided by the approver (RP-22, RP-28,
  release-planning-rel-v0.2-plan session 2): a push refused before git runs (e.g. `no-upstream`)
  gives `push.status: failed` with the catalogue text; `PUT /api/settings` takes the whole object,
  validated by `settings.schema.json` (spec-006 §2).
- 2026-10-12 — independent spec review round 1 (release-planning v0.2 session 2): `push.code`
  (spec-010 §5 codes, `push-timeout` — RP-33, decided by the approver) and
  `write.response.schema.json` named for the success body; §4 the 403 rule cites REQ-SEC-08's
  scoped fit criterion (RP-34, decided by the approver); §3 `conditions` placed at the top level
  of `project.schema.json`, apart from `repository` (drafting detail).
- 2026-10-12 — independent spec review round 2 (release-planning v0.2 session 2, drafting
  details): §6 the `repo` event with an unchanged `state` only when a sync error is set, changed
  or cleared, never for `lastSuccessAt` alone (as spec-010 §2); §5 the fetch-only refusal
  `no-fetch-target` (spec-010 §5).
- 2026-10-13 — amended in dev-loop task-031 (minor-v0.2 Wave 1, plan dev-loop-rel-v0.2-plan,
  D31-1, D31-2): §3 `events/memory` — `limit` 1 to 100 (default 10), `before` = an event's sha,
  exclusive, an unknown sha or an out-of-range `limit` → 400 `invalid-request`, 404 for an
  unknown project first, `read-error` / `internal` for a failed input. Decided by the approver.
- 2026-10-14 — amended in dev-loop task-032 (minor-v0.2 Wave 2, plan dev-loop-rel-v0.2-plan,
  D32-1 … D32-6, D32-10): §3 bounds of `reason` and `expectedStatus`; §4 row 7 also compares the
  blob ids of the element file at HEAD, in the index and in the working tree (an edit hidden from
  `git status` is still committed, W-28), rows 1–6 start no process on a state the console has read,
  an unknown `:eid` → 404 after row 6, one write lock per repository; §5 which commits a write
  reports and logs, and a reason WingFoil refuses as a usage error → 422 `cli-refused`. Decided by
  the approver. Same day, independent review F2: §3 "per-project write lock" reads "the
  repository's write lock (its git common directory)"; adversarial review S1–S4: §4 row 7 compares
  the whole entry (mode included, a symlink refused), the element is listed again on a state that
  moved and a duplicated id is refused; §5 the write's commit identified by its exact subject, its
  only path and its content, and logged when the CLI fails after it. Same day, decision W2-1 of
  the approver: §5 `500 write-incomplete` with `detail.file` when the CLI fails and leaves the
  element file changed without a commit (W-30); the bodies of every write refusal in
  `contracts/api/write.refusal.schema.json`. Independent review round 2: §4 "no `wingfoil` write
  verb before row 9" (a moved state is read again first); §5 a commit of a CLI that then failed is
  not auto-pushed. Decisions W2-4 and W2-5 of the approver: §5 `write-incomplete` also when the CLI
  answers for another path (`detail.file` that path) and when it fails after its commit
  (`detail.commit`), with a fixed message.
- 2026-10-15 — amended in dev-loop task-033 (minor-v0.2 Wave 3, plan dev-loop-rel-v0.2-plan;
  D33-1, D33-5, D33-9, D33-12, coordinator C2; bug-010, bug-012): §4 the git routes take no body
  (or `{}`), row 5 also under the lock on a moved state; §5 `cli-refused` and `git-refused` keep the
  tool's wording without the machine's folders or URL userinfo, `cli-not-found` sends `{ command }`
  only, `remote-not-owned` among the git refusals; row 8 `stale-copy` in
  `write.refusal.schema.json`. Decided by the approver.
- 2026-10-15 — review round 1 of task-033 (R1, decided by the approver): §5 `git-refused` shows a
  local remote's path as `<remote>`.
- 2026-10-15 — review round 2 of task-033: §5 `remote-unreadable` among the git refusals and the
  project-list codes. Decided by the approver.
- 2026-10-15 — amended in dev-loop task-034 (minor-v0.2 Wave 4, D34-8, bug-014): §5 the 409 code
  `refspec-outside-remotes` of the fetch route (spec-010 §5). Decided by the approver.
- 2026-10-15 — task-034 security review round 1 (W4-4): §5 `push.code` may be `internal`.
- 2026-10-28 — amended in dev-loop task-046 (`governance-alignment-rel-v0.3-plan` step 2b, GA3-9):
  §3 `GET /api/p/:pid/config` passes the `workflows` section in the shape of the project's WingFoil
  version line (0.2.x or 0.3.x, spec-001 §3, §5), the 0.3.x `diagnostics` and `message` through the
  sanitiser of tool messages; `GET /api/p/:pid` capability reasons gain `not-in-release` (spec-001
  §6, D46-2). Decided by the approver.
- 2026-10-29 — amended in dev-loop task-046 review rounds 1–2 (m1, n1, c6; decided by the
  approver): §3 `/config` passes at most 200 workflow diagnostics (`diagnosticsOmitted`); the CLI's
  warnings of a read answer (`/config` sections, `/elements`, `/directives` — d1) are sanitised and
  hold at most 200 lines, then one counting the rest (§5); `GET /api/p/:pid` `wingfoil.text` is the printed
  `--version` text through the sanitiser of tool messages (§3 row).
- 2026-10-29 — amended in dev-loop task-046 review round 3 (m1, n2; decided by the approver): §5 a
  failed git read is the plain 500 `internal`, logged by kind and exit only; the `message` of `memory
  search` (`/elements`) is sanitised like the other tool texts.
- 2026-10-29 — amended in dev-loop task-046 review round 4 (minor-1; decided by the approver): §5 the
  logging rule of a failed git read holds on every route (the global error handler), the write
  routes included.
- 2026-11-01 — amended in dev-loop task-047 (bug-025; D47-1, D47-2; decided by the approver): §3
  `/directives` answers one entry per directive id, the one in force (the rule of `/directives/:did`),
  in the CLI's order; a file shadowed by another of the same id is not listed.
- 2026-11-01 — amended in dev-loop task-047 review rounds 1–2 (nit-1, N1; decided by the
  approver): §3 `/directives` without a warning naming the file in force follows WingFoil's
  precedence (`compareDirectivePrecedence`: a `custom/` file first, then the smallest path by code
  units), neither the last nor the first file listed — `directives list` sorts names per folder, so
  its order is not the paths' order.
- 2026-11-02 — amended in dev-loop task-048 (bug-026, D48-8 approved by the approver): §3 the history
  route passes on the contract's fields of each entry only; the Memory events carry WingFoil 0.3.x's
  operations but `assign` (spec-002 §1).
- 2026-11-03 — amended in `release-planning` v0.3 (step 5, RP3-14), decided by the approver: §3
  the rows of Files (R8), the Timeline (R6), the git tree (R7) and the ingestion (G5) moved to v0.4
  (RP3-7); §5 the dropped `memory search` matches in the `warnings` of `/elements` (D10, bug-024);
  the commit texts of the history, the Memory events and the descriptor's `rejection` sanitised
  where the routes serialise them, after the email matching (D13, bug-027); `cli-refused` carries
  the 0.3.x refusal's `details[].detail` in `detail.reasons[]` (the RP3-7 scope item).
  Aligned the same day with spec-005 §5 (C1): §3 the preset route's `preset` values and response;
  §4 the rows the preset write runs; §5 the codes `ui-config-exists` (409) and `ui-config-invalid`
  (422, `detail.failure`); §6 the `write` event without `eid` for the preset write.
- 2026-11-03 — amended in `release-planning` v0.3 (step 5c, spec-012; decided by the approver,
  "TQ-1…TQ-6, X1 e K1–K3 come consigliato"): §3 the route `GET /api/p/:pid/traceability?scope=`
  (v0.3), the bodies of `/progress` and `/traceability`, the M2 fields of `/elements` and the `ui`
  section of `/config` (v0.3 bodies addendum); §5 repository texts escaped (K1, with bug-027's
  task).
- 2026-11-05 — amended in place with task-057 (spec-011 §5's rows; the approver's Q1-a, Q2-a):
  §3 the element read takes a full id or a short id (spec-011 §3), history and the three writes the
  full id only, `element.shortId` and the refusal schema `element.refusal.schema.json`; §4 a route
  parameter over 255 UTF-16 code units of its decoded value → 404 `not-found` on every method,
  after rows 1–2 (bug-019, C1); §5 the 409 `ambiguous-id` row.
- 2026-11-06 — amended in development (task-068 design, plan backlog-item-rel-v0.3-plan; decided by
  the approver, Q1 (a)): §5 the status hash of `X-Repo-State` also combines the mark of
  `.wingfoil/ui.yaml` whatever its git status (spec-001 §4.4); header format unchanged.
- 2026-11-06 — amended in development (task-068 green, plan backlog-item-rel-v0.3-plan; decided by
  the approver, Q4 (b)): §5 a `ui.yaml` pattern echoed by `/config` keeps its backslashes, its
  unsafe characters escaped as the other repository texts (spec-012 §9).
- 2026-11-07 — amended in development (task-056 design, plan backlog-item-rel-v0.3-plan; decided by
  the approver, Q1-a, Q2-a): §5 *Repository texts* — keys stay raw whatever their source (an
  event's `type`, `id`, `from`, `to`), document content is served as written but the frontmatter's
  `rejection_reason` (commit text, review round 1), the rules' module `server/src/http/serialise.ts`,
  the display text outside the named fields left to bug-035 (with the documentation paths, the
  history's states and the directive page's heading, review round 1). The
  per-match `memory search` and the refusals' `detail.reasons[]` of this section are built by
  task-070 (the split).
- 2026-11-06 — amended in task-055 (bug-029; design Q4-a, decided by the approver): §6 the `repo`
  row names the effective author email the identity is read from (`GIT_AUTHOR_EMAIL`, else
  `author.email`, else `user.email`, SARD REQ-STATE-05), in place of `user.email` alone.
- 2026-11-09 — amended in development (task-070 design D70-4, D70-5, D70-6, D70-12, plan
  backlog-item-rel-v0.3-plan W2-5; decided by the approver, "tutto come consigliato"): §5 the
  `warnings` of `/elements?archived=true` carry the archived searches' warnings too, each text once;
  the `cli-refused` reasons' cap (200 and a count line), the details' `file` left out, `detail`
  only with a reason, and the envelope's schema `contracts/api/cli.refusal.schema.json` (the
  `cli-refused` branch of `write.refusal.schema.json` refers to it).
