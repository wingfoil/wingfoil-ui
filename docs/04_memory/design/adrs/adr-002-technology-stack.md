---
id: adr-002-technology-stack
type: adr
title: "Technology stack"
status: pending
sard_ref: "REQ-ARC-01"  # REQUIRED — REQ-* code (docs/02_requirements/03_sard/) or feature ID
supersedes: ""         # optional — id of the ADR this one replaces, e.g. "adr-002"
release: "v0.1"        # optional — implementation release this ADR is assigned to (stamped by release-planning/build-backlog), e.g. "v0.1"
contributor: ""        # optional — who originated this contribution, if not the git author; credited for AI-generated work derived from it
credit: ""             # optional — free-text credit note
tmpl_version: 260703   # Orignal template version
---

## Context

`adr-001` fixes the architecture: a local Node.js server driving the project's own CLI, an HTTP
JSON API and one event stream per page, and a browser UI. The DNA lists TypeScript, Node.js ≥ 22.12,
npm, git, and Playwright and axe-core "to be confirmed by initial-design"; the server framework,
the frontend framework, the bundler and the unit test runner are open (`BOOTSTRAP.md` §2.4).

Forces (SARD v0.3):
- the server must run `wingfoil` and `git` processes (`execFile`, REQ-SEC-05, INT-04): the runtime
  is Node.js — runtimes without child processes are excluded;
- request and response validation, and the CLI contracts, are JSON Schemas (REQ-INT-01;
  `ui.yaml` schema, REQ-ARC-07);
- the session token is never logged (REQ-SEC-02); Host/Origin checks on every request, token or session on every API request and the event stream
  (REQ-SEC-03); one event stream per page, no polling (REQ-INT-09);
- WCAG 2.1 AA with 0 serious/critical axe violations, keyboard operation (REQ-ARC-10); every string
  externalised (REQ-ARC-09); light and dark themes (REQ-ARC-11);
- Today ≤ 2 s warm, other views ≤ 1 s (REQ-PERF-01, PERF-04); Chrome, Edge, Firefox and Safari
  in the engine versions of the pinned Playwright release, e2e on Chromium, Firefox and WebKit
  (REQ-INT-08);
- complex accessible widgets: command palette (S6), trees (W1, R8), timeline and git tree (R6, R7);
- one maintainer and AI agents write the code: mainstream, well-documented tools are cheaper to
  get right;
- every module is tested in isolation (TDD, DNA methodology `delivery`).

## Decision

**Language and layout.** TypeScript (strict) everywhere, ESM. One repository with **npm
workspaces** for the DNA modules: `server/` (local server and CLI adapter), `web/` (browser UI),
`contracts/` (JSON Schemas of the consumed CLI output, of `ui.yaml` and of the HTTP API, the
capability table, and the TypeScript types generated from them, shared by `server/` and `web/`).
Dependency versions are pinned by `package-lock.json`.

**Server — Fastify.** HTTP API and event stream (Server-Sent Events) on Fastify:
- request/response validation with JSON Schema (Ajv) — the same schemas as `contracts/`;
- structured logging with pino and redaction of the session token (REQ-SEC-02);
- `onRequest` hooks for the Host/Origin checks on every request (REQ-SEC-03), the token/session
  check on API and event-stream requests (REQ-SEC-02) and the 401/403/404/409 refusals;
- `yaml` to parse and write `ui.yaml`.

**Ports and adapters.** The server's domain depends only on interfaces, each with a local adapter
now and an in-memory fake for tests:

| Port | Local adapter (MVP) |
|------|---------------------|
| Process runner (CLI, git) | `execFile`, argument arrays; 30 s timeout for `wingfoil` and git reads, cancellable git transport (adr-001 D5) |
| Local-state store (project list, role views, UI settings, action log) | files in the OS user configuration directory (REQ-ARC-08) |
| Event bus (change notifications, agent output) | in-process emitter feeding the SSE streams |
| Per-project write lock (adr-001 D5) | in-process queue |
| Authentication (who is calling) | per-start session token (REQ-SEC-02) |
| Repository watcher | file watching + periodic check (REQ-STATE-02) |

HTTP handlers keep no state of their own: everything goes through the ports.

**Web — React + Vite.**
- **React** with **React Aria Components** for accessible primitives (dialogs, menus, combobox
  for ⌘K, trees, focus management) — the accessibility bar is met by construction, then checked by axe;
- **Vite** as dev server and bundler; the build is a static single-page application served by the
  local server;
- **TanStack Query** for server state, invalidated by the event stream (no polling);
- **TanStack Router** for typed routes (`/p/:id/…`);
- **FormatJS** (`react-intl`) message catalogues for every string, English only in the MVP;
- **CSS custom properties** for the light and dark themes; no CSS-in-JS runtime;
- Markdown (documentation, element bodies) rendered with **markdown-it** and sanitised with
  **DOMPurify**.

**Tests and quality.**
- **Vitest** for unit tests (server, contracts) and component tests (web, with Testing Library
  and jsdom);
- contract tests (Vitest) run the CLI adapter against fixtures for every version of the support
  matrix (adr-001 D4);
- **Playwright** for the e2e suite on Chromium, Firefox and WebKit (REQ-INT-08), with
  **@axe-core/playwright** for the accessibility scan (both themes);
- **ESLint** (typescript-eslint, including a rule forbidding `exec`, `execSync` and `shell: true`
  in `server/`, REQ-SEC-05) and **Prettier**;
- TypeDoc for `server/` and `contracts/` only (`dev-loop`).

## Consequences

- **Positive**
  - One schema language (JSON Schema) for CLI contracts, `ui.yaml`, API validation and shared
    types: a shape is defined once and checked on both sides.
  - Accessibility, focus management and keyboard operation come from a maintained library rather
    than hand-written widgets.
  - Every infrastructure dependency sits behind a port: the domain is unit-tested with fakes,
    and an adapter can be replaced without touching the domain.
  - Mainstream tools with wide documentation and agent familiarity.
- **Negative**
  - React's bundle is larger than Svelte's or Preact's; acceptable for a locally served SPA and
    checked against REQ-PERF-04.
  - Fastify's plugin and encapsulation model is a convention to learn.
  - Ports add a layer of indirection for an MVP that has one adapter per port.
- **Neutral**
  - The DNA `stacks.technologies` is updated through the CLI once this ADR is accepted
    (Fastify, React, Vite, React Aria Components, TanStack Query/Router, FormatJS, Vitest;
    Playwright and axe-core confirmed).

### Alternatives considered

| Area | Alternative | Why not chosen |
|------|-------------|----------------|
| Server | `node:http` + minimal router | authentication, validation, logging, SSE and error handling all hand-written: more security-sensitive code |
| Server | Express | slower, validation and types bolted on, weaker async error handling |
| Server | Hono | its portability to runtimes without child processes is of no use here; less mature on Node than Fastify |
| Web | Svelte 5 | smaller bundles and less boilerplate, but fewer complete accessible component libraries for trees, palettes and timelines |
| Web | Preact | marginal size gain; compatibility of React Aria not guaranteed |
| Web | Vue 3 | a valid option with no decisive advantage over React for this product |
| Tests | Jest | slower ESM/TypeScript setup than Vitest, which shares Vite's configuration |

### Traceability

REQ-ARC-01, ARC-07, ARC-08, ARC-09, ARC-10, ARC-11 · REQ-INT-01, INT-04, INT-08, INT-09 ·
REQ-SEC-02, SEC-03, SEC-05 · REQ-STATE-02 · REQ-PERF-01, PERF-04 · features S1, S6, X1, X2, X3 ·
`adr-001-local-server-driving-the-wingfoil-cli`.

## Process Notes

- 2026-10-02 — drafted in initial-design session 3 after a comparison of the alternatives with the
  maintainer; `sard_ref` = REQ-ARC-01. Submitted only after the independent spec review (plan
  step 6).
- 2026-10-02 — spec review (step 6): browsers quoted from REQ-INT-08 (F15); process-runner
  timeout aligned with adr-001 D5 (F14).
