---
id: task-003-session-token-and-request-guards
type: task
title: "Session token and request guards"
status: pending
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

## Implementation Notes

- `spec-004` §1–2; `adr-001` D8; `adr-002` (authentication port).
- The e2e-smoke `local-security` suite starts here and grows with every route.
- Scenarios that need a screen are proved here by API and unit tests against the same
  fixtures; their e2e run closes in the `web` task that depends on this one.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->
