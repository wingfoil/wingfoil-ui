---
id: task-002-launcher-and-http-server-skeleton
type: task
title: "Launcher and HTTP server skeleton"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-ARC-01"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: ["task-001-workspace-tooling-and-e2e-harness"]         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

The `wingfoil-ui` command and the HTTP server skeleton: `bin` stub with the Node.js check, options, start sequence, loopback listeners on `127.0.0.1` and `::1`, browser opening without a shell, stop sequence and exit codes (spec-007); Fastify serving the static `web/` build and the `/api/` prefix (spec-004 §1).

**Backlog items:** TT-ARC-01, TT-PERF-06, TT-SEC-01, US-X-03

- US-X-03 — As a member, I want requests from other machines refused (loopback only), so that nobody on my network reads or acts on my projects

## Acceptance Criteria

- **TT-ARC-01** (REQ-ARC-01 — Local server on Node.js, run with npx): [boolean] On a machine with only Node.js 22.12 and git installed, `npx wingfoil-ui` serves the UI on 127.0.0.1; with Node.js 20.x it exits with a non-zero status and opens no port. *Verified by:* e2e-smoke `launch`.
  Scenarios (`@v0.1`): S-01.1, S-01.2, S-01.3.
- **TT-PERF-06** (REQ-PERF-06 — Server start): [numeric] ≤ 3.0 s in 10 out of 10 runs. *Verified by:* e2e-smoke `launch`.
  Scenarios (`@v0.1`): S-01.1.
- **TT-SEC-01** (REQ-SEC-01 — Loopback only): [boolean] Every listening socket of the server process is bound to a loopback address; a connection to the machine's network address is refused. *Verified by:* e2e-smoke `local-security`.
  Scenarios (`@v0.1`): X-03.1, X-03.2.
- **US-X-03** — every `@v0.1` scenario passes:
  - `docs/02_requirements/02_bdd/features/x/local-security.feature`: X-03.1 Listen on the loopback interface only; X-03.2 Refuse a connection on the machine's network address

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-013-web-shell-themes-and-message-catalogue: S-01.1, S-01.2, S-01.3.

## Implementation Notes

- `spec-007-launcher-command-line` (whole), `spec-004` §1; `adr-001` D8; `adr-002` (Fastify, pino).
- REQ-PERF-06: no project read before the URL is printed.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on acknowledged:** task-001 Execution Notes read — tests under `test/` (unit in
  `test/server/`, launcher end-to-end in `test/launcher/`), `harnessEnv`/`fixture.env` isolate
  home and git (with `npm_config_cache` caveat), REQ-SEC-05 lint rule on `server/**` (the opener
  uses `spawn` with an argument array and `shell: false`), TypeDoc complete for `server/src`.
- **Specs:** no gap for the behaviour (spec-007 whole, spec-004 §1, spec-008 §5). One layout
  decision spec-007 leaves open, recorded here rather than in a new spec (it does not change any
  interface): the **root package `wingfoil-ui`** (the name REQ-ARC-01 fixes, already the root
  `package.json` name) declares `bin: { "wingfoil-ui": "bin/wingfoil-ui.cjs" }`. The stub is
  CommonJS, ES2019 syntax (Node.js 14 parses it), checks the version, reads `launcher.nodeTooOld`
  from `server/src/i18n/en.json` as plain JSON, then `import()`s `server/dist/main.js`. The
  server's runtime dependencies stay in `server/package.json` (hoisted by npm workspaces);
  turning the workspaces into one publishable tarball (bundle or root `dependencies`, `files`) is
  left to `release-publishing` — **hand-over**, the package stays `private` until then.
- **Scope boundaries:** the token is drawn and printed here (spec-007 §3.4); `POST /api/session`,
  401/403 and the Host/Origin checks are task-003; reading `state.json` and exit 4 (spec-007 §3.2)
  are task-007; CLI child processes (stopped at shutdown, spec-007 §6) arrive with task-004 — the
  stop sequence exposes a hook for them. Static files: `web/dist` (task-013 builds it); every
  non-`/api/` GET falls back to `index.html`, unknown `/api/` paths answer 404 JSON.
- **AC classification (T1)** — all **red-first** (no launcher exists):
  - S-01.1 / TT-ARC-01 — the bin prints `WingFoil UI is running at http://127.0.0.1:<port>/#token=<43 chars>` and
    serves `/`; the opener receives the URL as one argument (unit, injected spawner); the page
    content ("Add project…") closes in task-013.
  - S-01.2 — the bin under a faked `process.versions.node` 20.11 prints the catalogue message,
    exits 1 and opens no port; the stub parses as ES2019 script.
  - S-01.3 — with no opener on the `PATH` the bin prints `Open this URL in your browser: <url>`
    and keeps serving.
  - TT-PERF-06 — 10 of 10 starts print the URL ≤ 3.0 s.
  - X-03.1 / TT-SEC-01 — the listeners are exactly `127.0.0.1:<port>` and `[::1]:<port>` (Linux:
    the process's sockets from `/proc`); X-03.2 — a connection to the machine's first non-loopback
    IPv4 address on that port is refused.
  - spec-007 units: option table (exit 2), `--version`/`--help` (exit 0), `--port` in use (exit 3),
    `::1` retry, stop line and exit 0, second signal exit 130, pino on stderr with
    `authorization`/`cookie` redacted.

### red / green / refactor (2026-10-05)

- Red: options, catalogue, opener, listen, app and the bin end-to-end tests written first, all
  failing (no module). Green on the first full run except one race (below).
- Code: `bin/wingfoil-ui.cjs` (root `package.json` `bin`; ES2020 CommonJS — dynamic `import()`
  needs ES2020, still parsed by Node.js 14; the test parses it as such); `server/src/main.ts`
  entry; `launcher/` (`options`, `opener`, `listen`, `start`), `http/app.ts` (Fastify 5 +
  `@fastify/static`, SPA fallback, 404 envelope for `/api/`), `logging.ts` (pino on stderr,
  `authorization`/`cookie` redacted, headers serialized so the redaction is exercised),
  `i18n/` (`en.json` + `@formatjs/intl`, `ignoreTag` so `<n>` stays literal; numbers passed as
  text, no grouping). The two listeners are plain `http` servers handing requests to
  `app.routing`; Fastify's own server never listens.
- Exit status for "unexpected failure" (spec-007 §6 "other"): **70**.
- `onStop(hook)` is the stop-sequence hook for task-004's child processes; spec-007 §3.2 (state
  read, exit 4) is left to task-007.
- **Race found and fixed:** the SIGINT handler was registered after the running line, so a stop
  sent right after the URL could kill the process with the default handler (flaky launcher test
  under load). Signals are now handled before the URL is printed.
- **Deviation:** `test/server/launcher/start.test.ts` and `test/server/main.test.ts` were added
  in refactor, after the code, to cover in process what the bin tests cover in a child (coverage
  gate); they are characterization tests.
- `typedoc.json` now expands `server/src` and `contracts/src` (every exported declaration
  checked, not only `index.ts`); ESLint treats `*.cjs` as CommonJS.
- Checks: `npm run test:coverage` 137/137, coverage 91 % statements / 87 % branches · e2e 3/3 ·
  lint, format, typecheck clean · `docs:api` OK. TT-PERF-06: 10/10 starts print the URL in well
  under 3 s (≈ 0.1–0.3 s on this machine).
