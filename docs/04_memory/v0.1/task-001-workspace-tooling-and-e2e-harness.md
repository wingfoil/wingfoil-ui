---
id: task-001-workspace-tooling-and-e2e-harness
type: task
title: "Workspace tooling and e2e harness"
status: in-progress
release: "v0.1"
module: "server"             # optional — server | web | contracts (dna.yaml modules)
priority: "high"           # optional — high | medium | low
tags: ["v0.1"]
ref: "TT-INT-08"                # optional — backlog item ID, e.g. "TASK-001"
bug: []                # optional — LIST of bug ids this task closes. Two cases: a fix task derived from a bug
                       # by release-planning, and a bug ABSORBED into an existing task's Acceptance Criteria because that
                       # task already owns the ground. `bug.sync_state` iterates this list; a bug with no task naming it
                       # here never advances past `triaged` (only a reject to `closed`).
                       # dev-loop keeps the source bug's state in sync with this task via bug.sync_state
depends_on: []         # optional — ids of tasks whose Execution Notes constrain this one; authored at planning time, may be appended during design
tmpl_version: 260703   # Orignal template version
---

## Description

Set up the npm workspaces `server/`, `web/`, `contracts/` with TypeScript, ESLint (typescript-eslint, the REQ-SEC-05 rule forbidding `exec`, `execSync` and `shell: true` in `server/`), Prettier, Vitest, Playwright with @axe-core/playwright on **Chromium** (REQ-INT-08 staged: three engines from v0.2), and the e2e fixture builder (`kanban`, `custom`, `unknown` fixtures with a bare remote, built with the pinned CLI, as `02_bdd/00_conventions.md` *Fixtures* defines). Every later task runs its tests on this harness.

**Backlog items:** TT-INT-08, TT-SEC-05

## Acceptance Criteria

- **TT-INT-08** (REQ-INT-08 — Supported browsers): [percentage] 100 % of the release's e2e scenarios pass on each of the three engines (v0.1: on Chromium). *Verified by:* e2e-smoke `drive-browser`.
  Scenarios (`@v0.1`): S-01.1, S-28.1, X-06.4.
- **TT-SEC-05** (REQ-SEC-05 — No shell): [boolean] A lint rule finds 0 uses of `exec`, `execSync` or `shell: true` in `server/`; a decision-log titled `x"; touch /tmp/pwned; "` is created with that literal title and `/tmp/pwned` does not exist. v0.1 (no governed write): the lint rule, and a clone whose URL and working directory contain `"; touch /tmp/pwned; "` creates no `/tmp/pwned`. *Verified by:* lint · e2e.
  Scenarios (`@v0.1`): S-04.3.

e2e closure — scenarios that need a screen are proved here by API and unit tests on the same fixtures and close in: task-013-web-shell-themes-and-message-catalogue: S-01.1; task-014-add-project-modal: S-04.3; task-017-memory-list-and-live-refresh: S-28.1; task-021-accessibility-page-title-and-performance-pass: X-06.4.

## Implementation Notes

- `adr-002` (stack, tests and quality); BDD conventions `docs/02_requirements/02_bdd/00_conventions.md` (tags, fixtures, standard team).
- e2e on Chromium only in v0.1 (SARD `04` v0.4, REQ-INT-08 staged).
- Directive `wingfoil-cli` (W-01…W-20) for every CLI call made by the fixture builder.

## Execution Notes

<!-- Running log of what actually happened while working this task through dev-loop — filled in
     incrementally per phase, not written after the fact. Raw material for the release's Execution
     Notes / the retrospective, not the retrospective itself.
     - design: tech-specs found missing/needing revision (dev-loop/design safety net).
     - red/green/refactor: deviations from the plan above, blockers, scope surprises.
     - review: rejection reasons and what changed on the next pass. -->

### design (2026-10-05)

- **depends_on:** none — no Execution Notes to acknowledge (dl-015 gate trivially satisfied).
- **Specs:** no gap. The harness is defined by `adr-002` (stack, tests) and
  `02_bdd/00_conventions.md` v0.6 *Fixtures* (fixtures, variants, standard team and elements);
  the CLI facts used by the builder are `wingfoil-cli` W-01…W-20, re-checked on `wingfoil@0.2.2`
  in a scratch repository (identity = `git config user.email`, commit dates from
  `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE`, `approve` refused for a member without `approver`).
- **Layout decision:** DNA `paths.tests` is `test/`, so every test lives under the root `test/`
  (`test/harness/` fixture builder and helpers, `test/e2e/` Playwright, `test/lint/`,
  `test/docs/`, later `test/server/`, `test/contracts/`, `test/web/`); sources stay in
  `server/src`, `web/src`, `contracts/src`.
- **AC classification (T1):**
  - TT-SEC-05 lint rule — **red-first**: a test lints sample `server/` sources and expects an
    error for `exec`, `execSync` (named, namespace and default `child_process` imports, `require`,
    dynamic `import()`) and for any `shell:` option other than `false`; clean samples (`execFile`,
    `spawn`, `RegExp#exec`) pass.
  - TT-SEC-05 v0.1 clone — **red-first** on the harness: a bare remote and a working directory whose
    paths contain `"; touch /tmp/pwned; "` are cloned through the harness runner (`execFile`) and
    `/tmp/pwned` does not exist. The server's clone (`POST /api/projects/clone`) is task-008; the
    screen closes in task-014 (S-04.3).
  - TT-INT-08 — **red-first**: the Playwright config declares exactly one project, `chromium`; an
    e2e self-test runs @axe-core/playwright in the light and the dark theme (`X-06.4` helper) and
    fails on serious/critical violations (checked with a page that has one).
  - S-28.1 (fixture side) — **red-first**: each fixture built with the pinned CLI declares exactly
    the type list of the Examples table and holds every standard element in its state (read back
    with `memory search --format json` and, for the hand-written `on-hold`, from the file). The
    Memory list screen closes in task-017.
  - S-01.1, X-06.4 (screens) — not provable before the launcher (task-002) and the web shell
    (task-013/021): this task only provides the helpers they use.
  - Fixture variants (CLI stub, version-fake, no-CLI) — **red-first** unit tests of the builder.

### red / green / refactor (2026-10-05)

- Tooling: npm workspaces `contracts`, `server`, `web` (`@wingfoil-ui/*`, private, ESM), each with a
  documented placeholder `src/index.ts` (the real modules start with task-002/005/013); TypeScript
  6 strict (`tsconfig.base.json`, project references, `tsc -b`); ESLint 10 flat config with
  typescript-eslint and Prettier; Vitest 5 (v8 coverage, threshold 80 % on `server/`,
  `contracts/`, `web/` — 0/0 statements for now); Playwright 1.63 with Chromium only and
  @axe-core/playwright; TypeDoc with `notDocumented` + `treatWarningsAsErrors`. Playwright needed
  its Chromium build (rev 1243) downloaded with `npx playwright install chromium`.
- Red first: the lint-rule test (14 cases) failed before `eslint.config.js`; the Playwright config
  test failed before `playwright.config.ts`. **Deviation:** the fixture builder was written right
  after the CLI probes on a scratch repository and its tests immediately after, not before.
- REQ-SEC-05 rule (`server/**`): `exec`/`execSync` named imports, namespace/default imports,
  `require` and dynamic `import()` of `child_process`, and any `shell:` other than literal `false`.
  `RegExp#exec` stays allowed.
- Findings on `wingfoil@0.2.2` (directive `wingfoil-cli` v1.3, local requests R-12, R-13):
  - **W-21** `memory add` always writes `status: draft` — the `unknown` fixture's types start with
    `idea`/`open`, so the builder amends the add commit (`addInState`).
  - **W-22** `memory search` omits elements in an undeclared state even with `--status`: the
    `unknown` fixture's `note-002-retro` (`on-hold`) is invisible to it. **For task-005 design:**
    spec-001 §3 lists elements through `memory search` only, so S-28 / spec-003 `undeclared` need
    another source (e.g. listing the type's Memory path, a direct read on the allow-list).
- Custom fixture: the S-28.1 type list is read from this repository's `memory.yaml` (it imports
  `.wingfoil/`), so a change of this project's types changes the fixture — intended by the BDD
  conventions.
- Timing: a fixture build is ~10 s with the pinned CLI (≈ 40 CLI calls); the full Vitest run is
  ~130 s, the e2e self-test ~25 s.
- Checks: `npm run test:coverage` 43/43 · `npm run test:e2e` 3/3 (Chromium) · `npm run lint` clean
  · `npm run format:check` clean · `npm run typecheck` clean · `npm run docs:api` OK.
