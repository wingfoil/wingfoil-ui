---
id: task-003-session-token-and-request-guards
type: task
title: "Session token and request guards"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-SEC-02"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-002-launcher-and-http-server-skeleton"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The per-start session token printed in the URL fragment, `POST /api/session` and the `wfui_session_<port>` cookie, 401 for every API and event-stream request without a valid session, the Host/Origin checks (403, before any other work), and pino redaction of `authorization` and `cookie` (spec-004 §1–2).

**Backlog items:** TT-SEC-02, TT-SEC-03, US-X-02, US-X-04

- US-X-02 — As a member, I want the console to accept only my browser session, through a token given at launch, so that nobody else on my machine drives my projects through it
- US-X-04 — As a member, I want requests from another web page (foreign Origin or Host, DNS rebinding) or without the session token refused, writes included, so that a malicious site cannot run my CLI

## Acceptance Criteria

- **TT-SEC-02** (REQ-SEC-02 — Session token): [percentage] 100 % of API and event-stream requests without the current token or a session derived from it (or with a previous start's) get HTTP 401 and start 0 processes; the token and the session id appear in 0 log lines. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): X-02.1, X-02.2, X-04.1.
- **TT-SEC-03** (REQ-SEC-03 — Origin and Host checks): [percentage] 100 % of requests with a foreign Origin or Host get HTTP 403 and start 0 processes, whatever the method. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): X-04.1, X-04.2, X-04.3.
- **US-X-02** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/local-security.feature`: X-02.1 Serve the browser session opened with the token; X-02.2 Issue a new token at every start
- **US-X-04** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/local-security.feature`: X-04.1 Refuse requests without a valid session; X-04.2 Refuse a DNS-rebinding request; X-04.3 Accept a request with the token from the console's own origin

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-015-project-switcher: X-02.1 (browser side: fragment removed, switcher lists the fixture), X-02.1.

## Implementation Notes

- `spec-004` §1–2; `adr-001` D8; `adr-002` (authentication port).
- The e2e-smoke `local-security` suite starts here and grows with every route.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged:** task-002 Execution Notes read — the token is drawn by `drawToken()`
  before `buildApp` in `runLauncher` (injected here into the authentication adapter); Fastify's
  own server never listens (two plain `http` servers hand requests to `app.routing`), so the Host
  check gets the port from the launcher (the listeners' port), not from Fastify's server options;
  `buildApp({ register })` adds routes before `ready()`; `envelope()` and the spec-004 §5 error
  handler live in `http/app.ts`; `onStop` is not needed here (no child process yet); pino on
  stderr already redacts `authorization`/`cookie`. task-001 notes read (via task-002): unit tests
  in `test/server/`, the bin driven by `startLauncher` in `test/launcher/`, coverage gate 80 %,
  TypeDoc on every exported declaration of `server/src`.
- **Specs:** no gap. spec-004 §1 (Host/Origin on every request, 403 first), §2 (token, `POST
  /api/session`, cookie `wfui_session_<port>; HttpOnly; SameSite=Strict; Path=/`, static files
  exempt, cookie **or** Bearer on every other `/api/` request and the event stream, 401), §4 rows
  1–2 (`forbidden-origin`, `unauthenticated`), §5 envelope; `adr-002` authentication port;
  REQ-SEC-02/03. Two details the spec leaves open, decided here without changing any interface:
  `POST /api/session` answers **204** (no body, so no `contracts/api/` schema is needed) and needs
  the Bearer token itself (a cookie alone does not mint a new session); a request without a
  `Host` header, or with `Origin: null`, is foreign (403).
- **Design:** port `Authentication` (`server/src/auth/`: verify a token, open a session, verify a
  session id) with the in-memory adapter `createTokenAuthentication(token)` (per-start, constant-time
  comparison, sessions in a `Set`, nothing on disk); `http/guards.ts` registers one Fastify
  `onRequest` hook **before** the static plugin and every route: Host/Origin first (403), then,
  for any request whose path — raw or percent-decoded — or matched route is under `/api`
  (the event stream `GET /api/events`, task-010, included), cookie or Bearer (401); `http/session.ts`
  is the `POST /api/session` route. The guards answer before any handler runs, so a refused
  request starts no process (none exists yet; task-004's runner will sit behind the handlers).
  The `Set-Cookie` response header is added to the pino redaction.
- **Scope boundaries:** no project route exists yet (task-008/012): the "project API" of X-04.1 and
  the 200 of X-04.3 are proved on routes registered by the tests (unit, `buildApp({ register })`)
  and, on the bin, on `POST /api/session` and an unknown `/api/` path (guards passed → 204/404, not
  401/403). The browser side of X-02.1 (fragment read, `history.replaceState`, `POST /api/session`
  from the page, the switcher listing the fixture) is task-013 (bootstrap) and closes in task-015;
  here X-02.1 is proved by API tests (token → cookie with its name and flags → cookie accepted).
- **AC classification (T1)** — all **red-first** (no guard exists; today `/api/nothing` answers 404
  to anyone):
  - TT-SEC-02 / X-04.1 rows 1–2 — GET and POST under `/api/` without token, with a wrong token, with
    a wrong or other port's cookie → 401 `unauthenticated`, the handler never runs; static files
    and client-side routes served without a session.
  - X-02.1 (API side) — `POST /api/session` with the Bearer token → 204 and the cookie
    `wfui_session_<port>` with `HttpOnly`, `SameSite=Strict`, `Path=/`, no `Max-Age`; the cookie
    then opens the API; without/with a wrong token → 401.
  - X-02.2 — bin started twice: the first start's token (and session) → 401 on the second start.
  - TT-SEC-02 logging — token and session id in 0 log lines (unit with a captured pino stream, and
    the bin's stderr).
  - TT-SEC-03 / X-04.1 rows 3–4, X-04.2 — Origin `https://evil.test` (GET, POST, also PUT/DELETE
    and on static files) and Host `evil.test:<port>` → 403 `forbidden-origin`, even with the token,
    checked before the session (no token + foreign Origin → 403).
  - X-04.3 — token + Origin `http://127.0.0.1:<port>` + Host `127.0.0.1:<port>` → 200 (unit with a
    test route); the three accepted Host/Origin forms (`127.0.0.1`, `localhost`, `[::1]`).
